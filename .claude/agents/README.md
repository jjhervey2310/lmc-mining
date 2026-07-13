# Expert Boardroom — Claude Code sub-agent panel

A five-agent panel that reviews any piece of content, page, offer, or campaign
from every angle and scores it out of 10. Built on the honesty positioning in
[`BRAND.md`](../../BRAND.md).

## The seats

| Agent | Owns | Output |
|-------|------|--------|
| `marketing-strategist` | positioning, message, offer, conversion | `SCORE: X/10` |
| `social-media-expert` | hook, retention, platform fit | `SCORE: X/10` |
| `seo-content-expert` | search intent, structure, discoverability | `SCORE: X/10` |
| `brand-trust-guardian` | voice, hard rules, disclosures, trust (**veto**) | `SCORE: X/10` |
| `boardroom-chair` | synthesizes the four into a scorecard + verdict | overall `X.X/10` + GO/REVISE/KILL |

Each seat rates **its own part out of 10**, flags what's **missing** in its
domain ("what to add"), and names its single highest-leverage fix. The chair
turns the four scores into one weighted overall and a GO / REVISE / KILL call.

## How to convene it

Ask the main assistant, in plain language:

> Convene the Expert Boardroom on `marketing/scripts/2026-07-13.md`.

The assistant then:

1. Spawns **all four seats in parallel** on the asset (each returns a `SCORE: X/10`).
2. Passes the four reviews to `boardroom-chair`, which produces the scorecard,
   the weighted overall, the top 3 priority fixes, and the verdict.

You can also run a single seat directly — e.g. "have the `brand-trust-guardian`
check this caption" — for a fast compliance pass without the full panel.

## Scoring at a glance

- **1–3** — fails its domain (Brand & Trust ≤3 is a **VETO** and caps the overall)
- **4–6** — usable but needs real edits before it ships
- **7–8** — strong; minor polish
- **9–10** — exceptional; template-worthy

## Weighting (chair adjusts by asset type)

| Asset type | M | Social | SEO | Brand |
|-----------|---|--------|-----|-------|
| Short-form video / caption | 25 | 35 | 15 | 25 |
| Landing / provider / miner page | 30 | 15 | 30 | 25 |
| Email / newsletter | 35 | 15 | 20 | 30 |
| Long-form YouTube / article | 25 | 25 | 30 | 20 |
| Default | 30 | 25 | 20 | 25 |

The Brand & Trust Guardian holds veto power: a broken hard rule caps the
verdict at **REVISE** regardless of the other scores — trust is the asset the
whole business is built on.
