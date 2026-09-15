"""Source registry — resolved to stable IDs, not handles.

Handles change; channel IDs do not. Every source below was resolved by fetching the
channel page and reading "externalId" out of it on 2026-09-13, and the resolved ID is
what the crawler uses. The handle is kept for humans and is treated as informational.

Scope discipline (spec §2): affiliated channels that turned up during resolution are
listed as RELATED and are NOT crawled. They are here so the owner can confirm or reject
them, not so the crawler can quietly expand into them.
"""

RESOLVED_AT = "2026-09-13"

SOURCES = [
    # ---- CONFIRMED: crawled -------------------------------------------------
    {
        "source_key": "crypto-banter",
        "kind": "channel",
        "channel_id": "UCN9Nj4tjXbVTLYWN0EKly_Q",
        "handle": "@CryptoBanterGroup",
        "display_name": "Crypto Banter",
        "canonical_url": "https://www.youtube.com/channel/UCN9Nj4tjXbVTLYWN0EKly_Q",
        "scope_status": "CONFIRMED",
        "priority": 50,
        "resolution_note": (
            "externalId read from https://www.youtube.com/@CryptoBanterGroup on 2026-09-13. "
            "Listings crawled: videos, streams, shorts."),
    },
    {
        # NOTE: this playlist lives ON the Crypto Banter channel, not on Official Sniper
        # Trading. 904 of its 907 entries are Crypto Banter uploads. It is kept as its own
        # source because playlist membership is the presenter signal (spec §2 "retaining
        # playlist and presenter relationships"), but the videos dedupe to one record each.
        "source_key": "sniper-crypto-trading-show",
        "kind": "playlist",
        "playlist_id": "PLmOv2_vzOoGfhsqPsXJnoBEhPUK4Tqd1b",
        "channel_id": "UCN9Nj4tjXbVTLYWN0EKly_Q",
        "handle": None,
        "display_name": "The Sniper Crypto Trading Show",
        "canonical_url": "https://www.youtube.com/playlist?list=PLmOv2_vzOoGfhsqPsXJnoBEhPUK4Tqd1b",
        "scope_status": "CONFIRMED",
        "priority": 10,  # spec §7: explicit strategy lessons first
        "resolution_note": (
            "907 entries on 2026-09-13; 904 carry channel_id UCN9Nj4tjXbVTLYWN0EKly_Q "
            "(Crypto Banter), 3 unresolved. 902 of 907 also appear in the Crypto Banter "
            "channel listings and dedupe to one video record."),
    },
    {
        "source_key": "official-sniper-trading",
        "kind": "channel",
        "channel_id": "UC8ehOEIBdyITN3SDCm1KBCQ",
        "handle": "@OfficialSniperTrading",
        "display_name": "Sniper Trading",
        "canonical_url": "https://www.youtube.com/channel/UC8ehOEIBdyITN3SDCm1KBCQ",
        "scope_status": "CONFIRMED",
        "priority": 10,
        "resolution_note": "externalId read from the channel page on 2026-09-13.",
    },
    {
        "source_key": "benjamin-cowen",
        "kind": "channel",
        "channel_id": "UCRvqjQPSeaWn-uEx-w0XOIg",
        "handle": "@benjaminjcowen",
        "display_name": "Benjamin Cowen",
        "canonical_url": "https://www.youtube.com/channel/UCRvqjQPSeaWn-uEx-w0XOIg",
        "scope_status": "CONFIRMED",
        "priority": 40,  # spec §7 item 4
        "resolution_note": "externalId read from the channel page on 2026-09-13.",
    },

    # ---- CONFIRMED late, via an authoritative link from the in-scope channel ----
    {
        "source_key": "crypto-insider",
        "kind": "channel",
        "channel_id": "UCSbyF4RwCk3AuGhYmykCGOQ",
        "handle": "@CryptoInsiderOfficial",
        "display_name": "Crypto Insider",
        "canonical_url": "https://www.youtube.com/channel/UCSbyF4RwCk3AuGhYmykCGOQ",
        "scope_status": "CONFIRMED",
        "priority": 60,
        "resolution_note": (
            "RESOLVED 2026-09-13 by the owner pointing at the Crypto Banter featured tab, "
            "which lists it under the channel's own BANTER CHANNELS shelf as "
            "'Crypto Insider @CryptoInsiderOfficial, 67.7 thousand subscribers'. That is an "
            "authoritative link FROM the in-scope channel, which is what the brief asked for "
            "and what the earlier handle guesses lacked: @cryptoinsider is a different "
            "channel displaying as 'Wide Angle By Waseem', and @CryptoInsiders is a third, "
            "plural one. externalId read from the resolved channel page."),
    },

    # ---- CONFIRMED: presenter and teaching playlists on the Crypto Banter channel ----
    # Found 2026-09-15 on the channel's own /playlists tab, at the owner's request.
    # These matter for attribution, not just volume: playlist membership is the only
    # evidence in this archive that names a presenter. Titles cannot — see kyle-doops below.
    {
        "source_key": "sniper-trading-masterclass",
        "kind": "playlist",
        "playlist_id": "PLmOv2_vzOoGcTirwpJoyhGrYRnv1CRyIa",
        "channel_id": "UCN9Nj4tjXbVTLYWN0EKly_Q",
        "handle": None,
        "display_name": "Sniper Trading Masterclass",
        "canonical_url": "https://www.youtube.com/playlist?list=PLmOv2_vzOoGcTirwpJoyhGrYRnv1CRyIa",
        "scope_status": "CONFIRMED",
        "priority": 5,
        "resolution_note": (
            "34 entries / 11.0h enumerated 2026-09-15. Course-shaped teaching rather than "
            "daily commentary, which makes it the best prior in the archive for a stated "
            "stop or invalidation — the one thing no extracted method has yet contained. "
            "Ranked first for that reason, not for volume."),
    },
    {
        "source_key": "kyle-doops-trading-show",
        "kind": "playlist",
        "playlist_id": "PLmOv2_vzOoGcDGeu-HHfifExgbvmPLO3l",
        "channel_id": "UCN9Nj4tjXbVTLYWN0EKly_Q",
        "handle": None,
        "display_name": "Kyle Doops Trading Show",
        "canonical_url": "https://www.youtube.com/playlist?list=PLmOv2_vzOoGcDGeu-HHfifExgbvmPLO3l",
        "scope_status": "CONFIRMED",
        "priority": 10,
        "resolution_note": (
            "RESOLVES THE KYLE DOOPS ATTRIBUTION GAP. 'Doops' appears in 0 of 5,037 Crypto "
            "Banter titles and most 'Kyle' hits are Kyle Samani, a different person, so no "
            "title heuristic could ever find his videos. This playlist can. 980 entries / "
            "568.3h enumerated 2026-09-15; 979 carry channel_id UCN9Nj4tjXbVTLYWN0EKly_Q. "
            "Membership is evidence that he presents the video, NOT proof that he speaks any "
            "given sentence in it — a guest or co-host still resolves to 'unknown'."),
    },
    {
        "source_key": "crypto-trading-tutorials",
        "kind": "playlist",
        "playlist_id": "PLmOv2_vzOoGeks9AnbpvvTC6Eh3hhX_ol",
        "channel_id": "UCN9Nj4tjXbVTLYWN0EKly_Q",
        "handle": None,
        "display_name": "Crypto Trading Tutorials",
        "canonical_url": "https://www.youtube.com/playlist?list=PLmOv2_vzOoGeks9AnbpvvTC6Eh3hhX_ol",
        "scope_status": "CONFIRMED",
        "priority": 20,
        "resolution_note": (
            "70 entries / 21.4h enumerated 2026-09-15. Multi-presenter. Expect a high "
            "SPONSORED_PROMOTIONAL share: docs/TITLE-SURVEY.md measured that 8 of 10 "
            "leverage/tutorial titles on this channel name an exchange brand."),
    },
    {
        "source_key": "pro-trader-mindset",
        "kind": "playlist",
        "playlist_id": "PLmOv2_vzOoGcrUNmchEZ4NOCghqGHNcjs",
        "channel_id": "UCN9Nj4tjXbVTLYWN0EKly_Q",
        "handle": None,
        "display_name": "The Professional Crypto Trader Mindset",
        "canonical_url": "https://www.youtube.com/playlist?list=PLmOv2_vzOoGcrUNmchEZ4NOCghqGHNcjs",
        "scope_status": "CONFIRMED",
        "priority": 25,
        "resolution_note": (
            "18 entries / 8.3h enumerated 2026-09-15. Psychology and survival framing, so "
            "the likeliest place to find stated reasons to AVOID trading — which the brief "
            "asks for explicitly and which no method record has captured yet."),
    },
    {
        "source_key": "trading-wisdom",
        "kind": "playlist",
        "playlist_id": "PLmOv2_vzOoGcrqRLL0BVnXjRwK_WW1O9v",
        "channel_id": "UCN9Nj4tjXbVTLYWN0EKly_Q",
        "handle": None,
        "display_name": "Trading Wisdom",
        "canonical_url": "https://www.youtube.com/playlist?list=PLmOv2_vzOoGcrqRLL0BVnXjRwK_WW1O9v",
        "scope_status": "CONFIRMED",
        "priority": 25,
        "resolution_note": "14 entries / 7.6h enumerated 2026-09-15.",
    },

    # ---- RELATED: listed for scope confirmation, NOT crawled (spec §2) ------
    {
        "source_key": "related-candidates",
        "kind": "channel",
        "channel_id": None,
        "handle": None,
        "display_name": "Affiliated channels seen during resolution (not crawled)",
        "canonical_url": "",
        "scope_status": "RELATED",
        "priority": 999,
        "resolution_note": (
            "Crypto Banter operates a network of affiliated channels. The brief forbids "
            "silent expansion into them, so none are crawled. They are recorded here only "
            "so the owner can add any of them explicitly."),
    },
]

# Presenter registry. 'unknown' is a real, usable value — spec §9 requires an
# unattributable statement to be marked, not assigned to the most likely name.
PRESENTERS = [
    {"presenter_key": "unknown", "display_name": "Unknown / unattributed",
     "affiliation": None,
     "notes": "Default for any statement whose speaker is not established by evidence."},
    {"presenter_key": "ran-neuner", "display_name": "Ran Neuner",
     "affiliation": "Crypto Banter",
     "notes": (
         "ONE OF SEVERAL presenters on Crypto Banter, confirmed by the owner 2026-09-13 — "
         "which is why channel-level attribution on Banter can never name a speaker. An "
         "earlier note here called him 'founder/host'; that was not something the owner "
         "said and is removed rather than left as an unsourced claim in the registry. "
         "NEVER match a bare 'ran': it is the past tense of 'run' and appears constantly in "
         "ordinary market talk ('the market ran into resistance'). The surname is required.")},
    {"presenter_key": "kyle-doops", "display_name": "Kyle Doops",
     "affiliation": "Crypto Banter",
     "notes": (
         "ATTRIBUTION GAP — CLOSED 2026-09-15 BY PLAYLIST, NOT BY NAME. Across 5,037 "
         "enumerated Crypto Banter titles 'Doops' appears 0 times and 'Kyle' appears 5, "
         "most referring to Kyle Samani (Multicoin Capital), a different person. Titles "
         "therefore cannot identify his videos and never will. The Kyle Doops Trading Show "
         "playlist (980 entries) can, and is now a registered source. Membership attributes "
         "the VIDEO to him; it does not attribute any individual sentence, so a guest or "
         "co-host inside one of his videos still resolves to 'unknown'. Never tag by "
         "name-match alone.")},
    {"presenter_key": "sniper", "display_name": "Sheldon (\"Sniper\")",
     "affiliation": "Sniper Trading / Crypto Banter",
     "notes": (
         "Given name Sheldon, confirmed by the owner 2026-09-13; he presents BOTH on his own "
         "Official Sniper Trading channel and on Crypto Banter (The Sniper Crypto Trading "
         "Show playlist, which is hosted on the Banter channel). 'Sheldon' is a distinctive "
         "token in this corpus and is therefore a safe match on its own; bare 'sniper' is "
         "trading jargon and still requires the show name alongside it.")},
    {"presenter_key": "benjamin-cowen", "display_name": "Benjamin Cowen",
     "affiliation": "Into The Cryptoverse",
     "notes": "Single-presenter channel; channel-level attribution is 'probable'."},
]


def confirmed():
    return [s for s in SOURCES if s["scope_status"] == "CONFIRMED"]


def by_key(key):
    for s in SOURCES:
        if s["source_key"] == key:
            return s
    raise KeyError(key)


def listing_urls(source):
    """The listing URLs to enumerate for a source, in crawl order."""
    if source["kind"] == "playlist":
        return [("playlist",
                 f"https://www.youtube.com/playlist?list={source['playlist_id']}")]
    cid = source["channel_id"]
    return [(tab, f"https://www.youtube.com/channel/{cid}/{tab}")
            for tab in ("videos", "streams", "shorts")]
