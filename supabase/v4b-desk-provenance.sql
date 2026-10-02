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

-- R-2026-10-02-C: benchmark dimension, reference class vs forecast, one monitoring convention per thesis.
ALTER TABLE desk_watchlist ADD COLUMN IF NOT EXISTS reference_class_rate NUMERIC, ADD COLUMN IF NOT EXISTS reference_class_ref TEXT, ADD COLUMN IF NOT EXISTS thesis_probability NUMERIC, ADD COLUMN IF NOT EXISTS probability_adjustment_note TEXT, ADD COLUMN IF NOT EXISTS monitoring_convention TEXT;
ALTER TABLE desk_paper_ledger ADD COLUMN IF NOT EXISTS monitoring_convention TEXT, ADD COLUMN IF NOT EXISTS btc_entry_px NUMERIC, ADD COLUMN IF NOT EXISTS btc_exit_px NUMERIC, ADD COLUMN IF NOT EXISTS alt_net_return NUMERIC, ADD COLUMN IF NOT EXISTS btc_net_return NUMERIC, ADD COLUMN IF NOT EXISTS excess_return_pp NUMERIC, ADD COLUMN IF NOT EXISTS max_drawdown NUMERIC, ADD COLUMN IF NOT EXISTS evidence_class TEXT NOT NULL DEFAULT 'exploratory';

-- R-2026-10-02-D hardening (applied in small execute_sql steps)
ALTER TABLE desk_watchlist ADD COLUMN IF NOT EXISTS thesis_id UUID NOT NULL DEFAULT gen_random_uuid(), ADD COLUMN IF NOT EXISTS revision INT NOT NULL DEFAULT 1;
CREATE UNIQUE INDEX IF NOT EXISTS desk_watchlist_thesis_id_uq ON desk_watchlist (thesis_id);
ALTER TABLE desk_watchlist_revisions ADD COLUMN IF NOT EXISTS thesis_id UUID;
ALTER TABLE desk_paper_ledger ADD COLUMN IF NOT EXISTS thesis_id UUID;
CREATE OR REPLACE FUNCTION public.desk_watchlist_guard() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
BEGIN
  IF NEW.thesis_id IS DISTINCT FROM OLD.thesis_id THEN RAISE EXCEPTION 'thesis_id is immutable'; END IF;
  IF NEW.symbol IS DISTINCT FROM OLD.symbol THEN RAISE EXCEPTION 'a different asset is a new thesis - symbol is immutable (use a linked correction)'; END IF;
  NEW.revision := OLD.revision + 1; NEW.updated_at := now(); RETURN NEW;
END $fn$;
CREATE OR REPLACE FUNCTION public.desk_watchlist_audit() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
BEGIN
  INSERT INTO public.desk_watchlist_revisions (thesis_id, symbol, revision, op, snapshot) VALUES (NEW.thesis_id, NEW.symbol, NEW.revision, TG_OP, to_jsonb(NEW));
  RETURN NEW;
END $fn$;
CREATE OR REPLACE FUNCTION public.desk_reject() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
BEGIN RAISE EXCEPTION '% on % is not allowed - audit tables are append-only', TG_OP, TG_TABLE_NAME; END $fn$;
CREATE OR REPLACE TRIGGER desk_watchlist_guard_trg BEFORE UPDATE ON public.desk_watchlist FOR EACH ROW EXECUTE FUNCTION public.desk_watchlist_guard();
CREATE OR REPLACE TRIGGER desk_revisions_append_only BEFORE UPDATE OR DELETE ON public.desk_watchlist_revisions FOR EACH ROW EXECUTE FUNCTION public.desk_reject();
CREATE OR REPLACE TRIGGER desk_revisions_no_truncate BEFORE TRUNCATE ON public.desk_watchlist_revisions FOR EACH STATEMENT EXECUTE FUNCTION public.desk_reject();
CREATE OR REPLACE TRIGGER desk_selection_append_only BEFORE UPDATE OR DELETE ON public.desk_selection_log FOR EACH ROW EXECUTE FUNCTION public.desk_reject();
CREATE OR REPLACE TRIGGER desk_selection_no_truncate BEFORE TRUNCATE ON public.desk_selection_log FOR EACH STATEMENT EXECUTE FUNCTION public.desk_reject();
CREATE OR REPLACE TRIGGER desk_watchlist_no_truncate BEFORE TRUNCATE ON public.desk_watchlist FOR EACH STATEMENT EXECUTE FUNCTION public.desk_reject();
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.desk_watchlist_revisions FROM anon, authenticated, service_role;
REVOKE UPDATE, DELETE, TRUNCATE ON public.desk_selection_log FROM anon, authenticated, service_role;
REVOKE DELETE, TRUNCATE ON public.desk_watchlist FROM anon, authenticated, service_role;
CREATE UNIQUE INDEX IF NOT EXISTS desk_watchlist_revisions_uq ON public.desk_watchlist_revisions (thesis_id, revision);
