"""Many slow clients at once (like many ICU monitors): N keep-alive connections, each sends one patient-hour every ~1 s.
    python3 ml/concurrency_test.py [base_url] [seconds]   ->   public/concurrency.json
Run it ON the machine under test (the load generator shares its CPUs, so results are conservative).
"""
import http.client, json, os, random, resource, sys, threading, time
from urllib.parse import urlparse

base = urlparse(sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8080"); SECS = float(sys.argv[2]) if len(sys.argv) > 2 else 12
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public")
rows = json.load(open(os.path.join(ROOT, "physionet_samples.json")))["rows"]
try: resource.setrlimit(resource.RLIMIT_NOFILE, (resource.getrlimit(resource.RLIMIT_NOFILE)[1],) * 2)
except Exception: pass

def client(deadline, out, i):
    lat, ok, err = [], 0, 0
    try: c = http.client.HTTPConnection(base.hostname, base.port, timeout=15); c.connect()
    except Exception: out.append((lat, 0, 1)); return
    time.sleep(random.random())                                          # spread the clients over the first second
    while time.perf_counter() < deadline:
        t = time.perf_counter()
        try:
            c.request("POST", "/score_real", json.dumps({"batch": [rows[(i + ok) % len(rows)]]}), {"Content-Type": "application/json"}); r = c.getresponse(); r.read()
            if r.status == 200: lat.append((time.perf_counter() - t) * 1000); ok += 1
            else: err += 1
        except Exception: err += 1; break
        time.sleep(max(0, 1.0 - (time.perf_counter() - t)))
    out.append((lat, ok, err))

h = http.client.HTTPConnection(base.hostname, base.port); h.request("GET", "/health"); info = json.load(h.getresponse())
print(f"{info['system']} [{info['arch']}] machine={info['machine']}  ({os.cpu_count()} CPUs)")
print(f"{'connections':>11} {'requests':>9} {'ok %':>7} {'p50 ms':>8} {'p99 ms':>8} {'max ms':>8} {'errors':>7}")
res = []
for n in (100, 500, 1000, 2000):
    out = []; deadline = time.perf_counter() + SECS
    ts = [threading.Thread(target=client, args=(deadline, out, i), daemon=True) for i in range(n)]
    try:
        [t.start() for t in ts]
    except RuntimeError as e:
        print("could not start", n, "threads:", e); break
    [t.join(SECS + 20) for t in ts]
    lat = sorted(x for l, _, _ in out for x in l); ok = sum(o[1] for o in out); err = sum(o[2] for o in out) + (n - len(out))
    q = lambda p: lat[min(len(lat) - 1, int(len(lat) * p))] if lat else float("nan")
    r = dict(connections=n, requests=ok + err, success_pct=round(100 * ok / max(1, ok + err), 2), p50_ms=round(q(.5), 2), p99_ms=round(q(.99), 2), max_ms=round(lat[-1], 1) if lat else None, errors=err)
    res.append(r); print(f"{n:>11} {r['requests']:>9} {r['success_pct']:>7} {r['p50_ms']:>8} {r['p99_ms']:>8} {r['max_ms']:>8} {err:>7}")
    time.sleep(2)
json.dump(dict(host=dict(system=info["system"], arch=info["arch"], machine=info["machine"], cpus=os.cpu_count()), seconds_per_level=SECS, results=res,
               note="each connection sends one patient-hour per second against the 300-tree model; client and server share the same VM"), open(os.path.join(ROOT, "concurrency.json"), "w"), indent=1)
print("wrote public/concurrency.json")
