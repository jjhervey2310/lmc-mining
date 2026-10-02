-- =============================================================
-- Crypto desk — thesis provenance (review R-2026-10-02-B). Applied 2026-10-02 in small execute_sql batches
-- (the MCP tool times out on large payloads). Additive only.
-- =============================================================
CREATE TABLE IF NOT EXISTS desk_watchlist_revisions (rev_id BIGSERIAL PRIMARY KEY, symbol TEXT NOT NULL, revision INT NOT NULL, op TEXT NOT NULL, snapshot JSONB NOT NULL, recorded_at TIMESTAMPTZ NOT NULL DEFAULT now());
ALTER TABLE desk_watchlist_revisions ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS desk_selection_log (id BIGSERIAL PRIMARY KEY, pass_at TIMESTAMPTZ NOT NULL DEFAULT now(), author TEXT NOT NULL DEFAULT 'claude', pool_source TEXT NOT NULL, pool_symbols TEXT[] NOT NULL, selected TEXT[] NOT NULL, rejected JSONB NOT NULL, criteria TEXT NOT NULL, notes TEXT);
ALTER TABLE desk_selection_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE desk_paper_ledger ADD COLUMN IF NOT EXISTS rule_version TEXT NOT NULL DEFAULT 'v0', ADD COLUMN IF NOT EXISTS fee_model JSONB, ADD COLUMN IF NOT EXISTS decided_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE desk_watchlist ADD COLUMN IF NOT EXISTS claim TEXT, ADD COLUMN IF NOT EXISTS used_in_scanner_dev BOOLEAN NOT NULL DEFAULT false;

-- Every insert/update of a thesis is an immutable revision; deletes are refused (close with active=false).
CREATE OR REPLACE FUNCTION desk_watchlist_audit() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $fn$
BEGIN
  INSERT INTO desk_watchlist_revisions (symbol, revision, op, snapshot)
  VALUES (NEW.symbol, (SELECT COALESCE(max(revision), 0) + 1 FROM desk_watchlist_revisions r WHERE r.symbol = NEW.symbol), TG_OP, to_jsonb(NEW));
  RETURN NEW;
END
$fn$;
CREATE OR REPLACE FUNCTION desk_watchlist_no_delete() RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
BEGIN
  RAISE EXCEPTION 'desk_watchlist rows are never deleted - set active=false instead';
END
$fn$;
CREATE OR REPLACE TRIGGER desk_watchlist_audit_trg AFTER INSERT OR UPDATE ON desk_watchlist FOR EACH ROW EXECUTE FUNCTION desk_watchlist_audit();
CREATE OR REPLACE TRIGGER desk_watchlist_no_delete_trg BEFORE DELETE ON desk_watchlist FOR EACH ROW EXECUTE FUNCTION desk_watchlist_no_delete();
