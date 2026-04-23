---
name: al-coding-style
description: "AL coding conventions — variable naming, declaration order, self-reference, error labels, file organization. Read before writing or reviewing AL code."
user-invocable: false
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

## Variable Scope (Global vs Local)

Declare variables and Labels at the **narrowest scope where they are used**. If something is referenced by only one procedure, put it in that procedure's `var` block — not in the object-level `var`.

| Used from | Declare where |
|-----------|---------------|
| Multiple procedures in the object | Object-level `var` (global) |
| One procedure only | That procedure's `var` (local) |

This applies to variables, Labels, and temp records. A Label used by only one procedure moves to that procedure's local `var` and picks up the `_` prefix per the prefix rules above.

```al
// WRONG — RatingCalcErr used only inside CalculateRating, should be local
codeunit 50100 "Rating Management"
{
    var
        RatingCalcErr: Label 'Rating cannot be calculated for %1', Comment = '%1 = Customer No.';

    procedure CalculateRating(pCustomerNo: Code[20]): Decimal
    begin
        Error(RatingCalcErr, pCustomerNo);
    end;
}

// RIGHT — local to the one procedure that uses it
procedure CalculateRating(pCustomerNo: Code[20]): Decimal
var
    _RatingCalcErr: Label 'Rating cannot be calculated for %1', Comment = '%1 = Customer No.';
begin
    Error(_RatingCalcErr, pCustomerNo);
end;
```

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

## Blank Captions

Blank captions — a single space like `Caption = ' '` — exist only for UI layout (e.g., intentionally empty column headers) and are not user-facing text. They **must** be marked `Locked = true` so translators skip them and the AL compiler stops flagging AA0228.

```al
// WRONG — blank caption without Locked triggers AA0228
field(50100; "Spacer KRL"; Text[10])
{
    Caption = ' ';
}

// RIGHT
field(50100; "Spacer KRL"; Text[10])
{
    Caption = ' ', Locked = true;
}
```

This is the only case where `Locked = true` is allowed on a caption — regular user-facing captions must stay translatable.

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

## `Comment` Property — Placeholders Only

The `Comment` property on Labels, ToolTips, and Captions has exactly one job: explaining placeholders (`%1`, `%2`, ...) to translators. If the string has no placeholders, omit `Comment` entirely. Never emit a placeholder stub like `Comment = '%'` — it adds noise and misleads translators.

```al
// WRONG — ToolTip has no placeholders, Comment is a meaningless stub
ToolTip = 'Specifies the value of the Internal Inv. Curr. Factor field.', Comment = '%';

// RIGHT — no placeholders → no Comment
ToolTip = 'Specifies the value of the Internal Inv. Curr. Factor field.';

// RIGHT — Comment required because placeholders exist
_RecordNotFoundErr: Label 'Table %1 does not contain %2 = %3.',
    Comment = '%1 = Table name, %2 = Field name, %3 = Value';
```

## Build After Editing

Every `.al` edit must be followed by a build before the turn ends: call #ms-dynamics-smb.al/al_build({scope:"current"}) then #ms-dynamics-smb.al/al_get_diagnostics({scope:"current", severities:["error","warning"]}) to retrieve the typed diagnostic list. Drive **both errors and warnings** on the files you touched to zero — CodeCop (AA0xxx), AppSource (AS0xxx), and compiler warnings count as must-fix unless the user has explicitly accepted one. Do not declare a change done with an unbuilt or warning-laden file.

**Exception:** when you are dispatched as a coder subagent with `[DISPATCH_CONTEXT: orchestrated]` in your prompt, the orchestrator runs the build after you return — do NOT build yourself.

## Cross-References

These critical rules are detailed in dedicated skills — agents must read them as part of Required Reading:
- **DataClassification on every field** — see [AL Security](../al-security/SKILL.md) (never use `ToBeClassified` in production)
- **SetLoadFields before every Find/Get** — see [AL Performance](../al-performance/SKILL.md)
- **Permission sets** — see [AL Security](../al-security/SKILL.md)
- **Event patterns & commit rules** — see [AL Patterns](../al-patterns/SKILL.md)
