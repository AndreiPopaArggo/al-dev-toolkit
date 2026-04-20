---
name: al-security
description: Use when creating tables, handling credentials, or setting up permissions. Covers permission sets, DataClassification (GDPR), credential handling with SecretText, indirect permissions.
---

# AL Security Guidelines

## Permission Sets

```al
permissionset 50100 "ACME Basic"
{
    Assignable = true;
    Caption = 'ACME Basic Permissions';

    Permissions =
        tabledata "Customer Rating" = RIMD,
        tabledata "Rating History" = RI,
        table "Customer Rating" = X,
        codeunit "Rating Service" = X,
        page "Customer Rating Card" = X;
}
```

## Permission Levels

| Permission | Meaning |
|------------|---------|
| R | Read |
| I | Insert |
| M | Modify |
| D | Delete |
| X | Execute (objects) |

## Regenerating Permission Sets

Prefer **regenerating** the permission set over editing it by hand. VS Code's AL extension provides the command **`AL: Generate permission set as AL object containing current extension objects`** (Command Palette → search `gen perm`). Run it whenever the extension's object set has changed — it emits the full `Permissions = ...` block with entries already grouped by object type.

**Regenerate when:**
- New objects were added to the extension
- Objects were renamed or deleted
- The permission set is out of sync with the current object set

**Hand-edit only for:**
- Tweaking permission levels (`RIMD` → `RI`) on an existing entry
- Editing a `permissionsetextension` where the base set is owned by another extension

When hand-editing, keep entries grouped by object type — new entries go into the existing group for that type, not at the end. Order between groups is free.

## Data Classification (GDPR)

```al
table 50100 "Customer Contact"
{
    fields
    {
        field(1; "No."; Code[20])
        {
            DataClassification = CustomerContent;
        }
        field(2; "Email"; Text[80])
        {
            DataClassification = EndUserIdentifiableInformation;
        }
        field(3; "Phone No."; Text[30])
        {
            DataClassification = EndUserIdentifiableInformation;
        }
        field(4; "Internal Notes"; Text[250])
        {
            DataClassification = OrganizationIdentifiableInformation;
        }
    }
}
```

### Classification Types

| Type | Use For |
|------|---------|
| `CustomerContent` | Business data |
| `EndUserIdentifiableInformation` | Personal data (PII) |
| `EndUserPseudonymousIdentifiers` | Indirect identifiers |
| `OrganizationIdentifiableInformation` | Company data |
| `SystemMetadata` | System-generated data |
| `ToBeClassified` | Not yet classified (avoid in production) |

## Mandatory Security Checks

Before ANY commit:
- [ ] No hardcoded credentials or connection strings
- [ ] DataClassification set on all table fields
- [ ] Permission sets defined for new objects
- [ ] Indirect permissions used where appropriate
- [ ] No COMMIT in event subscribers
- [ ] HttpClient requests use SecretText for credentials
- [ ] Sensitive data not exposed in error messages

## Credential Handling

```al
// NEVER: Hardcoded secrets
_HttpClient.DefaultRequestHeaders.Add('Authorization', 'Bearer sk-xxxxx');

// CORRECT: Use Isolated Storage or Azure Key Vault
procedure GetApiKey(): SecretText
var
    _AzureKeyVault: Codeunit "Azure Key Vault";
    _secretValue: SecretText;
    rApiKey: SecretText;
begin
    if _AzureKeyVault.GetAzureKeyVaultSecret('ApiKey', _secretValue) then
        exit(_secretValue);
    Error(ApiKeyNotFoundErr);
end;

// Using SecretText with HttpClient
var
    _HttpClient: HttpClient;
    _apiKey: SecretText;
    _authHeader: SecretText;
begin
    _apiKey := GetApiKey();
    _authHeader := SecretStrSubstNo('Bearer %1', _apiKey);
    _HttpClient.DefaultRequestHeaders.Add('Authorization', _authHeader);
end;
```

## Indirect Permissions

**Object-level** (old syntax, still valid):
```al
codeunit 50100 "Rating Service"
{
    Permissions = tabledata "Customer Rating" = RIMD;
}
```

**Procedure-level** with `[InherentPermissions]` (BC22+, preferred for granular control):
```al
codeunit 50100 "Rating Service"
{
    [InherentPermissions(PermissionObjectType::TableData, Database::"Customer Rating", 'rimd')]
    procedure UpdateRating(pCustomerNo: Code[20])
    begin
        // Only this procedure gets elevated permissions
    end;
}
```

## Security Response Protocol

If security issue found:
1. STOP immediately
2. Review permission sets for over-exposure
3. Check DataClassification on affected tables
4. Verify credential storage (no hardcoded secrets)
5. Review HttpClient usage for secure headers
6. Use **code-reviewer** agent for comprehensive audit (security is part of its checklist)
