import json
from common import sb_upsert


def save_run(man):
    """Write the manifest to research_runs. Dates come from the equity curve when present."""
    row = {k: man.get(k) for k in ("run_id", "strategy", "params", "config_hash", "code_sha", "data_hash", "universe_hash", "data_vintage", "costs", "fill_rule", "folds", "seeds", "trial_count", "metrics", "robustness", "gate", "verdict", "notes")}
    row["params"] = row["params"] or {}
    return sb_upsert("research_runs", [json.loads(json.dumps(row, default=str))], "run_id")
