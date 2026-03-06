---
name: al-testing
description: Use ONLY when user explicitly requests tests. Covers test codeunit structure, Given-When-Then naming, library codeunits, handler functions, ASSERTERROR.
---

# AL Testing Requirements

## Test Generation Guidelines

**DO NOT automatically generate tests unless explicitly requested.**

- Focus on main application implementation by default
- Only generate test files when user specifically requests:
  - "Create tests for..."
  - "Generate unit tests..."
  - "Add test coverage..."
  - "Write tests..."
- When tests are requested, place them in the **Test project** mirroring the App project structure

## Test Codeunit Structure

```al
codeunit 50200 "Customer Management Tests"
{
    Subtype = Test;
    TestPermissions = Disabled;

    var
        Assert: Codeunit Assert;
        LibrarySales: Codeunit "Library - Sales";
        LibraryInventory: Codeunit "Library - Inventory";
        LibraryRandom: Codeunit "Library - Random";
        LibraryERM: Codeunit "Library - ERM";
        isInitialized: Boolean;

    [Test]
    procedure GivenValidCustomer_WhenCreatingCustomer_ThenCustomerIsCreated()
    var
        _Customer: Record Customer;
        _CustomerManagement: Codeunit "Customer Management";
        _customerNo: Code[20];
    begin
        // Given - Valid customer data using library
        Initialize();
        LibrarySales.CreateCustomer(_Customer);
        _Customer."Credit Limit (LCY)" := LibraryRandom.RandDec(10000, 2);

        // When - Creating customer
        _customerNo := _CustomerManagement.CreateCustomer(_Customer);

        // Then - Customer is created successfully
        Assert.IsTrue(_Customer.Get(_customerNo), 'Customer should be created');
    end;

    [Test]
    procedure GivenSalesOrder_WhenPostingOrder_ThenInvoiceIsCreated()
    var
        _SalesHeader: Record "Sales Header";
        _SalesLine: Record "Sales Line";
        _Item: Record Item;
        _postedInvoiceNo: Code[20];
    begin
        // Given - Sales order with library-created data
        Initialize();
        LibraryInventory.CreateItem(_Item);
        LibrarySales.CreateSalesHeader(_SalesHeader, _SalesHeader."Document Type"::Order, '');
        LibrarySales.CreateSalesLine(_SalesLine, _SalesHeader, _SalesLine.Type::Item, _Item."No.", LibraryRandom.RandInt(10));

        // When - Posting sales order
        _postedInvoiceNo := LibrarySales.PostSalesDocument(_SalesHeader, true, true);

        // Then - Posted invoice exists
        Assert.AreNotEqual('', _postedInvoiceNo, 'Posted invoice should be created');
    end;

    local procedure Initialize()
    begin
        if isInitialized then
            exit;

        // One-time setup
        isInitialized := true;
        Commit();
    end;
}
```

## Test Patterns

### Given-When-Then Naming (Mandatory)

**Test procedure names must follow Given/When/Then pattern:**

```al
// Format: Given[Condition]_When[Action]_Then[ExpectedResult]
procedure GivenBlockedCustomer_WhenCreatingSalesOrder_ThenErrorIsThrown()
procedure GivenValidItem_WhenCalculatingPrice_ThenPriceIsReturned()
procedure GivenEmptyCart_WhenAddingItem_ThenCartContainsItem()
```

### Given-When-Then Comments

```al
[Test]
procedure GivenReleasedOrder_WhenPosting_ThenInvoiceIsCreated()
var
    _SalesHeader: Record "Sales Header";
begin
    // [SCENARIO 001] Post sales order with valid data
    Initialize();

    // [GIVEN] A released sales order
    CreateReleasedSalesOrder(_SalesHeader);

    // [WHEN] The order is posted
    PostSalesOrder(_SalesHeader);

    // [THEN] Posted invoice is created
    VerifyPostedInvoiceExists(_SalesHeader."No.");
end;
```

### ASSERTERROR for Expected Errors

```al
[Test]
procedure TestCannotPostWithoutCustomer()
var
    _SalesHeader: Record "Sales Header";
begin
    // [SCENARIO] Posting fails without customer
    Initialize();

    // [GIVEN] Sales order without customer
    CreateSalesOrderWithoutCustomer(_SalesHeader);

    // [WHEN] Attempting to post
    // [THEN] Error is thrown
    asserterror PostSalesOrder(_SalesHeader);
    Assert.ExpectedError('Customer No. must have a value');
end;
```

### Handler Functions

```al
[Test]
[HandlerFunctions('ConfirmHandler,MessageHandler')]
procedure TestPostWithConfirmation()
begin
    // Test that triggers confirm/message dialogs
end;

[ConfirmHandler]
procedure ConfirmHandler(Question: Text[1024]; var Reply: Boolean)
begin
    Reply := true;
end;

[MessageHandler]
procedure MessageHandler(Message: Text[1024])
begin
    // Capture or verify message
end;
```

## Test Coverage Requirements

| Area | Coverage Target |
|------|-----------------|
| Core business logic | 80%+ |
| Validation rules | 100% |
| Integration events | Key scenarios |
| Permission sets | Smoke tests |

## Test Libraries

**Always use standard library codeunits** to create data and post documents:

| Library | Purpose |
|---------|---------|
| `Assert` | Assertions (IsTrue, AreEqual, AreNotEqual, ExpectedError) |
| `Library - Sales` | Create customers, sales headers/lines, post sales documents |
| `Library - Purchase` | Create vendors, purchase headers/lines, post purchase documents |
| `Library - Inventory` | Create items, item journal lines, post inventory |
| `Library - ERM` | Create G/L accounts, currencies, payment terms |
| `Library - Random` | Generate random values (RandDec, RandInt, RandDate) |
| `Library - Utility` | General utilities |

**DO NOT manually create records** when library functions exist:

```al
// GOOD: Use library
LibrarySales.CreateCustomer(_Customer);
LibraryInventory.CreateItem(_Item);
LibrarySales.PostSalesDocument(_SalesHeader, true, true);

// BAD: Manual creation
_Customer.Init();
_Customer."No." := 'CUST001';
_Customer.Insert(true);
```

## Running Tests

```powershell
# Via AL Test Runner extension in VS Code
# Or via PowerShell:
Run-TestsInBCContainer -containerName bcserver -testCodeunit 50100
```
