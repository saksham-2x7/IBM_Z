"""Score the accelerator's output: does running AuraZ-N on the Telum II NNPA change its accuracy?
    python3 scripts/nnpa_eval.py build/nnpa/out_nnpa.bin build/nnpa/nnpa_run.json  ->  public/nnpa_z17.json
Compares AUROC of the NNPA probabilities against the FP32 sklearn probabilities on the same 32,768 held-out rows.
"""
import json, os, sys
import numpy as np
from sklearn.metrics import roc_auc_score

R = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
B = os.path.join(R, "build", "nnpa")
out = np.fromfile(sys.argv[1], dtype=">f4").astype(np.float32)  # written by the C program on big-endian s390x
run = json.load(open(sys.argv[2]))
exp = np.fromfile(os.path.join(B, "expected.bin"), dtype="<f4"); y = np.fromfile(os.path.join(B, "y.bin"), dtype=np.int8)
kern = json.load(open(os.path.join(R, "build", "nnpa", "kernels.json"))) if os.path.exists(os.path.join(B, "kernels.json")) else None
mlp = json.load(open(os.path.join(R, "public", "metrics_mlp.json")))
res = dict(host="IBM z17 (machine 9175, Telum II), LinuxONE Community Cloud, IBM zDNN 1.0.1",
           model=mlp["model"], rows=int(len(y)), septic_rows=int(y.sum()),
           auroc_fp32_sklearn=float(roc_auc_score(y, exp)), auroc_on_nnpa=float(roc_auc_score(y, out)),
           auroc_change=float(roc_auc_score(y, out) - roc_auc_score(y, exp)),
           full_test_auroc_fp32=mlp["auroc"], full_test_auroc_ci95=mlp["auroc_ci95"],
           max_abs_prob_diff=float(np.abs(out - exp).max()), mean_abs_prob_diff=float(np.abs(out - exp).mean()),
           alert_agreement_at_threshold=None, timing=run, kernel_benchmark=kern,
           notes=["NNPA computes in 16-bit DLFLOAT16; outputs differ slightly from FP32.",
                  "CPU baseline is a naive single-thread C loop (-O2), not an optimised BLAS, so speedups overstate the gain over a tuned CPU library.",
                  "AuraZ-R (gradient-boosted trees) is a CPU model; tree ensembles are not an NNPA workload."])
# decision agreement at a 5% alert rate
thr = float(np.quantile(exp, 0.95)); res["alert_agreement_at_threshold"] = float(((exp >= thr) == (out >= thr)).mean()); res["alert_threshold_top5pct"] = thr
json.dump(res, open(os.path.join(R, "public", "nnpa_z17.json"), "w"), indent=1)
print(json.dumps({k: v for k, v in res.items() if k not in ("kernel_benchmark", "notes")}, indent=1))
