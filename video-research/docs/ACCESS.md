# Source access — what worked, what did not, and what you can supply

Measured 2026-09-13 from the Claude Code remote container (a datacenter IP). Everything below
is a result from a command that ran, not a guess about how YouTube behaves.

## Resolved source identities

Resolved by fetching each channel page and reading `externalId`. Handles change; IDs do not.

| Source | Channel ID | Handle | Status |
|---|---|---|---|
| Crypto Banter | `UCN9Nj4tjXbVTLYWN0EKly_Q` | `@CryptoBanterGroup` | CONFIRMED |
| Sniper Trading | `UC8ehOEIBdyITN3SDCm1KBCQ` | `@OfficialSniperTrading` | CONFIRMED |
| Benjamin Cowen | `UCRvqjQPSeaWn-uEx-w0XOIg` | `@benjaminjcowen` | CONFIRMED |
| The Sniper Crypto Trading Show | playlist `PLmOv2_vzOoGfhsqPsXJnoBEhPUK4Tqd1b` | — | CONFIRMED |
| **Crypto Insider** | — | — | **UNRESOLVED** |

The Sniper show playlist is hosted **on the Crypto Banter channel**, not on Official Sniper
Trading: 904 of its 907 entries carry Crypto Banter's channel ID, and 902 also appear in that
channel's own tabs. They dedupe to one video record each; playlist membership is kept in
`vr_playlist_members`.

### Crypto Insider is not resolved, and was not guessed

Two near-matches exist and neither is authoritative:

- `@cryptoinsider` → a channel whose display name is **"Wide Angle By Waseem"**
  (`UCgEVPPnJoW_AmnKhb_D0-mw`). The handle matches the request; the name does not.
- `@CryptoInsiders` → **"Crypto Insiders"** (`UCX1PK9XHaCK_Ftz1PAiFeMg`) — a different,
  plural name.

Crawling either would put a guess into the source registry dressed as a source. It sits at
`scope_status='UNRESOLVED'` and is never enumerated.

**To resolve it:** send the exact channel URL. Then set `channel_id` and flip `scope_status`
to `CONFIRMED` in `sources.py`, and run `python3 cli.py seed && python3 cli.py inventory
--sources crypto-insider`.

## What worked

**Channel and playlist listing — reliable, not bot-gated.**

```
python3 -m yt_dlp --flat-playlist --skip-download \
  --print "%(id)s|%(title)s|%(duration)s|%(live_status)s" \
  "https://www.youtube.com/channel/<CHANNEL_ID>/videos"
```

All nine listings (three tabs × three channels) plus the playlist ran to the end of their
pagination with exit 0 and no rate-limit or bot error. **8,223 unique videos, ~3,903 hours.**
This is why `pagination_complete = true` is stored for those listings — it is an observation,
not an assumption.

**One caption download succeeded** early in the session, before the gate tripped: video
`5TIPLsQVSHI`, English ASR, 134 segments in `json3` with `tStartMs`/`dDurationMs` intact.

## What failed

**The per-video player API is bot-gated from this IP.**

```
ERROR: [youtube] <id>: Sign in to confirm you're not a bot.
       Use --cookies-from-browser or --cookies for the authentication.
```

Measured behaviour: the session's first ~6 player-API calls succeeded. Sustained use then
trips the gate. It recovers briefly and re-trips. At 40-second pacing, three consecutive
attempts were blocked and the batch aborted on a checkpoint — the designed behaviour, not a
crash. **A retest 40 minutes after the last request was still blocked**, so this is a durable
flag on the IP, not a short cooldown.

**Not attempted, on purpose:** cookie export, browser impersonation, or any other way around
the bot check. The brief forbids bypassing anti-bot controls and forbids requesting account
credentials, and a research pipeline whose data provenance starts with an evasion is not
worth having.

**The YouTube Data API v3 would not solve this.** It is free within quota and would serve
metadata, but `captions.download` requires OAuth **as the channel owner**. Third-party caption
*content* is not available through the official API at all. No API key was configured and no
paid call was made.

## Caption provenance — a finding, not a failure

All three channels carry **zero creator captions**. Measured on `c45OAsahluc`:

| yt-dlp key | Meaning | Languages |
|---|---|---|
| `subtitles` | uploader-supplied | **0** |
| `automatic_captions` | machine transcription | **157** (incl. `en`, `en-orig`) |

So every transcript from these sources is ASR. `en-orig` is ASR too — it is the original-language
machine track, not a creator track. `captions.py` derives `source_type` from *which dict the
language came out of*, never from the filename, and the ~150 machine-*translated* tracks are
not counted as available languages.

The consequence carried through the whole pipeline: **every number in a transcript is a
transcription risk**, which is why `vr_numeric_claims` has an `ambiguous` flag and a mandatory
`ambiguity_note` rather than a silently corrected value.

## Remedy 1 — run it from a residential IP (preferred)

Nothing needs to change in the code. The droplet already holds the Supabase service key.

```bash
scp -r video-research root@<droplet>:/root/
ssh root@<droplet> 'cd /root/video-research && cp /root/lmc-desk/.env .env \
  && python3 cli.py seed && python3 cli.py captions --limit 25'
```

Start with a small batch and read the reported throughput before scaling. Sustainable rate
from a non-gated IP **has not been measured**, so no completion date is offered here.
Pacing is `VR_CAPTION_DELAY` (default 20s) and the fetcher is strictly serial by design —
concurrency is what tripped the gate in the first place.

## Remedy 2 — supply authorized transcripts

If you have transcripts you are entitled to use, this is the exact format the pipeline ingests.

**One JSON file per video.** Filename is free; the `video_id` inside is what counts.

```json
{
  "video_id": "5TIPLsQVSHI",
  "lang": "en",
  "source_type": "creator",
  "note": "optional: where this came from",
  "segments": [
    { "t_start_ms": 0,     "text": "Oh, fam. Live from Mora." },
    { "t_start_ms": 7440,  "text": "out of shows the last couple of days." },
    { "t_start_ms": 11600, "text": "but today I'm dropping a show." }
  ]
}
```

| Field | Required | Notes |
|---|---|---|
| `video_id` | yes | the 11-character YouTube id. Validated; a bad one is rejected. |
| `segments[].t_start_ms` | yes | integer milliseconds from the start of the video. **This is the whole point** — a transcript with no timestamps cannot support a sourced excerpt. |
| `segments[].text` | yes | the spoken text for that segment. |
| `lang` | no | defaults to `en`. |
| `source_type` | no | **`"creator"` only if you are asserting a human produced it.** Omit it and the file is recorded as `auto`. |
| `note` | no | free text, stored with the provenance. |

`t_end_ms` is accepted if you have it. Segments are **not** reordered — out-of-order entries
are counted and reported rather than silently fixed, because reordering would re-time every
excerpt later cited off the file.

**Why `source_type` defaults to `auto`:** nothing in the bytes proves who typed them, and we
did not watch the video. Calling a human transcript ASR only widens uncertainty we already
carry; the reverse launders a machine guess into a cited source. Only you can make that claim,
so only an explicit declaration produces `creator`.

```bash
# validate a batch first — writes nothing
python3 cli.py import-transcripts --path ~/transcripts --dry-run

# then ingest (a file or a whole directory tree)
python3 cli.py import-transcripts --path ~/transcripts
```

A malformed file is rejected and recorded; the rest of the batch still lands. Nothing partial
is ever written. The video does not need to have been enumerated first — often that is exactly
why it was supplied.

## What an import does and does not change

- Writes the full text to the **local private cache only** (`state/cache/transcripts/`), never
  to the database. `vr_transcripts` gets the hash, segment count, duration and provenance.
- Sets stage `TRANSCRIPT_AVAILABLE = done` with the declared source type in the detail.
- **Leaves `caption_langs` / `caption_source` alone.** Those record what YouTube advertises;
  your file is evidence about you, not about YouTube.
- Does **not** extract anything. Extraction is a separate, reviewed step, and a chart-dependent
  rule stays incomplete regardless of how good the transcript is.

## Checking the state of access

```bash
python3 cli.py blockers   # open blockers, occurrence counts, and the remedy text
python3 cli.py status     # coverage per listing, stage counts, last runs
```

Open blockers recorded as of this writing: `bot_check` (Crypto Banter, the gate above),
`no_captions` (zero creator captions on any confirmed channel), and `unresolved_source`
(Crypto Insider).
