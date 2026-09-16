# Method tests — what survives contact with price history

A method record says what somebody taught. This file says whether it holds. Nothing here
trades, nothing is preregistered, and no result below promotes a rule to anything.

Run: `python3 video-research/method_tests/<test>.py`. Data comes from Coinbase's free
public daily candles — the same endpoint `desk-loop` already uses. No key, no paid call.
Prices are recomputed from source on every run rather than cached, so a result cannot
quietly drift away from a stale copy.

---

## `ran-20w-50w-bear-regime-v1` — TESTED 2026-09-16

**The claim** (Ran Neuner, `CF7m0ited_Y` @ 00:11:24, 2025-11-27):

> "in bear markets, every time we've had a bear market, the 20-week and the 50-week have
> basically crossed each other ... in this interim dip over here, the one we had in 2021,
> the 50-week and the 20-week didn't cross each other on the way down. And until this chart
> crosses on the way down, I don't believe that we're going into a bear market."

**Why this one first:** it is the only extracted method so far that needs no chart reading.
Two moving averages on weekly closes and a stated invalidation. Everything else bottoms out
in a line drawn on a screen.

**Data:** 4,077 daily BTC-USD closes, 2015-07-20 to 2026-09-16 → 583 weekly closes.

### (a) Do bear markets show a downward cross? — 3 of 4, with one bad miss

| cross | BTC | +3mo | +6mo | +12mo | verdict |
|---|---|---|---|---|---|
| 2018-07-08 | 6,702 | −2.0% | **−39.7%** | +71.2% | correct (2018 bear) |
| **2020-03-01** | 8,522 | +10.8% | +37.5% | **+430.7%** | **FALSE POSITIVE (COVID)** |
| 2022-03-27 | 46,850 | −55.1% | **−59.9%** | −40.2% | correct (2022 bear) |
| 2026-01-25 | 86,562 | −9.1% | **−24.5%** | — | correct so far |

The 2020 cross is the one Ran does not mention, and it is the one that costs money: it
declared a bear market within days of the COVID bottom, ahead of a 430% year.

### (b) Did the 2021 interim dip avoid a cross? — CONFIRMED, and it is the strongest result

BTC fell **−47.0%** (59,985 → 31,788) and the 20-week never reached the 50-week. Closest
approach 2021-08-29: 20w at 42,394 against 50w at 35,808, still **+18.4% clear**.

A 47% drawdown that produces no regime signal is a genuinely useful property. This is the
part of the claim that earns the rule its keep.

### (c) "No cross means no bear market" — this one judges the speaker

By this rule we have been in a **bear regime since 2026-01-25**, and no upward cross has
printed since. Today: BTC 75,824, 20w 69,938, 50w 78,681.

He said the words above on 2025-11-27, in a video titled **"I SOLD EVERYTHING"** — sold
other assets to buy more crypto. **His own stated invalidation fired eight weeks later.**

| | BTC | vs entry |
|---|---|---|
| conservative entry (first close after publication, 2025-11-28) | 90,903 | — |
| his invalidation fires, 2026-01-25 | 86,562 | **−4.8%** |
| low since, 2026-06-30 | 58,524 | **−35.6%** |
| today | 75,824 | −16.6% |

**The rule was right and the conviction was wrong, and the rule was what protected you.**
Honouring his stated invalidation cost 4.8%. Believing his stated conviction cost 35.6% at
the low. That is a 31-point gap, and it is the single most useful number extracted from
this archive so far.

It also converges with what came out of Sheldon independently: the tradeable content these
presenters produce is the **risk rules**, not the market opinions. Here that is true even
when the same person supplies both, in the same video, thirty seconds apart.

### Verdict

**Useful as a regime label. Useless as an exit.** The signal arrives 28–65% below the cycle
top (2018: −65.4%, 2022: −28.5%, 2026: −29.9%). Anyone using it to get out is getting out
after the damage. Anyone using it to decide *what kind of market they are in* — how much
size, how much leverage, whether to be in leverage at all — gets a slow, low-noise answer
that ignored a 47% drawdown correctly once.

That is exactly the job the composed strategy assigns it: **Ran → regime filter**, feeding
Sheldon's sizing arithmetic. It is not an entry and must not be used as one.

### What would change this verdict

- Re-run on EMA rather than SMA. He says "moving average" here and "50-week SMA" earlier in
  the same video; simple is the reading taken, and the check has not been run.
- Weekly boundaries: ISO weeks over Coinbase UTC daily closes. TradingView's weekly candles
  can differ by a bar, which can move a cross date by a week. It does not move (b), where
  the clearance is 18.4%.
- Four crosses in eleven years is a very small sample. Three-of-four is not a hit rate, it
  is an anecdote with arithmetic attached. Testing on other assets and longer history is
  the obvious next step and has not been done.
