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

    # ---- UNRESOLVED: not crawled, owner input required ----------------------
    {
        "source_key": "crypto-insider",
        "kind": "channel",
        "channel_id": None,
        "handle": None,
        "display_name": "Crypto Insider (UNRESOLVED)",
        "canonical_url": "",
        "scope_status": "UNRESOLVED",
        "priority": 900,
        "resolution_note": (
            "Not resolved on 2026-09-13 and deliberately NOT guessed. Two near-matches "
            "exist and neither is authoritative: @cryptoinsider resolves to a channel "
            "named 'Wide Angle By Waseem' (UCgEVPPnJoW_AmnKhb_D0-mw) whose display name "
            "does not match the requested source at all, and @CryptoInsiders "
            "(UCX1PK9XHaCK_Ftz1PAiFeMg) is a different, plural name. Crawling either "
            "would be a guess presented as a source. ACTION: owner supplies the exact "
            "channel URL, then flip scope_status to CONFIRMED."),
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
     "affiliation": "Crypto Banter", "notes": "Founder/host."},
    {"presenter_key": "kyle-doops", "display_name": "Kyle Doops",
     "affiliation": "Crypto Banter",
     "notes": (
         "ATTRIBUTION GAP as of 2026-09-13: across 5,032 enumerated Crypto Banter titles, "
         "'Doops' appears 0 times and 'Kyle' appears 5 times, of which the majority refer "
         "to Kyle Samani (Multicoin Capital), a different person. Titles therefore cannot "
         "identify his videos. Attribution must come from descriptions, playlist "
         "membership or transcript self-identification, and stays 'uncertain' until it "
         "does. Do not tag by name-match alone.")},
    {"presenter_key": "sniper", "display_name": "Sniper (Official Sniper Trading)",
     "affiliation": "Sniper Trading", "notes": "Channel-level attribution."},
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
