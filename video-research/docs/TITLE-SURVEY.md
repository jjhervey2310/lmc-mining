# Title survey — The Sniper Crypto Trading Show

**Run 2026-09-13 from the session container. Costs nothing, needed no transcripts.**

Flat playlist enumeration is not bot-gated (only the per-video player API is), so titles
are reachable even while the caption path is blocked. This survey uses that to answer a
cheap question before spending anything on a paid extraction batch: **which videos are
worth processing first?**

## What was measured

906 of the playlist's 907 known entries; 904 carry a usable title.

**This enumeration is NOT provably complete.** yt-dlp reported
`Incomplete data received. Giving up after 3 retries` and returned 906 where the stored
membership count is 907. The one missing entry is not identified. Nothing below is
therefore stated as a share of the playlist — the counts are counts, over 904 titles
actually read.

## Term frequency across 904 titles

| Term | Titles |
|---|---|
| `stop loss` / `stop-loss` / `stoploss` | **0** |
| `invalidation` (any form) | **0** |
| `position siz*` | **0** |
| `risk/reward`, `R:R` | **0** |
| `backtest` | **0** |
| `risk management` | 1 |
| `leverage` | 8 |
| `tutorial` | 7 |
| `how I` | 7 |
| `how to` | 14 |
| `strategy` | 16 |

**A title is marketing, not content.** Zero occurrences of "stop loss" does not establish
that no stop is ever stated on the show — it establishes that stating one is never the
thing the title sells. That is a weaker claim and it is the only one the data supports.
Whether stops are stated in the videos is a transcript question, still unanswered.

## The ranking surfaced a sampling trap

Scoring titles for method signal puts exchange tutorials on top — and 8 of the 10
leverage/tutorial titles name an exchange brand (Bitget, BTCC, LBank, CoinW, WEEX, OKX):

| Score | Video | Title |
|---|---|---|
| 10 | `JsAGixuGDlU` | Bitget Leverage Trading Tutorial For Beginners (Risk Management…) |
| 9 | `n00q6FIhj-k` | Learn How To Leverage Trade With BTCC!! |
| 6 | `AHzf8YeJdW4` | LBank Leverage Tutorial For Beginner Cryto Traders |
| 6 | `DHeRbUsktNE` | Beginner Crypto Leverage Trading Tutorial On CoinW! |
| 6 | `W08sYU5gka0` | Beginner Crypto Leverage Trading Tutorial On WEEX! |

These are affiliate placements. They teach an exchange's order ticket, not a trading
method, and the extractor already classifies that shape as `SPONSORED_PROMOTIONAL`.
**A naive "most method-sounding titles first" batch would have spent its budget on
sponsored content and concluded the show teaches nothing.** The keyword that looks most
like rigour — "risk management" — appears in this corpus mainly as a tutorial feature
list.

## Revised first batch

Sponsored tutorials excluded. Highest method signal that is not an exchange placement:

| Video | Len | Title |
|---|---|---|
| `O29x5SAFdwM` | 29m | How To Effectively Trade The Bitcoin Range! \| Crypto Range Trading Strategy! |
| `SroO3Ko05Vc` | 37m | HOW TO PLAY THE CRYPTO MARKET BOUNCE? (BEST 3 STRATEGIES REVEALED) |
| `2pFmhySK21M` | 61m | I'M TAKING THESE 3 ALTCOIN TRADES! (Entry & Take Profit) |
| `d1nh7Qn_eQ0` | 13m | Bitcoin Short Exit Strategy In Play (+ Next Trade Revealed) |
| `NsSLRlIvWdc` | 15m | THIS is When I Leverage LONG Bitcoin (Exact Targets) |
| `G1SnQBa0-yg` | 20m | Exactly How I'm Positioning My Crypto For Q1 2026 Now! |

Six videos, ~2.9 hours. Two of them ("Exact Targets", "Entry & Take Profit") promise the
specific thing a testable rule requires, which is the strongest title-level evidence in
the corpus that an invalidation might be stated aloud.

## What this does and does not settle

- **Settles:** which videos to fetch first, and that the obvious ranking is a trap.
- **Does not settle:** whether any method in this archive states an invalidation. That
  needs the transcripts, which need a non-gated IP.

No method record, hypothesis or call was created by this survey. It reads titles only.
