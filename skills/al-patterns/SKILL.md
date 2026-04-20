---
name: al-patterns
description: Use when writing new AL objects or designing extensibility. Covers events, interfaces, temp tables, TryFunction, setup tables, notifications, enums, handler codeunits, CommitBehavior, GuiAllowed, dedup guards.
---

# AL Design Patterns

## Events for Extensibility

Use events to make code extensible without modification. **Always prefer events over direct code changes.**

### When to Publish Events

- Before/After significant operations (posting, validation, calculation)
- When data is transformed or aggregated
- At decision points where behavior might vary

### Event Publisher Pattern

```al
codeunit 50100 "Sales Order Processor"
{
    [IntegrationEvent(false, false)]
    local procedure OnBeforePostSalesOrder(var pSalesHeader: Record "Sales Header"; var pIsHandled: Boolean)
    begin
    end;

    [IntegrationEvent(false, false)]
    local procedure OnAfterPostSalesOrder(var pSalesHeader: Record "Sales Header")
    begin
    end;

    procedure PostSalesOrder(var pSalesHeader: Record "Sales Header")
    var
        _isHandled: Boolean;
    begin
        this.OnBeforePostSalesOrder(pSalesHeader, _isHandled);
        if _isHandled then
            exit;

        // Default implementation
        this.DoPostSalesOrder(pSalesHeader);

        this.OnAfterPostSalesOrder(pSalesHeader);
    end;
}
```

### Event Subscriber Pattern

**Subscriber procedure naming:** `<Object>_<EventName>[_<FieldName>]_<ClientSuffix>`
- `<Object>` — Subscribed-to object name in PascalCase (spaces/dots removed)
- `<EventName>` — **Exact** event publisher name from the `[EventSubscriber]` attribute, character-for-character. A procedure named `..._OnAfterValidateEvent_...` that subscribes to `'OnBeforeValidateEvent'` is a bug — the name must match the attribute
- `<FieldName>` — **Only when the 4th parameter in `[EventSubscriber]` is non-empty** (field-level, action-level, or similar element-scoped events). Field/element name with spaces and dots removed. Omit this segment when the element parameter is `''`
- `<ClientSuffix>` — Project's `mandatoryAffixes` from `CodeCop.json`

```al
// Element parameter is empty ('') → 3 segments
[EventSubscriber(ObjectType::Codeunit, Codeunit::"Sales-Post", OnBeforePostSalesOrder, '', false, false)]
local procedure SalesPost_OnBeforePostSalesOrder_ACME(...)

// Element parameter is a field name ('Item No.') → 4 segments, field name included
[EventSubscriber(ObjectType::Page, Page::"Transfer Order Subform", 'OnBeforeValidateEvent', 'Item No.', false, false)]
local procedure TransferOrderSubform_OnBeforeValidateEvent_ItemNo_ACME(var Rec: Record "Transfer Line"; var xRec: Record "Transfer Line")
```

```al
codeunit 50101 "ACME Sales Order Subscriber"
{
    [EventSubscriber(ObjectType::Codeunit, Codeunit::"Sales Order Processor", OnBeforePostSalesOrder, '', false, false)]
    local procedure SalesOrderProcessor_OnBeforePostSalesOrder_ACME(var pSalesHeader: Record "Sales Header"; var pIsHandled: Boolean)
    begin
        // Custom validation or logic
        if not this.IsCustomValidationPassed(pSalesHeader) then
            Error(CustomValidationErr);
    end;

    [EventSubscriber(ObjectType::Codeunit, Codeunit::"Sales Order Processor", OnAfterPostSalesOrder, '', false, false)]
    local procedure SalesOrderProcessor_OnAfterPostSalesOrder_ACME(var pSalesHeader: Record "Sales Header")
    begin
        // Post-processing (notifications, integrations, etc.)
        this.SendNotification(pSalesHeader);
    end;
}
```

### Event Rules

- **NEVER** use `Commit()` in event subscribers
- Use `var pIsHandled: Boolean` pattern for overridable behavior
- Keep subscribers focused - one responsibility per subscriber
- Subscribe to standard BC events when extending base functionality

## Interface Pattern

```al
// Interface definition
interface "IDocument Validator"
{
    procedure Validate(pRecordRef: RecordRef): Boolean;
    procedure GetErrorMessage(): Text;
}

// Implementation
codeunit 50102 "Sales Document Validator" implements "IDocument Validator"
{
    var
        _lastError: Text;
        CustomerRequiredErr: Label 'Customer is required';

    procedure Validate(pRecordRef: RecordRef): Boolean
    var
        _SalesHeader: Record "Sales Header";
    begin
        pRecordRef.SetTable(_SalesHeader);
        if _SalesHeader."Sell-to Customer No." = '' then begin
            _lastError := CustomerRequiredErr;
            exit(false);
        end;
        exit(true);
    end;

    procedure GetErrorMessage(): Text
    begin
        exit(_lastError);
    end;
}
```

## Codeunit as Service Pattern

```al
codeunit 50103 "Customer Rating Service"
{
    Access = Public;

    procedure CalculateRating(pCustomerNo: Code[20]): Decimal
    var
        _Customer: Record Customer;
    begin
        if not _Customer.Get(pCustomerNo) then
            exit(0);
        exit(this.DoCalculateRating(_Customer));
    end;

    local procedure DoCalculateRating(pCustomer: Record Customer): Decimal
    begin
        // Internal implementation
    end;
}
```

## Temporary Tables for Performance

Use temporary tables to:
- Avoid database writes during processing
- Buffer data for batch operations
- Pass complex data between procedures

```al
procedure CollectDataInBuffer(var pTemp_Buffer: Record "Name/Value Buffer" temporary)
var
    _Customer: Record Customer;
    _entryNo: Integer;
begin
    pTemp_Buffer.Reset();
    pTemp_Buffer.DeleteAll();

    _Customer.SetLoadFields("No.", Name);
    if _Customer.FindSet() then
        repeat
            _entryNo += 1;
            pTemp_Buffer.Init();
            pTemp_Buffer.ID := _entryNo;
            pTemp_Buffer.Name := _Customer."No.";
            pTemp_Buffer.Value := _Customer.Name;
            pTemp_Buffer.Insert();
        until _Customer.Next() = 0;
end;

// Processing with temp table - no DB writes until final commit
procedure ProcessSalesLines(var pTemp_SalesLine: Record "Sales Line" temporary)
var
    _SalesLine: Record "Sales Line";
begin
    if pTemp_SalesLine.FindSet() then
        repeat
            // Validate and modify in temp table first
            this.ValidateLine(pTemp_SalesLine);
            pTemp_SalesLine.Modify();
        until pTemp_SalesLine.Next() = 0;

    // Single batch write to database
    if pTemp_SalesLine.FindSet() then
        repeat
            _SalesLine := pTemp_SalesLine;
            _SalesLine.Insert(true);
        until pTemp_SalesLine.Next() = 0;
end;
```

## Enum Extensibility Pattern

```al
// Base enum
enum 50100 "Document Status"
{
    Extensible = true;

    value(0; Open) { Caption = 'Open'; }
    value(1; Released) { Caption = 'Released'; }
    value(2; Posted) { Caption = 'Posted'; }
}

// Extension enum
enumextension 50100 "Document Status Ext" extends "Document Status"
{
    value(50100; "Pending Approval") { Caption = 'Pending Approval'; }
}
```

## TryFunction Pattern

Use TryFunctions for operations that might fail (external calls, risky data operations):

```al
procedure ProcessPayment(pAmount: Decimal): Boolean
var
    _errorText: Text;
    _PaymentFailedLbl: Label 'Payment processing failed: %1', Comment = '%1 = Error message';
begin
    if not this.TryProcessPaymentInternal(pAmount) then begin
        _errorText := GetLastErrorText();
        Message(_PaymentFailedLbl, _errorText);
        exit(false);
    end;
    exit(true);
end;

[TryFunction]
local procedure TryProcessPaymentInternal(pAmount: Decimal)
var
    _PaymentService: Codeunit "Payment Service";
begin
    _PaymentService.ProcessPayment(pAmount);
end;
```

## Setup Table Pattern (Single-Record Config)

Uses `GetRecordOnce()` with caching flag (matches BC26 base app pattern):

```al
table 50105 "ACME Setup"
{
    Caption = 'ACME Setup';
    DataClassification = CustomerContent;

    fields
    {
        field(1; "Primary Key"; Code[10])
        {
            Caption = 'Primary Key';
            DataClassification = SystemMetadata;
        }
        field(10; "Default Rating"; Decimal)
        {
            Caption = 'Default Rating';
            DataClassification = CustomerContent;
        }
    }

    keys
    {
        key(PK; "Primary Key") { Clustered = true; }
    }

    var
        _recordHasBeenRead: Boolean;

    procedure GetRecordOnce()
    begin
        if _recordHasBeenRead then
            exit;
        Get();
        _recordHasBeenRead := true;
    end;
}
```

## Notification Pattern

```al
procedure NotifyUserAboutMissingSetup()
var
    _Notification: Notification;
    _SetupMissingMsg: Label 'Setup is not configured. Click to open setup.';
begin
    _Notification.Message(_SetupMissingMsg);
    _Notification.Scope(NotificationScope::LocalScope);
    _Notification.AddAction('Open Setup', Codeunit::"ACME Notification Handler", 'OpenSetup');
    _Notification.Send();
end;
```

## CommitBehavior Pattern (BC22+)

Use `[CommitBehavior]` attribute to suppress commits in posting routines. This replaces manual `Commit()` suppression with a declarative approach:

```al
// Wrap posting logic — CommitBehavior::Ignore prevents implicit commits
[CommitBehavior(CommitBehavior::Ignore)]
local procedure PostWithCommitSuppressed(var pSalesHeader: Record "Sales Header")
begin
    this.DoPostSalesDocument(pSalesHeader);
end;
```

The base app uses `CommitBehavior::Ignore` on posting codeunit wrappers (e.g., `Sales-Post`). When previewing, the caller invokes the suppressed variant so no data is written. Prefer this attribute over manual `Commit()` / `SuppressCommit` flag patterns.

## GuiAllowed Pattern

Always wrap Dialog/Window/Message operations with `GuiAllowed()` for batch/API compatibility:

```al
if GuiAllowed() and not pHideProgressWindow then begin
    _Window.Open(PostingLinesMsg);
    _Window.Update(1, StrSubstNo('%1 %2', pSalesHeader."Document Type", pSalesHeader."No."));
end;

// Close only if opened
if GuiAllowed() and not pHideProgressWindow then
    _Window.Close();
```

## Deduplication Guard Pattern

When processing query results or ledger entries that may contain duplicate keys (e.g., same Customer No. appearing on multiple lines), use a guard variable to skip already-processed values. This avoids redundant lookups and processing.

```al
procedure ProcessCustomerEntries()
var
    _CustLedgerEntry: Record "Cust. Ledger Entry";
    _lastCustomerNo: Code[20];
begin
    _CustLedgerEntry.SetCurrentKey("Customer No.");
    _CustLedgerEntry.SetLoadFields("Customer No.", Amount);
    if _CustLedgerEntry.FindSet() then
        repeat
            if _CustLedgerEntry."Customer No." <> _lastCustomerNo then begin
                _lastCustomerNo := _CustLedgerEntry."Customer No.";
                this.ProcessCustomer(_CustLedgerEntry."Customer No.");
            end;
        until _CustLedgerEntry.Next() = 0;
end;
```

For multi-field dedup or non-sorted data, use a `Dictionary` or `List` instead:

```al
var
    _processedCustomers: Dictionary of [Code[20], Boolean];
begin
    if _CustLedgerEntry.FindSet() then
        repeat
            if not _processedCustomers.ContainsKey(_CustLedgerEntry."Customer No.") then begin
                _processedCustomers.Add(_CustLedgerEntry."Customer No.", true);
                this.ProcessCustomer(_CustLedgerEntry."Customer No.");
            end;
        until _CustLedgerEntry.Next() = 0;
end;
```

## Handler Codeunit Pattern

```al
codeunit 50104 "Document Action Handler"
{
    TableNo = "Sales Header";

    trigger OnRun()
    begin
        this.ProcessDocument(Rec);
    end;

    local procedure ProcessDocument(var pSalesHeader: Record "Sales Header")
    begin
        // Processing logic
    end;
}

// Usage
_SalesHeader.SetRecFilter();
Codeunit.Run(Codeunit::"Document Action Handler", _SalesHeader);
```
