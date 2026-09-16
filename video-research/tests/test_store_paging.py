"""store.get_all: completeness. A short read that looks like an empty one is the bug.

The production symptom this comes from: 541 Kyle Doops transcripts fetched and scanned,
2 readable. Nothing errored. The server capped a `limit=10000` read and the caller took
the truncated answer as the whole table.
"""
import pathlib
import sys
import unittest
import urllib.parse

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import store


class FakeServer:
    """Serves rows honouring offset, but caps every response at `cap` rows."""

    def __init__(self, n_rows, cap):
        self.rows = [{"video_id": f"v{i:05d}"} for i in range(n_rows)]
        self.cap = cap
        self.requests = []

    def __call__(self, url, method="GET", body=None, headers=None, **kw):
        q = urllib.parse.parse_qs(urllib.parse.urlparse(url).query)
        limit = int(q.get("limit", ["1000"])[0])
        offset = int(q.get("offset", ["0"])[0])
        self.requests.append((offset, limit))
        return self.rows[offset:offset + min(limit, self.cap)]


class Completeness(unittest.TestCase):
    def setUp(self):
        self._req, self._conf = store._req, store.configured
        store.configured = lambda: True

    def tearDown(self):
        store._req, store.configured = self._req, self._conf

    def _run(self, n_rows, cap, page=None):
        store._req = FakeServer(n_rows, cap)
        got = store.get_all("t", "select=video_id", order="video_id", page=page)
        return got, store._req

    def test_every_row_comes_back_when_the_cap_equals_the_page(self):
        got, _ = self._run(3772, cap=1000, page=1000)
        self.assertEqual(len(got), 3772)

    def test_every_row_comes_back_when_the_cap_is_BELOW_the_page(self):
        """The trap: a short page is what a low server cap looks like, not the end."""
        got, _ = self._run(3772, cap=500, page=1000)
        self.assertEqual(len(got), 3772, "stopped at the first short page — rows lost")

    def test_it_stops_on_an_empty_page_not_a_short_one(self):
        got, srv = self._run(1500, cap=1000, page=1000)
        self.assertEqual(len(got), 1500)
        self.assertEqual(srv.requests[-1][0], 1500, "did not probe past the last full page")

    def test_no_rows_at_all_is_an_empty_list_not_an_error(self):
        got, srv = self._run(0, cap=1000)
        self.assertEqual(got, [])
        self.assertEqual(len(srv.requests), 1)

    def test_exactly_one_page_still_terminates(self):
        got, _ = self._run(1000, cap=1000, page=1000)
        self.assertEqual(len(got), 1000)

    def test_rows_are_not_duplicated_across_pages(self):
        got, _ = self._run(2500, cap=1000, page=1000)
        self.assertEqual(len({r["video_id"] for r in got}), 2500)


class Guards(unittest.TestCase):
    def setUp(self):
        self._req, self._conf, self._max = store._req, store.configured, store.MAX_PAGES
        store.configured = lambda: True

    def tearDown(self):
        store._req, store.configured = self._req, self._conf
        store.MAX_PAGES = self._max

    def test_a_server_that_never_runs_out_raises_rather_than_looping_forever(self):
        store.MAX_PAGES = 5
        store._req = lambda *a, **k: [{"video_id": "x"}]
        with self.assertRaises(RuntimeError) as ctx:
            store.get_all("t", "select=video_id", order="video_id", page=1)
        self.assertIn("without the server running out", str(ctx.exception))

    def test_the_order_clause_is_sent(self):
        """Offset paging over an unordered result can repeat one row and skip another."""
        seen = []
        store._req = lambda url, **k: seen.append(url) or []
        store.get_all("t", "select=video_id", order="video_id,lang")
        self.assertIn("order=video_id,lang", seen[0])

    def test_it_works_without_a_query(self):
        store._req = lambda url, **k: []
        self.assertEqual(store.get_all("t", order="video_id"), [])


class PlainGetIsUnchanged(unittest.TestCase):
    """get() stays single-shot on purpose — bounded reads must not pay for paging."""

    def test_get_issues_exactly_one_request(self):
        calls = []
        _req, _conf = store._req, store.configured
        store.configured = lambda: True
        store._req = lambda url, **k: calls.append(url) or [{"a": 1}]
        try:
            store.get("t", "select=a&limit=5")
        finally:
            store._req, store.configured = _req, _conf
        self.assertEqual(len(calls), 1)


if __name__ == "__main__":
    unittest.main(verbosity=0, exit=False)
    print("OK")
