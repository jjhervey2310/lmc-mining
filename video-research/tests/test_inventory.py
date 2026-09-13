"""Offline tests for inventory.py. No network, no Supabase: yt-dlp is replaced by a stub
script and store's REST calls are captured in memory.

What is actually being pinned down here is the honesty machinery — dedupe by video_id,
never overwrite a measured field with an unmeasured one, and never produce a ratio for a
listing whose pagination did not complete.
"""
import os
import pathlib
import stat
import subprocess
import sys
import tempfile
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
import inventory  # noqa: E402
import sources  # noqa: E402
import store  # noqa: E402

STUB = """#!/usr/bin/env python3
import os, sys
n = int(os.environ.get("STUB_N", "3"))
for i in range(n):
    print("vid%08d|%d|%s|%s|https://www.youtube.com/watch?v=vid%08d|Title %d | with pipe"
          % (i, 100 + i, os.environ.get("STUB_LIVE", "NA"), os.environ.get("STUB_CHAN", "NA"), i, i))
if os.environ.get("STUB_STDERR"):
    sys.stderr.write(os.environ["STUB_STDERR"] + "\\n")
sys.exit(int(os.environ.get("STUB_RC", "0")))
"""


class Fake:
    """Captures every write; answers reads from what was written."""

    def __init__(self):
        self.tables, self.blockers, self.runs = {}, [], []

    def install(self, t):
        self.orig = {k: getattr(store, k) for k in
                     ("get", "insert", "upsert", "patch", "count", "record_blocker", "Run")}
        store.get, store.insert, store.upsert = self.get, self.insert, self.upsert
        store.patch, store.count = lambda *a, **k: None, self.count
        store.record_blocker = self.record_blocker
        store.Run = self.Run
        t.addCleanup(lambda: [setattr(store, k, v) for k, v in self.orig.items()])

    def upsert(self, table, rows, on_conflict):
        keys = on_conflict.split(",")
        t = self.tables.setdefault(table, {})
        for r in rows:
            assert all(v is not None for v in r.values()), f"null written to {table}: {r}"
            k = tuple(r[c] for c in keys)
            t[k] = {**t.get(k, {}), **r}
        return len(rows)

    def insert(self, table, rows):
        self.tables.setdefault(table, {})
        for i, r in enumerate(rows):
            self.tables[table][("_ins", len(self.tables[table]), i)] = r
        return None

    def get(self, table, query=""):
        if table == "vr_videos":
            ids = query.split("in.(")[1].rstrip(")").split(",")
            return [{"video_id": k[0], "video_type": v.get("video_type")}
                    for k, v in self.tables.get("vr_videos", {}).items() if k[0] in ids]
        if table == "vr_inventory_runs":
            want = dict(p.split("=eq.") for p in query.split("&") if "=eq." in p)
            rows = [r for r in self.tables.get("vr_inventory_runs", {}).values()
                    if r["source_key"] == want["source_key"] and r["listing"] == want["listing"]]
            return sorted(rows, key=lambda r: r["started_at"], reverse=True)[:1]
        return []

    def count(self, table, query=""):
        return len(self.tables.get(table, {}))

    def record_blocker(self, kind, detail=None, video_id=None, source_key=None):
        self.blockers.append({"kind": kind, "detail": detail, "source_key": source_key})

    class Run:
        def __init__(self, job, note=None):
            self.job, self.id = job, 1
            self.processed = self.skipped = self.failed = self.blocked = 0
            self.checkpoints = []

        def __enter__(self):
            return self

        def save(self, cp=None):
            self.checkpoints.append(cp)

        def __exit__(self, *a):
            return False


class InventoryTest(unittest.TestCase):
    def setUp(self):
        self.fake = Fake()
        self.fake.install(self)
        d = tempfile.mkdtemp()
        p = pathlib.Path(d) / "ytdlp-stub"
        p.write_text(STUB)
        p.chmod(p.stat().st_mode | stat.S_IEXEC)
        self.stub = str(p)
        self.orig_ytdlp, inventory.YTDLP = inventory.YTDLP, self.stub
        self.addCleanup(lambda: setattr(inventory, "YTDLP", self.orig_ytdlp))
        for k in ("STUB_N", "STUB_RC", "STUB_STDERR", "STUB_LIVE", "STUB_CHAN"):
            os.environ.pop(k, None)
        self.chan = sources.by_key("official-sniper-trading")
        self.pl = sources.by_key("sniper-crypto-trading-show")

    # -- parsing --------------------------------------------------------
    def test_pipe_in_title_does_not_shift_fields(self):
        e = inventory._parse("abc12345678|639|NA|NA|https://x/y|Title | with | pipes\n")
        self.assertEqual(e["video_id"], "abc12345678")
        self.assertEqual(e["duration_s"], 639)
        self.assertIsNone(e["live_status"])
        self.assertEqual(e["title"], "Title | with | pipes")

    def test_na_and_junk_ids(self):
        self.assertIsNone(inventory._parse("NA|NA|NA|NA|NA|x\n"))
        self.assertIsNone(inventory._parse("a,b)|1|NA|NA|u|t\n"))  # would poison an in.() filter
        self.assertIsNone(inventory._parse("too|few|fields\n"))

    # -- video_type rules -----------------------------------------------
    def test_type_mapping_and_no_downgrade(self):
        self.assertEqual(inventory._video_type("videos", None), "upload")
        self.assertEqual(inventory._video_type("streams", None), "livestream")
        self.assertEqual(inventory._video_type("shorts", None), "short")
        self.assertEqual(inventory._video_type("playlist", None), "unknown")
        self.assertEqual(inventory._video_type("playlist", "was_live"), "livestream")
        # the rule that matters: a stored type is never replaced by 'unknown'
        self.assertEqual(inventory._video_type("playlist", None, known="short"), "short")

    # -- completeness ----------------------------------------------------
    def test_cap_marks_incomplete(self):
        os.environ["STUB_N"] = "9"
        oc = {}
        list(inventory.enumerate_listing(self.chan, "videos", "u", limit=4, outcome=oc))
        self.assertFalse(oc["pagination_complete"])
        self.assertEqual(oc["stopped_reason"], "cap")

    def test_clean_walk_is_complete(self):
        os.environ["STUB_N"] = "3"
        oc = {}
        n = len(list(inventory.enumerate_listing(self.chan, "videos", "u", outcome=oc)))
        self.assertEqual(n, 3)
        self.assertTrue(oc["pagination_complete"])
        self.assertEqual(oc["stopped_reason"], "end_of_listing")

    def test_bot_check_and_429(self):
        for msg, kind in (("Sign in to confirm you are not a bot", "bot_check"),
                          ("HTTP Error 429: Too Many Requests", "rate_limited")):
            os.environ["STUB_STDERR"] = msg
            oc = {}
            list(inventory.enumerate_listing(self.chan, "videos", "u", outcome=oc))
            self.assertEqual(oc["blocker_kind"], kind, msg)
            self.assertFalse(oc["pagination_complete"])
            self.assertEqual(oc["stopped_reason"], "rate_limited")

    def test_nonzero_exit_is_incomplete(self):
        os.environ["STUB_RC"] = "1"
        oc = {}
        list(inventory.enumerate_listing(self.chan, "videos", "u", outcome=oc))
        self.assertFalse(oc["pagination_complete"])
        self.assertEqual(oc["stopped_reason"], "error")

    # -- persistence -----------------------------------------------------
    def test_dedupe_across_listings_22_1(self):
        os.environ["STUB_N"] = "3"
        inventory.run_listing(self.chan, "streams", "u")
        vids = self.fake.tables["vr_videos"]
        self.assertEqual(len(vids), 3)
        first_seen = {k: v["first_seen_at"] for k, v in vids.items()}
        self.assertTrue(all(v["video_type"] == "livestream" for v in vids.values()))

        # same three videos, now via the playlist: one row each, type not downgraded,
        # first_seen_at untouched, channel_name not nulled out.
        inventory.run_listing(self.pl, "playlist", "u")
        vids = self.fake.tables["vr_videos"]
        self.assertEqual(len(vids), 3, "a video in a tab and a playlist is ONE row")
        self.assertTrue(all(v["video_type"] == "livestream" for v in vids.values()))
        self.assertEqual({k: v["first_seen_at"] for k, v in vids.items()}, first_seen)
        self.assertTrue(all(v["channel_name"] for v in vids.values()))
        self.assertEqual(len(self.fake.tables["vr_playlist_members"]), 3)
        # every discovered video gets both stages
        stages = {k[1] for k in self.fake.tables["vr_video_stages"]}
        self.assertEqual(stages, {"DISCOVERED", "METADATA_ONLY"})
        self.assertEqual(len(self.fake.tables["vr_video_stages"]), 6)

    def test_new_items_counted_once(self):
        os.environ["STUB_N"] = "3"
        a = inventory.run_listing(self.chan, "videos", "u")
        b = inventory.run_listing(self.chan, "videos", "u")
        self.assertEqual(a["new_items"], 3)
        self.assertEqual(b["new_items"], 0, "a re-run discovers nothing new")

    def test_blocked_listing_logs_blocker_and_incomplete_run(self):
        os.environ["STUB_STDERR"] = "ERROR: Sign in to confirm you are not a bot"
        inventory.run_listing(self.chan, "videos", "u")
        self.assertEqual([b["kind"] for b in self.fake.blockers], ["bot_check"])
        run = list(self.fake.tables["vr_inventory_runs"].values())[-1]
        self.assertFalse(run["pagination_complete"])
        self.assertEqual(run["stopped_reason"], "rate_limited")
        self.assertEqual(run["cutoff_at"], run["started_at"])

    # -- coverage --------------------------------------------------------
    def test_ratio_is_none_when_pagination_incomplete(self):
        os.environ["STUB_N"] = "9"
        inventory.run_listing(self.chan, "videos", "u", limit=4)   # capped -> incomplete
        rep = inventory.coverage_report(["official-sniper-trading"])
        lst = rep["sources"]["official-sniper-trading"]["listings"]["videos"]
        self.assertFalse(lst["pagination_complete"])
        self.assertIsNone(lst["ratio"])
        self.assertIn("denominator unknown", lst["ratio_note"])
        self.assertIsNone(rep["sources"]["official-sniper-trading"]["items_seen_total"])

    def test_ratio_present_only_on_complete_listing(self):
        os.environ["STUB_N"] = "4"
        inventory.run_listing(self.chan, "videos", "u")
        rep = inventory.coverage_report(["official-sniper-trading"])
        lst = rep["sources"]["official-sniper-trading"]["listings"]["videos"]
        self.assertTrue(lst["pagination_complete"])
        self.assertEqual(lst["items_seen"], 4)
        self.assertIsNotNone(lst["ratio"])
        # streams/shorts were never walked: still no ratio
        src = rep["sources"]["official-sniper-trading"]
        self.assertIsNone(src["listings"]["streams"]["ratio"])
        self.assertFalse(src["all_listings_complete"])

    def test_unresolved_sources_are_never_enumerated(self):
        keys = {s["source_key"] for s in sources.confirmed()}
        self.assertNotIn("crypto-insider", keys)
        self.assertNotIn("related-candidates", keys)
        rep = inventory.coverage_report(["crypto-insider"])
        self.assertFalse(rep["sources"]["crypto-insider"]["enumerated"])
        self.assertEqual(rep["sources"]["crypto-insider"]["listings"], {})


if __name__ == "__main__":
    unittest.main(verbosity=2)
