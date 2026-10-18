"""Load test for ml/serve.py (stdlib only). Run it ON the host you want to measure:
    python3 ml/loadtest.py [base_url] [seconds_per_config]  ->  prints a table, writes public/loadtest.json
Note: the load generator shares the machine with the server, so figures are conservative.
"""
import http.client, json, os, platform, statistics, sys, threading, time
from urllib.parse import urlparse

base = urlparse(sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8080")
SECS = float(sys.argv[2]) if len(sys.argv) > 2 else 6
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public")
rows = json.load(open(os.path.join(ROOT, "physionet_samples.json")))["rows"]

def worker(path, batch, deadline, out):
    c = http.client.HTTPConnection(base.hostname, base.port, timeout=30); lat = []; n = 0; err = 0; i = 0
    while time.perf_counter() < deadline:
        body = json.dumps({"batch": [rows[(i + k) % len(rows)] for k in range(batch)]}); i += batch
        t = time.perf_counter()
        try:
            c.request("POST", path, body, {"Content-Type": "application/json"}); r = c.getresponse(); r.read()
            if r.status == 200: lat.append((time.perf_counter() - t) * 1000); n += batch
            else: err += 1
        except Exception:
            err += 1; c = http.client.HTTPConnection(base.hostname, base.port, timeout=30)
    out.append((lat, n, err))

def run(path, clients, batch):
    out = []; deadline = time.perf_counter() + SECS; t0 = time.perf_counter()
    ts = [threading.Thread(target=worker, args=(path, batch, deadline, out)) for _ in range(clients)]
    [t.start() for t in ts]; [t.join() for t in ts]; dt = time.perf_counter() - t0
    lat = sorted(x for l, _, _ in out for x in l); n = sum(o[1] for o in out); err = sum(o[2] for o in out)
    q = lambda p: lat[min(len(lat) - 1, int(len(lat) * p))] if lat else float("nan")
    return dict(endpoint=path, clients=clients, batch=batch, requests=len(lat), scores_per_s=round(n / dt), requests_per_s=round(len(lat) / dt, 1),
                p50_ms=round(q(.5), 2), p95_ms=round(q(.95), 2), p99_ms=round(q(.99), 2), errors=err)

h = http.client.HTTPConnection(base.hostname, base.port); h.request("GET", "/health"); info = json.load(h.getresponse())
print(f"{info['system']} [{info['arch']}] machine={info['machine']}  ({os.cpu_count()} CPUs, python {platform.python_version()})")
res = []
print(f"{'endpoint':12} {'clients':>7} {'batch':>6} {'scores/s':>10} {'req/s':>8} {'p50 ms':>8} {'p95 ms':>8} {'p99 ms':>8} {'err':>4}")
for path, batch in (("/score_real", 1), ("/score_real", 100)):
    for clients in (1, 2, 4, 8):
        r = run(path, clients, batch); res.append(r)
        print(f"{r['endpoint']:12} {clients:>7} {batch:>6} {r['scores_per_s']:>10,} {r['requests_per_s']:>8} {r['p50_ms']:>8} {r['p95_ms']:>8} {r['p99_ms']:>8} {r['errors']:>4}")
peak = max(res, key=lambda r: r["scores_per_s"])
json.dump(dict(host=dict(system=info["system"], arch=info["arch"], machine=info["machine"], nnpa=info["nnpa"], cpus=os.cpu_count()),
               seconds_per_config=SECS, results=res, peak=peak, note="client and server share this machine; model is the 300-tree real-data model; CPU only"),
          open(os.path.join(ROOT, "loadtest.json"), "w"), indent=1)
print(f"\npeak {peak['scores_per_s']:,} scores/s ({peak['clients']} clients, batch {peak['batch']}); wrote public/loadtest.json")
