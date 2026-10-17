"""AuraZ inference service. Pure Python standard library: runs on IBM LinuxONE (s390x) with nothing to install.
    python3 ml/serve.py [port]      # default 8080
GET  /health  -> platform facts (arch, IBM machine type, NNPA flag) read from the host
POST /score   -> {"batch": [[16 features], ...]} -> {"risk": [...], "compute_us": float, "server": {...}}
"""
import json, math, os, platform, sys, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public")
M = json.load(open(os.path.join(ROOT, "model.json")))
MU, SD, W, B = M["mean"], M["std"], M["coef"], M["intercept"]

def host():
    info = dict(arch=platform.machine(), python=platform.python_version(), machine=None, nnpa=False)
    try:
        txt = open("/proc/cpuinfo").read()
        for line in txt.splitlines():
            if line.startswith("machine"):
                info["machine"] = line.split("=")[-1].strip().split(",")[0]; break
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

class H(BaseHTTPRequestHandler):
    def _send(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        for k, v in (("Content-Type", "application/json"), ("Access-Control-Allow-Origin", "*"),
                     ("Access-Control-Allow-Headers", "content-type"), ("Content-Length", str(len(body)))):
            self.send_header(k, v)
        self.end_headers(); self.wfile.write(body)
    def do_OPTIONS(self): self._send(204, {})
    def do_GET(self):
        if self.path.startswith("/health"): self._send(200, dict(ok=True, features=len(W), **HOST))
        else: self._send(404, {"error": "not found"})
    def do_POST(self):
        if not self.path.startswith("/score"): return self._send(404, {"error": "not found"})
        try:
            batch = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))))["batch"]
            assert all(len(r) == len(W) for r in batch)
        except Exception:
            return self._send(400, {"error": f"expected {{batch: [[{len(W)} numbers], ...]}}"})
        t = time.perf_counter_ns()
        risk = [score(r) for r in batch]
        us = (time.perf_counter_ns() - t) / 1e3
        self._send(200, dict(risk=risk, compute_us=us, n=len(batch), **{k: HOST[k] for k in ("arch", "machine", "system", "nnpa")}))
    def log_message(self, *a): pass

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    print(f"AuraZ inference on {HOST['system']} [{HOST['arch']}] machine={HOST['machine']} nnpa={HOST['nnpa']} -> :{port}", flush=True)
    ThreadingHTTPServer(("0.0.0.0", port), H).serve_forever()
