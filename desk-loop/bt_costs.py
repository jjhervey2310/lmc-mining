"""EXPLICIT COST MODEL for backtests. No venue has a built-in default: the caller states the fees it is
testing against and the record travels with the result (research_runs / pa_memory), so a number can
never be quoted without the tier it assumed. Fractions, not percent: 0.0022 == 0.22%."""
import argparse
import dataclasses
import os


@dataclasses.dataclass(frozen=True)
class CostModel:
    maker_fee: float
    taker_fee: float
    spread: float = 0.0      # half-spread paid per side on a market fill
    slippage: float = 0.0    # extra per-side impact, size-dependent in reality; a constant here
    venue: str = "unspecified"
    tier: str = "unspecified"
    note: str = ""

    def __post_init__(self):
        for f in ("maker_fee", "taker_fee", "spread", "slippage"):
            v = getattr(self, f)
            if v is None or v < 0 or v >= 0.1:
                raise ValueError(f"{f}={v!r}: give a fraction in [0, 0.1) (0.0022 == 0.22%)")

    def per_side(self, taker: bool = True) -> float:
        """Total one-way cost fraction for a fill."""
        return (self.taker_fee if taker else self.maker_fee) + self.spread + self.slippage

    def round_trip(self, taker: bool = True) -> float:
        return 2 * self.per_side(taker)

    def as_record(self) -> dict:
        return dataclasses.asdict(self)


def stamp(c: CostModel, fill_rule: str) -> str:
    """One header line for a text result so the assumptions travel with the numbers."""
    return (f"ASSUMPTIONS | costs={c.as_record()} | fill={fill_rule} | "
            f"bars=completed only (market_time.completed_bars), joins by timestamp\n")


def add_cost_args(p: argparse.ArgumentParser) -> argparse.ArgumentParser:
    """Shared CLI flags. Required on purpose: a backtest without stated costs is not a result."""
    p.add_argument("--maker-fee", type=float, required=True, help="fraction, e.g. 0.0022")
    p.add_argument("--taker-fee", type=float, required=True, help="fraction, e.g. 0.0038")
    p.add_argument("--spread", type=float, default=0.0)
    p.add_argument("--slippage", type=float, default=0.0)
    p.add_argument("--venue", default="unspecified")
    p.add_argument("--tier", default="unspecified", help="the fee tier these numbers came from")
    return p


def from_args(a) -> CostModel:
    return CostModel(a.maker_fee, a.taker_fee, a.spread, a.slippage, a.venue, a.tier)


def from_env() -> CostModel:
    """BT_MAKER_FEE / BT_TAKER_FEE (required), BT_SPREAD, BT_SLIPPAGE, BT_VENUE, BT_TIER."""
    try:
        return CostModel(float(os.environ["BT_MAKER_FEE"]), float(os.environ["BT_TAKER_FEE"]),
                         float(os.environ.get("BT_SPREAD", 0)), float(os.environ.get("BT_SLIPPAGE", 0)),
                         os.environ.get("BT_VENUE", "unspecified"), os.environ.get("BT_TIER", "unspecified"))
    except KeyError as e:
        raise SystemExit(f"backtest refused: set {e.args[0]} (and BT_TAKER_FEE/BT_MAKER_FEE) — costs must be explicit")
