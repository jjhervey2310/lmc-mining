# Desk integration tests (run with psql against the project; the Supabase MCP tool cannot run transactional tests)

Source: review R-2026-10-02-E (ChatGPT). Each test is fail-closed: a forced error after the destructive statement means
the transaction can never commit even if a protection is broken.

## T1 — TRUNCATE rejection (owner path proves the trigger; service_role path proves the REVOKE)
Before and after each: `count(*)` and `md5(string_agg(pk::text, ',' ORDER BY pk))` must be identical.
For each of `desk_watchlist`, `desk_watchlist_revisions`, `desk_selection_log`:
```sql
BEGIN; SET LOCAL lock_timeout = '2s';
TRUNCATE TABLE public.<table>;
SELECT 1/0;   -- must never be reached
ROLLBACK;
```
Expected (postgres/owner): SQLSTATE P0001 from `desk_reject()`: "TRUNCATE on <table> is not allowed - audit tables are append-only".
Same block with `SET LOCAL ROLE service_role;` after the lock_timeout → expected SQLSTATE 42501 insufficient_privilege.

## T2 — Revision counter under concurrency (two connections, one thesis at committed revision R)
```
A: BEGIN; UPDATE desk_watchlist SET claim='concurrency-A' WHERE thesis_id=:id;   -- holds the row lock, R+1 uncommitted
B: BEGIN; UPDATE desk_watchlist SET claim='concurrency-B' WHERE thesis_id=:id;   -- MUST block
A: ROLLBACK;                                                                      -- B wakes, re-reads R
B: COMMIT;
```
Assert: `desk_watchlist.revision = R+1`; exactly one new committed row in `desk_watchlist_revisions` with `(thesis_id, R+1)` and
`claim = 'concurrency-B'`; no `R+2`; A's audit row is gone with A's rollback. B visibly blocking is part of the assertion.
Variant (later): A commits R+1, B updates to R+2 then rolls back → final R+1, only A's revision present.

## Status
- T1/T2 specified 2026-10-02; not yet executed (needs psql — the MCP tool hangs on BEGIN/ROLLBACK blocks).
- `desk_selftest()` (in-function, non-TRUNCATE checks) passed 8/8 on 2026-10-02 — see REVIEW-LOG R-D.
