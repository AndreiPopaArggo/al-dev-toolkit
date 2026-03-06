---
name: al-deployment
description: Use when deployment target matters for design decisions. Covers SaaS vs OnPrem patterns, bulk read/write, periodic commits, LockTable, StartSession, SIFT.
---

# Deployment Target: SaaS vs OnPrem

The project's `CLAUDE.md` should declare the deployment target:
```
Deployment: SaaS | OnPrem | Both
```

When not declared, **ask the user**. Default assumptions do not apply — SaaS and OnPrem have conflicting optimization strategies.

## SaaS-Preferred Patterns

These patterns reduce Azure SQL round-trips and respect tenant isolation limits. Avoid on OnPrem unless the project targets Both.

### Bulk Read into Temp Table (Single Read Transaction)

Load all needed records in one read, then process from memory. Reduces network round-trips to Azure SQL.

```al
// Load once into temp table — one DB round-trip
procedure LoadCustomerEntries(pCustomerNo: Code[20]; var pTemp_CustLedgerEntry: Record "Cust. Ledger Entry" temporary)
var
    _CustLedgerEntry: Record "Cust. Ledger Entry";
begin
    pTemp_CustLedgerEntry.Reset();
    pTemp_CustLedgerEntry.DeleteAll();

    _CustLedgerEntry.SetRange("Customer No.", pCustomerNo);
    _CustLedgerEntry.SetLoadFields("Entry No.", "Posting Date", Amount);
    if _CustLedgerEntry.FindSet() then
        repeat
            pTemp_CustLedgerEntry := _CustLedgerEntry;
            pTemp_CustLedgerEntry.Insert();
        until _CustLedgerEntry.Next() = 0;
end;

// Process from memory — zero DB hits
procedure ProcessEntries(var pTemp_CustLedgerEntry: Record "Cust. Ledger Entry" temporary)
begin
    if pTemp_CustLedgerEntry.FindSet() then
        repeat
            this.ProcessEntry(pTemp_CustLedgerEntry);
        until pTemp_CustLedgerEntry.Next() = 0;
end;
```

**OnPrem warning:** Loading large tables into memory can exhaust NST process memory and affect all sessions on the same service tier. Use only for bounded datasets on OnPrem.

### Bulk Write Cache + Flush

Buffer modifications in a temp table, then write in a single transaction. Minimizes Azure SQL round-trips.

```al
procedure FlushBuffer(var pTemp_SalesLine: Record "Sales Line" temporary)
var
    _SalesLine: Record "Sales Line";
begin
    if pTemp_SalesLine.FindSet() then
        repeat
            _SalesLine := pTemp_SalesLine;
            _SalesLine.Insert();
        until pTemp_SalesLine.Next() = 0;
end;
```

**OnPrem warning:** Large single-transaction writes hold DB locks longer. On shared SQL Server instances this blocks concurrent users. Prefer smaller batches with periodic Commit on OnPrem.

### Batching Inserts

Group insert operations to reduce per-call latency overhead. Each individual `Insert` on SaaS incurs network round-trip cost to Azure SQL.

### Eliminate Periodic Commits

SaaS job queues have strict execution time limits and tenant isolation makes large transactions less problematic for concurrency. Remove periodic `Commit()` calls — they add transaction coordination overhead in Azure SQL.

### Avoid BLOB / Media in Bulk Queries

Binary field transfer is disproportionately expensive on SaaS due to data egress pricing. Load BLOB/Media fields individually with `CalcFields` only when needed (see `performance.md`).

## OnPrem-Preferred Patterns

These patterns manage SQL Server lock contention on shared instances. Avoid on SaaS unless the project targets Both.

### Periodic Commits (Lock Release)

In long-running batch jobs, commit periodically to release SQL Server locks and prevent blocking other sessions.

```al
procedure ProcessLargeDataset(pDocumentNo: Code[20])
var
    _SalesLine: Record "Sales Line";
    _lineCount: Integer;
begin
    _SalesLine.SetRange("Document No.", pDocumentNo);
    _SalesLine.SetLoadFields("Document No.", Amount);
    if _SalesLine.FindSet() then
        repeat
            this.ProcessLine(_SalesLine);
            _lineCount += 1;
            if _lineCount mod 1000 = 0 then
                Commit();
        until _SalesLine.Next() = 0;
end;
```

**SaaS warning:** Excessive commits hurt performance due to Azure SQL transaction coordination overhead. SaaS tenant isolation already prevents cross-tenant lock issues.

**Reminder:** Never use `Commit()` inside event subscribers on any platform.

### Manual COMMIT Checkpointing

For long-running jobs (data migration, batch recalculation), commit at logical checkpoints to allow resumability and release locks.

```al
procedure MigrateBatch(pFromEntryNo: Integer; pBatchSize: Integer)
var
    _LedgerEntry: Record "G/L Entry";
begin
    _LedgerEntry.SetRange("Entry No.", pFromEntryNo, pFromEntryNo + pBatchSize - 1);
    _LedgerEntry.SetLoadFields("Entry No.", Amount, "Posting Date");
    if _LedgerEntry.FindSet() then
        repeat
            this.MigrateEntry(_LedgerEntry);
        until _LedgerEntry.Next() = 0;

    Commit();  // Checkpoint — work so far is saved, locks released
end;
```

### Explicit LockTable

Use `LockTable` before mass updates under concurrent user load to establish lock order early and prevent deadlocks.

```al
procedure UpdateCustomerBalances()
var
    _Customer: Record Customer;
begin
    _Customer.LockTable();
    _Customer.SetRange("Country/Region Code", 'US');
    _Customer.SetLoadFields("No.", "Credit Limit (LCY)");
    if _Customer.FindSet(true) then
        repeat
            this.RecalculateBalance(_Customer);
            _Customer.Modify();
        until _Customer.Next() = 0;
end;
```

**SaaS warning:** Tenant isolation makes this largely unnecessary. `LockTable` on SaaS adds overhead without meaningful deadlock prevention.

### StartSession for Parallel Processing

OnPrem allows spawning parallel sessions since you control SQL Server resources.

```al
procedure ProcessInParallel()
var
    _SalesHeader: Record "Sales Header";
    _sessionId: Integer;
begin
    _SalesHeader.SetRange("Document Type", _SalesHeader."Document Type"::Order);
    _SalesHeader.SetRange(Status, _SalesHeader.Status::Released);
    _SalesHeader.SetLoadFields("No.", "Document Type", Status);
    if _SalesHeader.FindSet() then
        repeat
            StartSession(_sessionId, Codeunit::"Order Processor", CompanyName, _SalesHeader);
        until _SalesHeader.Next() = 0;
end;
```

**SaaS warning:** Background sessions are billable and the platform aggressively limits parallelism to protect shared resources.

### SIFT / SumIndexFields Optimization

OnPrem gives full control over SQL Server indexes. Use SumIndexFields on keys for frequently aggregated columns.

```al
keys
{
    key(PK; "Entry No.") { Clustered = true; }
    key(CustomerDate; "Customer No.", "Posting Date")
    {
        SumIndexFields = Amount, "Amount (LCY)";
    }
}
```

**SaaS warning:** AppSource validation restricts the number of keys per table. SaaS governance limits custom index creation.

## Platform Decision Matrix

| Pattern | SaaS | OnPrem | Both |
|---------|------|--------|------|
| SetLoadFields | Mandatory (high priority) | Mandatory | Mandatory |
| SetAutoCalcFields | Preferred | Preferred | Preferred |
| Temp table bulk read | Preferred (bounded datasets) | Caution (memory) | Case-by-case |
| Bulk write + flush | Preferred | Caution (lock duration) | Case-by-case |
| Periodic Commit | Avoid | Preferred (batch jobs) | Per-platform `if` |
| LockTable | Avoid | Use for mass updates | Per-platform `if` |
| StartSession parallelism | Avoid | Preferred | Per-platform `if` |
| SIFT / SumIndexFields | Limited by AppSource | Full control | Minimal keys |
| BLOB/Media in loops | Avoid strictly | Avoid when possible | Avoid |
