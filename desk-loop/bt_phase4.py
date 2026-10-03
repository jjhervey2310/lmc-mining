#!/usr/bin/env python3
"""Run the FROZEN Phase 4 tournament (bt/phase4.py) once on a frozen snapshot and write the report to --out.
Never writes to research_runs (§8: nothing is stored before independent review); no store option exists on purpose.
  python3 bt_phase4.py --export state/md_daily_2026-10-02.json      # publishable key (SUPABASE_PUBLISHABLE_KEY) + SELECT policies; never a service-role key
  python3 bt_phase4.py --snapshot state/md_daily_2026-10-02.json --out state/phase4
"""
import argparse, json, os, sys
from bt import load, phase4

p = argparse.ArgumentParser()
p.add_argument("--snapshot", help="frozen JSON snapshot (data_hash must match the pre-registered one to count)")
p.add_argument("--export", help="pull md_candles + universe_history with the publishable key and write this snapshot path, then exit")
p.add_argument("--out", default="state/phase4", help="directory for table.json, table.md and one manifest per candidate")
p.add_argument("--only", default=None, help="comma list of candidates (debugging a run; the table is only the full set)")
p.add_argument("--fit-days", type=int, default=phase4.FIT_DAYS)
p.add_argument("--test-days", type=int, default=phase4.TEST_DAYS)
p.add_argument("--no-regime", action="store_true", help="skip the per-state attribution (labels are descriptive only)")
p.add_argument("--expect-data-hash", default=None, help="refuse to run unless the snapshot's data_hash equals this")
a = p.parse_args()

if a.export:
    load.snapshot(load.load_md_candles(), load.load_universe(), a.export); print("snapshot", a.export); sys.exit(0)
if not a.snapshot:
    sys.exit("--snapshot is required (Phase 4 runs on the frozen snapshot only)")
market = load.load_snapshot(a.snapshot)
if a.expect_data_hash and market.fingerprint() != a.expect_data_hash:
    sys.exit(f"refused: snapshot data_hash {market.fingerprint()} != expected {a.expect_data_hash}")
print(f"snapshot {a.snapshot} data_hash {market.fingerprint()} universe_hash {market.universe_fingerprint()} symbols {len(market.symbols())}")
if (a.fit_days, a.test_days) != (phase4.FIT_DAYS, phase4.TEST_DAYS):
    print("WARNING: non-pre-registered windows — this is a debugging run, not the table")
table = phase4.run_table(market, a.only.split(",") if a.only else None, a.fit_days, a.test_days, data_vintage=os.path.basename(a.snapshot), with_regime=not a.no_regime)
os.makedirs(a.out, exist_ok=True)
with open(os.path.join(a.out, "table.json"), "w") as f:
    json.dump(table, f, indent=1, default=str)
for name, man in table["candidates"].items():
    with open(os.path.join(a.out, f"{name}.json"), "w") as f:
        json.dump(man, f, indent=1, default=str)
md = phase4.render_table(table)
with open(os.path.join(a.out, "table.md"), "w") as f:
    f.write(md + "\n")
print(md)
print(f"written to {a.out}/ — nothing stored to research_runs (independent review first)")
