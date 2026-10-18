"""Server tests (stdlib only):  python3 -m unittest ml/test_serve.py"""
import json, os, sys, threading, unittest, urllib.request
from http.server import ThreadingHTTPServer
sys.path.insert(0, os.path.dirname(__file__))
os.environ["AURAZ_AUDIT"] = os.path.join(os.path.dirname(__file__), "..", ".test_alerts.log")
import serve  # noqa: E402

ROOT = os.path.join(os.path.dirname(__file__), "..")
def post(port, path, body):
    req = urllib.request.Request(f"http://127.0.0.1:{port}{path}", data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
    try: return urllib.request.urlopen(req).status, json.load(urllib.request.urlopen(req))
    except urllib.error.HTTPError as e: return e.code, json.load(e)

class T(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.srv = ThreadingHTTPServer(("127.0.0.1", 0), serve.H); cls.port = cls.srv.server_address[1]
        threading.Thread(target=cls.srv.serve_forever, daemon=True).start()
    @classmethod
    def tearDownClass(cls):
        cls.srv.shutdown()
        try: os.remove(os.environ["AURAZ_AUDIT"])
        except OSError: pass
    def test_health(self):
        h = json.load(urllib.request.urlopen(f"http://127.0.0.1:{self.port}/health"))
        self.assertTrue(h["ok"]); self.assertEqual(h["features"], 16)
    def test_score_matches_reference(self):
        x = [80, 85, 120, 16, 36.8, 97, 1.1, 8, 0.66, 0, 0, 0, 0, 0, 85, 82]
        st, r = post(self.port, "/score", {"batch": [x]}); self.assertEqual(st, 200)
        self.assertAlmostEqual(r["risk"][0], 0.008379621919984415, places=12)
    def test_bad_width_is_400(self):
        self.assertEqual(post(self.port, "/score", {"batch": [[1, 2, 3]]})[0], 400)
    def test_real_model_parity_with_sklearn(self):
        if not serve.G: self.skipTest("no model_physionet.json")
        s = json.load(open(os.path.join(ROOT, "public", "physionet_samples.json")))
        st, r = post(self.port, "/score_real", {"batch": s["rows"][:60]}); self.assertEqual(st, 200)
        self.assertLess(max(abs(a - b) for a, b in zip(r["risk"], s["expected"][:60])), 1e-12)
    def test_fhir_bundle(self):
        b = json.load(open(os.path.join(ROOT, "docs", "examples_fhir_bundle.json")))
        st, r = post(self.port, "/fhir/score", b); self.assertEqual(st, 200)
        self.assertEqual(r["resourceType"], "RiskAssessment"); self.assertTrue(r["hours"][-1]["alert"])
        self.assertTrue(os.path.exists(os.environ["AURAZ_AUDIT"]))
    def test_fhir_rejects_empty_bundle(self):
        st, r = post(self.port, "/fhir/score", {"resourceType": "Bundle", "entry": []})
        self.assertEqual(st, 400); self.assertEqual(r["resourceType"], "OperationOutcome")

if __name__ == "__main__": unittest.main()
