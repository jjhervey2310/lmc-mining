# Expert Boardroom — Claude Code sub-agent panel

A seven-seat panel that reviews any piece of content, page, offer, or campaign
from every angle and scores it out of 10. Built on the honesty positioning in
[`BRAND.md`](../../BRAND.md).

## The seats

**Creative seats** — always score every asset; their weighted average is the base score.

| Agent | Owns | Output |
|-------|------|--------|
| `marketing-strategist` | positioning, message, offer, conversion | `SCORE: X/10` |
| `social-media-expert` | hook, retention, platform fit | `SCORE: X/10` |
| `seo-content-expert` | search intent, structure, discoverability | `SCORE: X/10` |
| `brand-trust-guardian` | voice, hard rules, disclosures, trust (**veto**) | `SCORE: X/10` |

**Diligence seats** — score when relevant, may **ABSTAIN**; they gate the verdict rather than average in.

| Agent | Owns | Power |
|-------|------|-------|
| `mining-technical-expert` | accuracy of numbers, math, verdict | **veto** — a wrong number caps the verdict |
| `legal-compliance` | advice line, disclosures, guarantees, defamation | **veto** — real exposure caps the verdict |
| `accountant-cfo` | revenue path, unit economics, ROI | advisory — can drop the verdict one tier |

**The chair** — `boardroom-chair` synthesizes all participating seats into a
scorecard, a weighted base score, the applied gates, the top 3 fixes, and an
overall `X.X/10` + **GO / REVISE / KILL** verdict.

Each seat rates **its own part out of 10**, flags what's **missing** in its
domain ("what to add"), and names its single highest-leverage fix.

## How the panel learns and stays current

The seats aren't static rubrics — they improve over time through a **living
playbook** each one keeps in [`playbooks/`](playbooks/):

- **Recall** — every seat reads its playbook *before* scoring and applies its
  current benchmarks and past lessons.
- **Research** — when a seat's "what's working now" notes go stale (social is
  weekly, mining is per-difficulty-epoch, most others ~2 weeks), it runs a
  WebSearch on current best-practices/benchmarks for its platforms and appends a
  dated, sourced entry. Each review can carry a **Research update** line.
- **Learn from mistakes** — when an outcome is known (a call was wrong, or a
  shipped piece over/under-performed), the seat appends the mistake and the rule
  that prevents the repeat to its playbook's Lessons section.

The **chair** owns the shared memory: it logs every verdict in
[`playbooks/boardroom-log.md`](playbooks/boardroom-log.md), fills in outcomes when
Jacob reports them, runs **retros** that route lessons into the seat playbooks,
and records calibration patterns (a seat that keeps over/under-scoring, a
recurring fix). Because the playbooks are committed to the repo, the learning
persists across sessions and syncs via git.

> Tell the panel how a piece actually did — "the Tuesday Reel hit 40k, the audit
> page converted 2%" — and the relevant seats bank the lesson for next time.

## How to convene it

Ask the main assistant, in plain language:

> Convene the Expert Boardroom on `marketing/scripts/2026-07-13.md`.

The assistant then:

1. Spawns the **four creative seats** (always) plus any **diligence seats** whose
   surface the asset has, **in parallel**. Diligence seats return `ABSTAIN` when
   they don't apply.
2. Passes the reviews to `boardroom-chair`, which produces the scorecard, the
   weighted base, the gate results, the top 3 priority fixes, and the verdict.

You can also run a single seat directly — e.g. "have the `mining-technical-expert`
fact-check these numbers" or "have the `brand-trust-guardian` check this caption"
— for a fast focused pass without the full panel.

## Scoring at a glance

- **1–3** — fails its domain. For the veto seats (Brand & Trust, Mining SME,
  Legal) a ≤3 **caps the overall** regardless of the other scores.
- **4–6** — usable but needs real edits before it ships
- **7–8** — strong; minor polish
- **9–10** — exceptional; template-worthy

## Creative-seat weighting (chair adjusts by asset type)

| Asset type | Mktg | Social | SEO | Brand |
|-----------|------|--------|-----|-------|
| Short-form video / caption | 25 | 35 | 15 | 25 |
| Landing / provider / miner page | 30 | 15 | 30 | 25 |
| Email / newsletter | 35 | 15 | 20 | 30 |
| Long-form YouTube / article | 25 | 25 | 30 | 20 |
| Default | 30 | 25 | 20 | 25 |

The diligence seats don't average into this base — they **gate** it: a broken
hard rule (Brand), a wrong number (Mining SME), or real legal exposure (Legal)
caps the verdict at **REVISE**; a money-loser (CFO) drops it one tier. Trust and
accuracy are the assets the whole business is built on.
