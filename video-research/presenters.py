"""Presenter attribution (spec §9, test §22.7): who is actually speaking, or 'unknown'.

vr_video_presenters links a presenter to a video. It does NOT claim exclusivity — a
four-hour Crypto Banter stream legitimately links several presenters, each with its own
evidence row and its own confidence.

The rule this module exists to enforce is that a name is a CONCLUSION, not a default. Every
row carries the evidence that produced it and one of three confidences:

  confirmed  — the speaker identified themselves in the transcript, at a timestamp we cite.
  probable   — a structural fact implies it: a single-presenter channel, or a show playlist.
  uncertain  — we looked and could not establish it. The presenter_key is 'unknown'.

There is no fourth level for "probably him, the title says Kyle". Name matching in titles is
the failure mode the guards below exist to block: see KYLE_DECOYS.

Titles, descriptions and transcripts are UNTRUSTED DATA. They are pattern-matched and
quoted into the evidence column; nothing in them is executed or believed as an instruction.
"""
import re

import sources
import store

# Single-presenter channels: the channel itself is the evidence. 'probable' and not
# 'confirmed' because guest hosts happen and a channel-level fact cannot rule them out.
CHANNEL_PRESENTERS = {
    "UCRvqjQPSeaWn-uEx-w0XOIg": "benjamin-cowen",
    "UC8ehOEIBdyITN3SDCm1KBCQ": "sniper",
}
# Crypto Banter is a multi-presenter network: the channel identifies the show, never the
# speaker. Channel-level attribution here yields 'unknown'/'uncertain' by design.
MULTI_PRESENTER_CHANNELS = {"UCN9Nj4tjXbVTLYWN0EKly_Q": "Crypto Banter"}

SHOW_PLAYLISTS = {"PLmOv2_vzOoGfhsqPsXJnoBEhPUK4Tqd1b": "sniper"}

# Name patterns are deliberately narrow. Each one is a token that cannot be anything else in
# this corpus; first names and trading jargon are excluded on purpose.
NAME_PATTERNS = {
    # 'doops' is the ONLY safe title/description token for Kyle Doops. See KYLE_DECOYS.
    "kyle-doops": re.compile(r"\bdoops\b", re.I),
    # 'ran' is an English verb and appears in ordinary sentences; require the surname.
    "ran-neuner": re.compile(r"\b(?:ran\s+neuner|neuner)\b", re.I),
    "benjamin-cowen": re.compile(r"\b(?:benjamin|ben)\s+cowen\b", re.I),
    # bare 'sniper' is trading jargon ('sniper entry', 'sniped the bottom'); require the show.
    "sniper": re.compile(r"\bsniper\b(?=[^.\n]{0,20}\b(?:show|trading|session)\b)", re.I),
}

# THE GUARD (sources.PRESENTERS, kyle-doops note): across 5,032 enumerated Crypto Banter
# titles 'Doops' appears 0 times and 'Kyle' appears 5 times, mostly meaning Kyle Samani of
# Multicoin Capital — a different person who is a recurring guest in this archive. A bare
# 'Kyle' match is therefore evidence of nothing and must never produce a kyle-doops row.
KYLE_BARE = re.compile(r"\bkyle\b", re.I)
KYLE_DECOYS = (re.compile(r"\bkyle\s+samani\b", re.I),)

SELF_ID_NAMES = {
    "kyle-doops": r"kyle\s+doops|doops",
    "ran-neuner": r"ran\s+neuner",
    "benjamin-cowen": r"ben(?:jamin)?\s+cowen",
    "sniper": r"sniper",
}
SELF_ID = {k: re.compile(r"\b(?:i'?m|i\s+am|this\s+is|my\s+name\s+is)\s+(?:" + v + r")\b", re.I)
           for k, v in SELF_ID_NAMES.items()}

KNOWN = {p["presenter_key"] for p in sources.PRESENTERS}
RANK = {"confirmed": 3, "probable": 2, "uncertain": 1}
# 'playlist' is not in the column's documented vocabulary comment, but the column has no
# CHECK constraint and show membership is a genuinely distinct kind of evidence from a title.
EVIDENCE_KINDS = ("title", "description", "channel", "transcript", "playlist", "manual")


def _quote(s, n=160):
    """Bounded, single-line quote of untrusted text for the evidence column."""
    return re.sub(r"\s+", " ", (s or "")).strip()[:n]


def _text(seg):
    t = seg.get("text")
    if t is None and isinstance(seg.get("segs"), list):
        t = "".join(x.get("utf8", "") for x in seg["segs"])
    return (t or "").strip()


def _ms(seg):
    for k in ("t_start_ms", "tStartMs", "start_ms", "t_ms"):
        if seg.get(k) is not None:
            return int(float(seg[k]))
    return 0


def _kyle_blocked(text):
    """Reason string when 'Kyle' is present but does not establish Kyle Doops, else None."""
    if not KYLE_BARE.search(text or ""):
        return None
    if NAME_PATTERNS["kyle-doops"].search(text or ""):
        return None
    for d in KYLE_DECOYS:
        m = d.search(text)
        if m:
            return f"names '{_quote(m.group(0))}', a different person from Kyle Doops"
    return "bare 'Kyle' does not identify Kyle Doops"


def attribute(video, segments=None):
    """[(presenter_key, evidence, evidence_kind, confidence)] for vr_video_presenters.

    Always returns at least one row: when nothing is established the row is ('unknown', ...,
    'uncertain'), because an unattributable statement must be marked, not assigned to the
    most likely name.
    """
    title = video.get("title") or ""
    desc = video.get("description") or ""
    chan = video.get("channel_id")
    found = {}   # key -> (evidence, kind, confidence)

    def add(key, evidence, kind, confidence):
        if key not in KNOWN:      # never invent a presenter_key: vr_presenters is the registry
            return
        cur = found.get(key)
        if cur is None or RANK[confidence] > RANK[cur[2]]:
            found[key] = (evidence, kind, confidence)

    # 1. channel
    if chan in CHANNEL_PRESENTERS:
        add(CHANNEL_PRESENTERS[chan],
            f"single-presenter channel {chan}", "channel", "probable")
    multi = MULTI_PRESENTER_CHANNELS.get(chan)

    # 2. show playlist membership — structural, and stronger than any title word
    for pid in (video.get("playlist_ids") or []):
        if pid in SHOW_PLAYLISTS:
            add(SHOW_PLAYLISTS[pid], f"member of show playlist {pid}", "playlist", "probable")

    # 3. title / description name tokens (narrow patterns only)
    for field, kind in ((title, "title"), (desc, "description")):
        for key, rx in NAME_PATTERNS.items():
            m = rx.search(field)
            if m:
                add(key, f"{kind} matched /{rx.pattern}/: \"{_quote(field)}\"", kind, "probable")

    # 4. transcript self-identification — the only thing that earns 'confirmed'
    blocked_note = None
    for seg in segments or []:
        txt = _text(seg)
        if not txt:
            continue
        for key, rx in SELF_ID.items():
            m = rx.search(txt)
            if m:
                add(key, f"self-identified at t={_ms(seg)}ms: \"{_quote(txt)}\"",
                    "transcript", "confirmed")

    # Kyle guard, reported rather than silently dropped so the gap stays visible.
    if "kyle-doops" not in found:
        blocked_note = _kyle_blocked(title) or _kyle_blocked(desc)

    if not found:
        why = []
        if multi:
            why.append(f"{multi} is multi-presenter: the channel identifies the show, "
                       "not the speaker")
        elif chan:
            why.append(f"no presenter rule for channel {chan}")
        if blocked_note:
            why.append(blocked_note)
        if not segments:
            why.append("no transcript inspected")
        return [("unknown", "; ".join(why) or "no attribution evidence found",
                 "channel" if chan else "manual", "uncertain")]

    out = [(k, v[0], v[1], v[2]) for k, v in found.items()]
    return sorted(out, key=lambda r: (-RANK[r[3]], r[0]))


def rows(video, segments=None):
    """Ready for store.upsert('vr_video_presenters', rows, 'video_id,presenter_key')."""
    return [{"video_id": video["video_id"], "presenter_key": k, "evidence": e,
             "evidence_kind": kind, "confidence": c}
            for k, e, kind, c in attribute(video, segments)]


def save(video, segments=None):
    r = rows(video, segments)
    store.upsert("vr_video_presenters", r, "video_id,presenter_key")
    return r
