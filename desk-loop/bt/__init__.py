"""Backtest framework (Phase 2). Look-ahead is a type error here: strategies only ever see an AsOfView, which
cannot return a bar that had not completed at the decision time. Fills happen on the NEXT bar's open with
explicit costs. Every run writes a manifest (hashes, costs, fill rule, folds, seeds, metrics, gate verdict)."""
