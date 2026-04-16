---
name: al-coding-style
description: "AL coding conventions — variable naming, declaration order, self-reference, error labels, file organization. Read before writing or reviewing AL code."
---

# AL Coding Style

## Variable Prefixes

| Scope | Prefix | Example |
|-------|--------|---------|
| **Global** | **(none)** | `Customer`, `totalAmount`, `CannotPostErr` |
| Local | `_` | `_Customer`, `_totalAmount`, `_CannotPostErr` |
| Temporary | `Temp` | `Temp_SalesLine`, `_Temp_SalesLine` |
| Parameter | `p` | `pCustomerNo`, `pSalesHeader` |
| Return value (named) | `r` | `rSuccess`, `rAmount` |

**Global variables (codeunit/table-level `var` block) get NO prefix.** Labels follow the same prefix rules as other variables.

## Variable Casing by Type

| Type | Casing | Examples |
|------|--------|----------|
| Object types (Record, Codeunit, Page, etc.) | Capital | `_Customer`, `pSalesHeader` |
| Primitive types (Decimal, Boolean, Text, etc.) | lowercase | `_totalAmount`, `pPostingDate` |

## Variable Declaration Order (AA0021)

Variables in `var` blocks must be ordered by type — complex/object types first, then simple types:

**Record → Report → Codeunit → XmlPort → Page → Query → Notification → BigText → DateFormula → RecordId → RecordRef → FieldRef → FilterPageBuilder** → then simple types (Text, Code, Integer, Decimal, Boolean, Date, Label, etc.)

## Named Return Values

Use named return values (`r` prefix) for complex functions that build up or operate on the return value. Simple one-liner functions can use `exit(value)`.

```al
// Named return for complex function
procedure CalculateCustomerBalance(pCustomerNo: Code[20]) rBalance: Decimal

// Simple function — standard return is fine
local procedure IsEnabled(): Boolean
```

## Object Naming

```al
table 50100 "ACME Customer Rating"
page 50100 "ACME Customer Rating Card"
codeunit 50100 "ACME Rating Management"
```

## Captions vs. Names

Captions must **never** include the mandatory affix. The affix is part of the object/field **name**, not the **caption**.

```al
// GOOD: Name has affix, Caption does not
field(50100; "Auto-Assign Lot No. KRL"; Boolean)
{
    Caption = 'Auto-Assign Lot No.';
}
```

## Self-Reference (`this.`)

**Always use `this.` when calling procedures within the same object.**

```al
procedure PostDocument(var pDocumentHeader: Record "Sales Header")
begin
    this.ValidateDocument(pDocumentHeader);
    this.CalculateTotals(pDocumentHeader);
end;
```

## Formatting

Use **2-space indentation** consistently.

## No Unnecessary `begin..end` (AA0005)

Only use `begin..end` to enclose **compound statements** (2+ statements). Single-statement blocks must not be wrapped:

```al
// WRONG
if _Customer.Find() then begin
  exit(true);
end;

// RIGHT
if _Customer.Find() then
  exit(true);
```

## Record Operations

- **SetLoadFields before every Find/Get** — see [AL Performance](../al-performance/SKILL.md) for mandatory rules
- **Find/Get return values always checked** — never assume a record exists
- **TestField** for mandatory field validation before processing
- **var parameter** only when the record is modified by the callee
- **No Commit() in event subscribers** — see [AL Patterns](../al-patterns/SKILL.md)

```al
// WRONG — unchecked Find
_Customer.Get(pCustomerNo);

// RIGHT — checked with error
if not _Customer.Get(pCustomerNo) then
  Error(_RecordNotFoundErr, _Customer.TableCaption(), _Customer.FieldCaption("No."), pCustomerNo);
```

## File Organization

- **One object per file**, named `Name.ObjectType.al` (e.g., `CustomerRating.Table.al`)
- **Feature-based folders** (by business feature, NOT by object type)
- Add to existing folders that match the feature. **Never** create new folders without user instruction.

## Error Labels (Mandatory)

ALL error messages must use Label variables with `TableCaption()` / `FieldCaption()` placeholders — never hardcoded table/field names.

```al
var
    _RecordNotFoundErr: Label 'Table %1 does not contain %2 = %3.', Comment = '%1 = Table name, %2 = Field name, %3 = Value';
begin
    Error(_RecordNotFoundErr, _Customer.TableCaption(), _Customer.FieldCaption("No."), pCustomerNo);
end;
```

Label guidelines:
- ALL messages must be translatable (no `Locked = true` for user-facing messages)
- Use `Comment` to explain all placeholders for translators
- Generic, reusable error patterns are preferred

## Cross-References

These critical rules are detailed in dedicated skills — agents must read them as part of Required Reading:
- **DataClassification on every field** — see [AL Security](../al-security/SKILL.md) (never use `ToBeClassified` in production)
- **SetLoadFields before every Find/Get** — see [AL Performance](../al-performance/SKILL.md)
- **Permission sets** — see [AL Security](../al-security/SKILL.md)
- **Event patterns & commit rules** — see [AL Patterns](../al-patterns/SKILL.md)
