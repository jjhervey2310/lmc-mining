# Lightning Mines — Weekly Sunday Deep Dive

_Standing template, run every Sunday evening (a Routine fires it automatically).
First full-week deep dive on the new format: **Aug 2**. The Jul 26 run is a
5-day early read — directional only, don't decide on it._

**The one question this answers:** did *shorter (~30s) + "Lightning Mines" at the open + bullish-with-a-caveat* retain attention better than the old long format?
**The metric that decides it:** watch-through (retention) — **not** views or followers.
**New-format week under test:** ~Jul 24 → Aug 2 (first new-format post landed ~2 days after the 7/22 merge, once the old Postiz queue drained).
**Decision output:** KEEP · ADJUST · REVERT — plus one lesson written into `BRAND.md`.

---

## ⚠️ Read this before you look at any number
Three honesty guardrails, because it's easy to fool yourself at this size:

1. **Single-digit views = inconclusive.** Baseline (7/17) was 1–3 views per Short. Watch-through % on 2 views is meaningless. **If total video views across the week are under ~30–50, the honest call is INCONCLUSIVE — extend the test 2 more weeks, don't decide.**
2. **You changed 4 things at once** (length, hook, brand-at-open, accent fix). If retention moves, you can't cleanly credit one lever. Note it; don't over-attribute.
3. **The accent bug muddies the "before."** Some old videos rendered Australian — that alone could have hurt old-format retention. So a new-vs-old win might be "fixed the voice," not "shorter is better." Keep this in mind when reading the delta.

Rule from BRAND.md: **react to patterns across 5+ videos, never a single video.**

---

## Part A — Pull per-video data (new-format week)
One row per video. Where each retention number lives:

| Platform | Where to find watch-through |
|---|---|
| **YouTube Shorts** | Studio → Content → the Short → Analytics → **Average view duration** + the retention curve ("viewed vs swiped away"); note the **first-3s hold** |
| **TikTok** | Creator tools → Analytics → the video → **Average watch time** + **Watched full video %** + **Retention rate** |
| **Instagram Reels** | Reel → Insights → **Average watch time** + Watch time + Reach |
| **X** | Analytics → the post → video views (loose metric — treat as directional only) |

For each video log: date · platform · hook line · **length (sec)** · views/impressions · **avg view duration (sec)** · **watch-through %** · likes · comments · shares/saves · follows · **link clicks to lightningmines.com** (GA4 / Postiz / link analytics).

- [ ] YouTube Shorts rows pulled
- [ ] TikTok rows pulled
- [ ] Instagram Reels rows pulled
- [ ] X rows pulled
- [ ] CTA clicks to lightningmines.com pulled (the actual business metric)

## Part B — Pull the baseline (old-format week)
- [ ] Same per-video rows for the prior **old-format** week (the last full week before ~7/23)
- [ ] Follower counts as of 8/2 vs the 7/17 baseline (YT 2 · TikTok 2 · IG 2 · X 9)
- [ ] Flag which old videos had the AU accent (exclude or annotate them)

---

## Part C — The comparison (use medians, not averages — small n)
- [ ] **Primary — watch-through %:** median new vs median old. Up / flat / down?
- [ ] **Absolute seconds watched** (this matters at different lengths): a 30s video at 60% = 18s; a 60s at 40% = 24s. **Compare both % and raw seconds** — % can rise while seconds fall.
- [ ] **First-3-second hold** (the cleanest read on the new hook): did "Lightning Mines here —" hold or lose viewers in the opening vs old openers? This is the single most informative chart.
- [ ] **Engagement rate:** (likes+comments+shares) / views, new vs old
- [ ] **CTA clicks** to lightningmines.com per view, new vs old (did brand-at-open help or hurt the click?)
- [ ] **Sameness check:** any sign *returning* viewers skip the now-identical open?

---

## Part D — Decision criteria (decide these NOW, not on the day)
- **KEEP** if: first-3s hold and/or median watch-through is up vs old, **and** CTA clicks aren't down.
- **ADJUST** if: retention flat but early drop-off unchanged, **or** the sameness signal shows up → cheapest next move is **rotating the hook line** (4–5 patterns), not touching HeyGen.
- **REVERT / rethink** if: retention clearly worse across 5+ videos (and it's not just the accent confound).
- **INCONCLUSIVE** (see guardrail #1): total views too low → **extend 2 weeks**, decide Aug 16.

---

## Part E — Ship the outcome
- [ ] Write **one lesson** into `BRAND.md` (per the standing Sunday cadence)
- [ ] Record the decision + the reason (keep/adjust/revert/extend)
- [ ] Log the new follower + views baseline for next week's delta
- [ ] **If KEEP** → queue the next lever from the "flat/boring" list: (1) music bed + sound design [cheapest], (2) hook rotation, (3) Remotion word-synced motion
- [ ] **If HeyGen month is going well overall** → note it (the month ends ~8/22; this is the mid-point read)

---
*Optional: run the numbers through the content-engine's two-model setup (Claude generate + GPT review) for a second-opinion read on the traction, the same dual-brain pattern used elsewhere.*
