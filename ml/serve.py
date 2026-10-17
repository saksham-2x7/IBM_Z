"""AuraZ inference service. Pure Python standard library: runs on IBM LinuxONE (s390x) with nothing to install.
    python3 ml/serve.py [port]      # default 8080
GET  /health  -> platform facts (arch, IBM machine type, NNPA flag) read from the host
POST /score   -> {"batch": [[16 features], ...]} -> {"risk": [...], "compute_us": float, "server": {...}}
POST /fhir/score -> FHIR Bundle of Observations (one patient) -> FHIR RiskAssessment + per-hour risks, alert, drivers; alerts are appended to alerts.log
POST /score_real -> same, for the AuraZ-R real-data trees ({"batch": [[108 features or null], ...]})
"""
import json, math, os, platform, re, sys, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public")
M = json.load(open(os.path.join(ROOT, "model.json")))
MU, SD, W, B = M["mean"], M["std"], M["coef"], M["intercept"]
_g = os.path.join(ROOT, "model_physionet.json")
G = json.load(open(_g)) if os.path.exists(_g) else None  # AuraZ-R real-data trees (optional)

def host():
    info = dict(arch=platform.machine(), python=platform.python_version(), machine=None, nnpa=False)
    try:
        txt = open("/proc/cpuinfo").read()
        m = re.search(r"machine\s*[:=]\s*(\d+)", txt)
        info["machine"] = m.group(1) if m else None
        info["nnpa"] = " nnpa" in txt
    except OSError:
        pass
    # IBM machine types: 9175 = z17 (Telum II), 3931 = z16 (Telum)
    info["system"] = {"9175": "IBM z17 (Telum II)", "3931": "IBM z16 (Telum)"}.get(info["machine"], platform.system())
    return info
HOST = host()

def score(x):
    z = B
    for i in range(len(W)):
        z += W[i] * ((x[i] - MU[i]) / SD[i])
    return 1 / (1 + math.exp(-z))

def score_gbm(x):
    z = G["baseline"]
    for t in G["trees"]:
        i = 0
        while not t["leaf"][i]:
            xi = x[t["f"][i]]
            i = t["l"][i] if (t["m"][i] if xi is None else xi <= t["t"][i]) else t["r"][i]
        z += t["v"][i]
    return 1 / (1 + math.exp(-z))

# --- FHIR-style ingest -------------------------------------------------------------------------------
# POST /fhir/score takes a FHIR Bundle of Observations (LOINC-coded vitals/labs, any number of hours) for ONE patient
# and returns the risk per hour, the alert decision and the top plain-language drivers, as a FHIR RiskAssessment.
LOINC = {"8867-4": "hr", "8478-0": "map", "8480-6": "sbp", "9279-1": "rr", "8310-5": "temp", "2708-6": "spo2",
         "2524-7": "lactate", "6690-2": "wbc", "59408-5": "spo2", "32693-4": "lactate"}
CH = ["hr", "map", "sbp", "rr", "temp", "spo2", "lactate", "wbc"]

def bundle_to_hours(bundle):
    """Group Observations by hour index (effectiveDateTime truncated to the hour, relative to the first), forward-fill."""
    from datetime import datetime
    obs = []
    for e in bundle.get("entry", []):
        r = e.get("resource", {})
        if r.get("resourceType") != "Observation": continue
        code = next((c.get("code") for c in r.get("code", {}).get("coding", []) if c.get("code") in LOINC), None)
        q, t = r.get("valueQuantity", {}).get("value"), r.get("effectiveDateTime")
        if code and q is not None and t: obs.append((datetime.fromisoformat(t.replace("Z", "+00:00")), LOINC[code], float(q)))
    if not obs: raise ValueError("no usable Observations")
    t0 = min(o[0] for o in obs); n = int((max(o[0] for o in obs) - t0).total_seconds() // 3600) + 1
    vit = {c: [None] * n for c in CH}
    for t, c, q in sorted(obs, key=lambda o: o[0]): vit[c][int((t - t0).total_seconds() // 3600)] = q
    for c in CH:  # forward-fill
        last = None
        for i in range(n):
            if vit[c][i] is None: vit[c][i] = last
            else: last = vit[c][i]
        first = next((x for x in vit[c] if x is not None), None)
        if first is None: raise ValueError(f"no {c} observations")
        vit[c] = [first if x is None else x for x in vit[c]]
    return vit, n

def hour_features(v, h):
    g = lambda c, k=0: v[c][h - k]
    return [g("hr"), g("map"), g("sbp"), g("rr"), g("temp"), g("spo2"), g("lactate"), g("wbc"), g("hr") / g("sbp"),
            g("hr") - g("hr", 3), g("map") - g("map", 3), g("rr") - g("rr", 3), g("temp") - g("temp", 3),
            g("lactate") - g("lactate", 6), min(v["map"][h - 5:h + 1]), max(v["hr"][h - 5:h + 1])]

def fhir_assess(bundle):
    v, n = bundle_to_hours(bundle)
    if n < 7: raise ValueError("need at least 7 hours of observations")
    out = []
    for h in range(6, n):
        x = hour_features(v, h); p = score(x)
        contrib = sorted(((M["features"][i], W[i] * (x[i] - MU[i]) / SD[i]) for i in range(len(W))), key=lambda c: -abs(c[1]))[:3]
        out.append(dict(hour=h, risk=p, alert=p >= M["alert_threshold"],
                        uncertainty=("uncertain" if ((1 - p) <= M["qhat_pos"]) == (p <= M["qhat_neg"]) else
                                     "sepsis not ruled out" if (1 - p) <= M["qhat_pos"] else "ruled out"),
                        drivers=[dict(feature=f, log_odds=round(c, 3)) for f, c in contrib]))
    last = out[-1]
    return {"resourceType": "RiskAssessment", "status": "final",
            "method": {"text": "AuraZ logistic early-warning model (research prototype, not a medical device)"},
            "prediction": [{"outcome": {"text": "sepsis onset within 6 h"}, "probabilityDecimal": last["risk"],
                            "rationale": ", ".join(d["feature"] for d in last["drivers"])}],
            "note": [{"text": f"alert={last['alert']} uncertainty={last['uncertainty']}"}], "hours": out}

AUDIT = os.environ.get("AURAZ_AUDIT", os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "alerts.log"))
def audit(entry):
    with open(AUDIT, "a") as f: f.write(json.dumps(entry) + "\n")

class H(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"  # keep-alive: one TCP connection for many requests
    def _send(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        for k, v in (("Content-Type", "application/json"), ("Access-Control-Allow-Origin", "*"),
                     ("Access-Control-Allow-Headers", "content-type"), ("Content-Length", str(len(body)))):
            self.send_header(k, v)
        self.end_headers(); self.wfile.write(body)
    def do_OPTIONS(self): self._send(204, {})
    def do_GET(self):
        if self.path.startswith("/health"):
            self._send(200, dict(ok=True, features=len(W), real_model=(len(G["trees"]) if G else 0), real_features=(len(G["features"]) if G else 0), **HOST))
        else: self._send(404, {"error": "not found"})
    def do_POST(self):
        if self.path.startswith("/fhir/score"):
            try:
                res = fhir_assess(json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0)))))
            except Exception as e:
                return self._send(400, {"resourceType": "OperationOutcome", "issue": [{"severity": "error", "code": "invalid", "diagnostics": str(e)}]})
            last = res["hours"][-1]
            if last["alert"]: audit({"t": time.time(), "risk": last["risk"], "uncertainty": last["uncertainty"], "drivers": last["drivers"]})
            return self._send(200, res)
        real = self.path.startswith("/score_real")
        if not self.path.startswith("/score") or (real and not G): return self._send(404, {"error": "not found"})
        width, fn = (len(G["features"]), score_gbm) if real else (len(W), score)
        try:
            batch = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))))["batch"]
            assert all(len(r) == width for r in batch)
        except Exception:
            return self._send(400, {"error": f"expected {{batch: [[{width} numbers or null], ...]}}"})
        t = time.perf_counter_ns()
        risk = [fn(r) for r in batch]
        us = (time.perf_counter_ns() - t) / 1e3
        self._send(200, dict(risk=risk, compute_us=us, n=len(batch), **{k: HOST[k] for k in ("arch", "machine", "system", "nnpa")}))
    def log_message(self, *a): pass

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    print(f"AuraZ inference on {HOST['system']} [{HOST['arch']}] machine={HOST['machine']} nnpa={HOST['nnpa']} -> :{port}", flush=True)
    ThreadingHTTPServer(("0.0.0.0", port), H).serve_forever()
