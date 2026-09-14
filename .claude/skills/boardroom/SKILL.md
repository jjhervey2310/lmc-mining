---
name: boardroom
description: >
  Convene the Lightning Mines Expert Boardroom on a piece of content, page,
  offer, or campaign. Spawns every relevant expert seat in parallel — each rates
  its domain out of 10 — then the Chair synthesizes a scorecard, a weighted
  overall, the top fixes, and a GO / REVISE / KILL verdict. Use when the user
  types /boardroom, or asks to "convene the boardroom", "run the panel", "score
  this with the experts", or "have the boardroom review <asset>".
argument-hint: <path or description of the asset to review>
---

# Convene the Expert Boardroom

You are orchestrating the panel defined in `.claude/agents/` (seats) and
`.claude/agents/README.md`. The seats and Chair are sub-agents; you are the only
thing that can spawn them, so you run the convening. Follow these steps.

## 1. Resolve the asset

- The asset is `$ARGUMENTS` (a file path, or a description of the thing to
  review). If it's a path, **Read it**. If it's a URL on the site, read the
  corresponding file under `app/`. If nothing was given, ask the user which
  asset (one short question) and stop until answered.
- Also read `BRAND.md` so you can classify correctly.

## 2. Classify the asset (drives weighting + which seats run)

Pick the closest type — the Chair uses it to weight the creative seats:

| Type | Cue |
|------|-----|
| Short-form video / caption | Reel/Short/TikTok script, caption |
| Landing / provider / miner page | a page under `app/` (`/audit`, `/hosts/*`, `/miners/*`) |
| Email / newsletter | newsletter or transactional email copy |
| Long-form YouTube / article | 5–8 min script, blog/article |

Then decide which **diligence** seats have a surface (spawn only the relevant
ones; each will ABSTAIN if it turns out not to apply):

- `mining-technical-expert` — any hashprice / difficulty / efficiency / breakeven
  numbers or technical claims. **Almost always yes** for this brand.
- `legal-compliance` — claims, offers/pricing, affiliate links, AI narration,
  competitor/scam callouts, or anything touching returns.
- `accountant-cfo` — offers, pricing, funnels, or anything with a revenue angle.

## 3. Spawn the seats — in parallel

In a **single message**, make one `Agent` call per seat you're running (they're
independent, so fire them together). Give each the same context: the asset (paste
its content or the path) and its asset type.

Always spawn the five **creative** seats:
`marketing-strategist`, `social-media-expert`, `seo-content-expert`,
`ai-search-expert`, `brand-trust-guardian`.

Plus the relevant **diligence** seats from step 2.

Each seat will read its own playbook, do any needed research, return a review
ending in `SCORE: X/10` (or `ABSTAIN`), and update its playbook. Collect all
their returned reviews verbatim.

## 4. Hand off to the Chair

Spawn `boardroom-chair` once, passing it: the asset name, its type, and **all**
the seat reviews you collected. The Chair will:
- build the scorecard, compute the weighted base (using the asset-type profile),
- apply the diligence gates (Brand/Mining/Legal veto, CFO downgrade),
- rank the top 3 fixes, issue GO / REVISE / KILL,
- and log the verdict to `.claude/agents/playbooks/boardroom-log.md`.

## 5. Present the result

Show the Chair's full scorecard + verdict to the user. Keep your own commentary
to a sentence or two. Then remind them once: **reporting how the piece actually
performs later** (e.g. "the Tuesday Reel hit 40k, the audit page converted 2%")
lets the relevant seats bank the lesson — that's how the panel gets better.

## Notes

- If the user names a single seat instead ("just have the brand guardian check
  this"), skip the panel and spawn that one seat directly.
- Don't fabricate scores. Every score in the scorecard must come from a seat you
  actually spawned.
- The whole run is read-plus-playbook-only; it never modifies the reviewed asset
  unless the user explicitly asks you to apply the fixes afterward.
