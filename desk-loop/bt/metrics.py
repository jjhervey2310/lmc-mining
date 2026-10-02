import math, statistics as st
from collections import defaultdict
from market_time import DAY


def summarize(result, bar_seconds=DAY):
    eq = result["equity"]; trades = result["trades"]
    if len(eq) < 2:
        return {"error": "no equity curve"}
    vals = [e for _, e in eq]
    rets = [vals[i] / vals[i - 1] - 1 for i in range(1, len(vals)) if vals[i - 1] > 0]
    years = (eq[-1][0] - eq[0][0]) / (365.25 * 86400) or 1e-9
    total = vals[-1] / vals[0] - 1
    peak, mdd = vals[0], 0.0
    for v in vals:
        peak = max(peak, v); mdd = min(mdd, v / peak - 1)
    per_year = 365.25 * 86400 / bar_seconds
    sharpe = (st.mean(rets) / st.pstdev(rets) * math.sqrt(per_year)) if len(rets) > 2 and st.pstdev(rets) > 0 else 0.0
    wins = [tr for tr in trades if tr.pnl > 0]
    gp = sum(tr.pnl for tr in wins); gl = -sum(tr.pnl for tr in trades if tr.pnl <= 0)
    by_year, by_sym = defaultdict(float), defaultdict(float)
    for tr in trades:
        import datetime as dt
        by_year[dt.datetime.utcfromtimestamp(tr.exit_t).year] += tr.pnl
        by_sym[tr.symbol] += tr.pnl
    return {
        "total_return": total, "cagr": (1 + total) ** (1 / years) - 1 if total > -1 else -1.0, "max_drawdown": mdd, "sharpe": sharpe,
        "trades": len(trades), "win_rate": len(wins) / len(trades) if trades else None,
        "avg_trade_ret": st.mean(tr.ret for tr in trades) if trades else None,
        "profit_factor": (gp / gl) if gl > 0 else (float("inf") if gp > 0 else None),
        "pnl_by_year": dict(by_year), "pnl_by_symbol": dict(by_sym),
        "pnl_ex_top": {n: sum(sorted((tr.pnl for tr in trades), reverse=True)[n:]) for n in (1, 3, 5)},
        "symbols_with_profit": sum(1 for v in by_sym.values() if v > 0), "years": years,
    }
