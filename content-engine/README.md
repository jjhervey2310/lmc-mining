# Content Engine — the "brain"

Generates daily short-form scripts (YouTube Shorts / Reels / TikTok / X) for
Lightning Mines, grounded in the site's **live numbers**, and runs every piece
through **checks-and-balances gates** before anything reaches a human. Nothing
posts automatically — the engine produces an approval digest.

## The pipeline

```
live data ──▶ brief ──▶ generate (Claude) ──▶ GATES ──▶ approval digest ──▶ (you) ──▶ render + post
             (real           per platform      1. fact   (Approve/Reject)      HeyGen   Blotato
              math)                             2. brand
                                                3. GPT review
```

**Gates (a script is blocked unless it passes all three):**
1. **Fact (deterministic)** — every `$` figure in the script is re-checked against
   today's live BTC price / hashprice / miner economics (computed with the site's
   own `lib/calculator.ts`). A number that matches nothing real is flagged. This is
   a real check, not one AI trusting another.
2. **Brand + FTC (deterministic)** — BRAND.md rules: no hype/FOMO vocabulary, one
   correct CTA, AI-presenter disclosure always, affiliate disclosure when a partner
   is named, no guaranteed-return language.
3. **GPT second opinion** — a different model (OpenAI) critiques against the rubric,
   including "would this ring true to a real miner?" Different models fail
   differently, so the cross-check catches what one model misses.

Then **you** approve or reject. That human gate is the final filter.

## Run it

```bash
npm run content:dry     # no keys needed — mock generator, gates run for real
npm run content:run     # uses live models when keys are set (below)
# optional: --pillar=hardware_reality  to force a specific day's pillar
```

Output is written to `content-engine/out/<date>-<pillar>.md` (the approval digest).

## Keys (set in `.env.local` when ready — engine runs in DRY mode until then)

| Var | Purpose |
|-----|---------|
| `ANTHROPIC_API_KEY` | Generator (Claude writes the scripts) |
| `OPENAI_API_KEY` | Reviewer (GPT second opinion) |
| `CE_GENERATOR_MODEL` | optional, default `claude-sonnet-5` |
| `CE_REVIEWER_MODEL` | optional, default `gpt-4o` |

DRY mode still runs the deterministic fact + brand gates for real — only the
Claude generation and GPT review are stubbed until their keys exist.

## Not built yet (next milestones)
- **Render**: send an approved script to HeyGen (your cloned avatar) → MP4.
- **Post**: push the rendered asset + caption to Blotato → TikTok/IG/YT/X.
- **Approval transport**: email/Slack the digest with real Approve/Reject buttons.
- **Feedback loop**: pull post analytics back to rank what works.

Grounding sources: `lib/calculator.ts`, `lib/data.ts` (MINERS_DATA), and the live
`/api/btc-price`. Voice/rules: `BRAND.md`.
