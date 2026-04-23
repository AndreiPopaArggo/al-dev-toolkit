---
name: al-performance
description: Use when writing or reviewing AL code that reads from the database. Covers SetLoadFields, FindSet vs Get, set-based ops, FlowField handling, caching, query objects, unnecessary Validate.
user-invocable: false
---

# AL Performance Guidelines

## Core Principles

- Filter data BEFORE processing (SetRange/SetFilter early)
- Prefer set-based operations over loops
- Use SetLoadFields to minimize data retrieval
- Use temporary tables, dictionaries, or lists for caching

## SetLoadFields (Partial Records)

**Mandatory: Use `SetLoadFields` before every `Get`, `FindFirst`, `FindSet`, and `FindLast` call.**

**Exceptions — skip `SetLoadFields` when:**
- The loaded record is passed to `TransferFields` (copies every field into another record; partial loading would silently transfer empty fields)
- You genuinely need every field from the record (rare)
- Before `CalcSums` — no confirmed effect

**Order matters: SetRange → SetLoadFields → SetAutoCalcFields (if needed) → Find**

```al
// CORRECT: SetLoadFields before FindSet
_Item.SetRange("Item Category Code", 'FURNITURE');
_Item.SetLoadFields(Description);
if _Item.FindSet() then
    repeat
        _categoryName := _Item.Description;
    until _Item.Next() = 0;

// CORRECT: SetLoadFields before Get
_Customer.SetLoadFields(Name, "Credit Limit (LCY)");
if _Customer.Get(pCustomerNo) then
    _customerName := _Customer.Name;

// CORRECT: skip SetLoadFields when the record feeds TransferFields — it needs all fields
if _SalesHeader.Get(pDocType, pDocNo) then begin
    _SalesHeaderArchive.TransferFields(_SalesHeader);
    _SalesHeaderArchive.Insert();
end;

// WRONG: No SetLoadFields (loads entire record from DB)
if _Customer.Get(pCustomerNo) then
    _customerName := _Customer.Name;

// WRONG: SetLoadFields before SetRange (silently ignored)
_Item.SetLoadFields(Description);
_Item.SetRange("Item Category Code", 'FURNITURE');  // Too late!
```

## FindSet vs FindFirst vs Get

| Method | Use Case |
|--------|----------|
| `Get()` | Exact primary key lookup (most efficient) |
| `FindFirst()` | Single record with filters (no lock) |
| `FindSet()` | Multiple records in loop |

```al
// FindSet for loops
if _SalesLine.FindSet() then
    repeat
        this.ProcessLine(_SalesLine);
    until _SalesLine.Next() = 0;

// Get for direct PK lookup
if _Customer.Get(pCustomerNo) then
    this.ProcessCustomer(_Customer);
```

## Set-Based Operations

```al
// GOOD: CalcSums for aggregation
_CustLedgerEntry.SetRange("Customer No.", pCustomerNo);
_CustLedgerEntry.CalcSums(Amount);
_totalAmount := _CustLedgerEntry.Amount;

// GOOD: Bulk modify
_Customer.SetRange("Country/Region Code", 'US');
_Customer.ModifyAll(Blocked, _Customer.Blocked::All);

// BAD: Loop with individual operations
if _Customer.FindSet() then
    repeat
        _Customer.Blocked := _Customer.Blocked::All;
        _Customer.Modify();  // Individual writes = slow
    until _Customer.Next() = 0;
```

## FlowField Performance

```al
// BAD: FlowField in SetFilter (calculates for every record!)
_Customer.SetFilter(Balance, '>%1', 1000);

// GOOD (preferred): SetAutoCalcFields before FindSet — single SQL join
_Customer.SetAutoCalcFields(Balance);
if _Customer.FindSet() then
    repeat
        if _Customer.Balance > 1000 then
            this.ProcessCustomer(_Customer);
    until _Customer.Next() = 0;

// ACCEPTABLE: CalcFields in loop — one extra call per iteration
if _Customer.FindSet() then
    repeat
        _Customer.CalcFields(Balance);
        if _Customer.Balance > 1000 then
            this.ProcessCustomer(_Customer);
    until _Customer.Next() = 0;
```

### SetAutoCalcFields vs CalcFields

| Method | When to Use |
|--------|-------------|
| `SetAutoCalcFields` | FlowField needed for **most/all** records in the loop — avoids N extra calls |
| `CalcFields` in loop | FlowField needed only for a **small subset** (behind an `if` guard) |

**Order matters: SetRange → SetLoadFields → SetAutoCalcFields → Find**

```al
// CORRECT: Full chain
_CustLedgerEntry.SetRange("Customer No.", pCustomerNo);
_CustLedgerEntry.SetLoadFields("Entry No.", "Posting Date");
_CustLedgerEntry.SetAutoCalcFields("Remaining Amount");
if _CustLedgerEntry.FindSet() then
    repeat
        // "Remaining Amount" is auto-calculated — no CalcFields needed
    until _CustLedgerEntry.Next() = 0;
```

## Caching Patterns

### Dictionary for Lookups

```al
var
    _customerCache: Dictionary of [Code[20], Text];
begin
    _Customer.SetLoadFields("No.", Name);
    if _Customer.FindSet() then
        repeat
            _customerCache.Add(_Customer."No.", _Customer.Name);
        until _Customer.Next() = 0;

    // Use cached data - no DB hits
    this.ProcessOrdersWithCache(_customerCache);
end;
```

### Temporary Tables for Multi-Pass

```al
procedure ProcessSalesData(var pTemp_SalesLine: Record "Sales Line" temporary)
begin
    // Load once
    _SalesLine.SetLoadFields("Document No.", "Line No.", "No.", Quantity, Amount);
    if _SalesLine.FindSet() then
        repeat
            pTemp_SalesLine := _SalesLine;
            pTemp_SalesLine.Insert();
        until _SalesLine.Next() = 0;

    // Process multiple times - no database hits
    this.ProcessDiscounts(pTemp_SalesLine);
    this.CalculateTotals(pTemp_SalesLine);
end;
```

## Query Objects for Aggregations

```al
query 50100 "Customer Sales Summary"
{
    elements
    {
        dataitem(Customer; Customer)
        {
            column(No; "No.") { }
            column(Name; Name) { }
            dataitem(SalesLine; "Sales Line")
            {
                DataItemLink = "Sell-to Customer No." = Customer."No.";
                column(Amount; Amount) { Method = Sum; }
            }
        }
    }
}
```

## Avoid Unnecessary Validate

Do not call `Validate` on field assignments when the OnValidate trigger side effects are not needed (or when no OnValidate trigger exists). Direct assignment (`:=`) is faster — it skips trigger evaluation, cascading field updates, and any subscriber logic.

```al
// BAD: Validate triggers OnValidate — unnecessary if you just want to set the value
_SalesLine.Validate("Location Code", pLocationCode);
_SalesLine.Validate(Description, pDescription);  // Text field — no OnValidate logic

// GOOD: Direct assignment when OnValidate effects are not needed
_SalesLine."Location Code" := pLocationCode;
_SalesLine.Description := pDescription;

// GOOD: Validate IS appropriate when you need the side effects
_SalesLine.Validate("No.", pItemNo);  // Triggers item defaulting, UoM, price lookup
_SalesLine.Validate(Quantity, pQuantity);  // Triggers amount recalculation
```

**Rule of thumb:** Use `Validate` only when you rely on what the OnValidate trigger does. When populating fields during batch processing or data migration, prefer direct assignment.

## Avoid BLOB / Media Fields in Query Loops

Do not include BLOB, Media, or MediaSet fields in `SetLoadFields` or query columns when processing records in bulk. These fields transfer large binary payloads per row — especially expensive on SaaS due to data egress costs.

```al
// BAD: Loading image for every item in the loop
_Item.SetLoadFields(Description, "Unit Price", Picture);
if _Item.FindSet() then
    repeat
        // Only using Description and Unit Price...
    until _Item.Next() = 0;

// GOOD: Exclude BLOB/Media from bulk reads — load individually when needed
_Item.SetLoadFields(Description, "Unit Price");
if _Item.FindSet() then
    repeat
        if this.NeedsPicture(_Item) then begin
            _Item.CalcFields(Picture);
            this.ProcessPicture(_Item);
        end;
    until _Item.Next() = 0;
```

## Performance Checklist

- [ ] SetLoadFields used before EVERY Get/Find call (mandatory — except when the record feeds `TransferFields`, or before `CalcSums`)
- [ ] SetLoadFields placed AFTER SetRange, BEFORE Find
- [ ] SetAutoCalcFields used for FlowFields needed across most loop iterations
- [ ] No FlowFields in SetFilter/SetRange
- [ ] No BLOB/Media/MediaSet fields in bulk SetLoadFields or query columns
- [ ] FindSet for loops, Get for PK lookup
- [ ] CalcSums instead of manual aggregation loops
- [ ] ModifyAll/DeleteAll for bulk operations
- [ ] No database reads inside tight loops
- [ ] No unnecessary Validate — use direct assignment when OnValidate effects aren't needed
