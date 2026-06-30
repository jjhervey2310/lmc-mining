-- =============================================================
-- Hashprice Historical Snapshots
-- Run in Supabase SQL editor (Dashboard → SQL Editor → New Query)
-- =============================================================

CREATE TABLE IF NOT EXISTS hashprice_snapshots (
  id            BIGSERIAL PRIMARY KEY,
  snapshot_date DATE        NOT NULL,
  btc_price     NUMERIC(12, 2) NOT NULL,
  difficulty    NUMERIC(20, 0) NOT NULL,
  hashprice_usd NUMERIC(12, 4) NOT NULL,  -- $/PH/day
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- One row per day — prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS hashprice_snapshots_date_unique
  ON hashprice_snapshots (snapshot_date);

ALTER TABLE hashprice_snapshots ENABLE ROW LEVEL SECURITY;

-- Chart data is not sensitive — allow public read
CREATE POLICY "Public read hashprice_snapshots"
  ON hashprice_snapshots FOR SELECT
  USING (true);

-- Service role key (used by the cron API route) bypasses RLS automatically;
-- this policy covers any future anon writes if needed
CREATE POLICY "Service insert hashprice_snapshots"
  ON hashprice_snapshots FOR INSERT
  WITH CHECK (true);
