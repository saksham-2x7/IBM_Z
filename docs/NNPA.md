# Running AuraZ on the IBM Telum II accelerator (NNPA)

Measured on a real **IBM z17 (machine type 9175, Telum II)** on the IBM LinuxONE Community Cloud (Ubuntu 24.04, s390x, 2 vCPUs) with **IBM zDNN 1.0.1**. All numbers are in `public/nnpa_z17.json`.

## What runs on the accelerator
**AuraZ-N**, a neural-network variant of the real-data model: a 108 → 64 → 32 → 1 network (ReLU, sigmoid, 9,089 parameters) trained on the same 14,635 PhysioNet stays and the same patient-level split as AuraZ-R. Hyperparameters were chosen on the calibration split, never on the test split (`ml/train_physionet_mlp.py`). The three dense layers run back to back on the chip with no host round trip (`ml/nnpa_mlp.c`: `zdnn_matmul_op` + `zdnn_relu` / `zdnn_sigmoid`).

| Result (32,768 held-out patient-hours, 346 septic) | Value |
|---|---|
| AuraZ-N AUROC, full test set (2,927 stays) | 0.800 (95% CI 0.774–0.827); AuraZ-R trees reach 0.819 |
| AUROC on the same 32,768 rows, FP32 reference | 0.80859 |
| AUROC on the same rows, **computed on the accelerator** | **0.80858** (change −0.00001) |
| Same alert decision as FP32 (top-5% threshold) | 99.994% |
| Largest probability difference | 0.00065 (the chip computes in 16-bit DLFLOAT16) |
| Time, 32,768 rows, 3 layers | **10.9 ms on NNPA** vs 354.9 ms plain CPU loop (**32.6×**); 7.5 ms of it is compute (47×) |
| Same network with **OpenBLAS** (tuned for s390x), same VM | 15.9 ms on 1 CPU thread (NNPA **1.46×** faster; 2.1× compute-only); 12.7 ms on both threads (NNPA **1.16×** faster; 1.7× compute-only) |

## Where the accelerator helps, and where it does not
Single-layer microbenchmark (`ml/nnpa_logreg.c`), including host↔accelerator data conversion:

| Workload | Rows | Result vs the CPU loop |
|---|---|---|
| AuraZ logistic regression (16 → 1) | 64 to 32,768 | **2–4× slower**: the model is too small, conversion costs more than the arithmetic |
| Synthetic wide layer (16 → 512, ReLU) | 1,024 | 68× faster |
| Synthetic wide layer (16 → 512, ReLU) | 16,384 | 14× faster |

**Honest caveats**
- The 33× figure is against a plain single-thread C loop (`gcc -O2`). **Against OpenBLAS, a tuned library, the accelerator is about 1.5× faster than one CPU thread and 1.2× faster than both threads on this 2-vCPU VM.** The honest headline is therefore "33× over a plain loop, about 1.2–1.5× over a tuned library, with the CPU cores left free" (`ml/cpu_blas_mlp.c`).
- **AuraZ-R (gradient-boosted trees, our most accurate model, AUROC 0.819) is a tree ensemble. It runs on the CPU and is not an accelerator workload.** The accelerator speaks dense neural networks.
- AuraZ-N is 0.02 AUROC below AuraZ-R. That is the price of using the accelerator.
- IBM Z is **big-endian**: binary files for the C program are written big-endian (`ml/train_physionet_mlp.py`); the JSON models are unaffected.

## Reproduce on LinuxONE
```bash
# on your laptop
python3 ml/train_physionet_mlp.py          # trains AuraZ-N, writes build/nnpa/{weights,x,expected,y}.bin (big-endian) and public/metrics_mlp.json
# on the LinuxONE VM (Ubuntu 24.04 s390x)
sudo apt-get install -y gcc libzdnn-dev    # IBM's zDNN library is packaged by Ubuntu
gcc -O2 -o nnpa_mlp   ml/nnpa_mlp.c   -lzdnn -lm
gcc -O2 -o nnpa_logreg ml/nnpa_logreg.c -lzdnn -lm
sudo apt-get install -y libopenblas-dev && gcc -O3 -o cpu_blas_mlp ml/cpu_blas_mlp.c -lopenblas -lm   # tuned CPU baseline
OPENBLAS_NUM_THREADS=1 ./cpu_blas_mlp weights.bin x.bin 32768 out_nnpa.bin
./nnpa_mlp weights.bin x.bin 32768 out_nnpa.bin > run.json
./nnpa_logreg model.json > nnpa_result.json
# back on your laptop: score the accelerator's output
python3 scripts/nnpa_eval.py build/nnpa/out_nnpa.bin build/nnpa/run.json   # writes public/nnpa_z17.json
```

## Load test on the z17 (`ml/loadtest.py`, `public/loadtest_z17.json`)
The AuraZ-R trees behind `ml/serve.py` (pure Python, CPU), driven by concurrent clients on the same 2-vCPU VM, so numbers are conservative:

| | 1 worker | 2 workers |
|---|---|---|
| Peak scores/second (batch 100) | 6,492 | **11,870** (p50 15 ms) |
| One patient-hour per request, median latency | 0.27 ms | 0.27 ms |

The first load test found a real bug: single requests were stuck at a flat 50 ms because the server sent headers and body in separate writes (Nagle's algorithm + delayed ACK). Setting `TCP_NODELAY` (`disable_nagle_algorithm = True`) cut the median to 0.27 ms.

## What was installed on the VM, and how to undo it
`gcc`, `libzdnn-dev`, `libopenblas-dev` (and dependencies) via `apt`, plus files under `~/auraz`. To remove: `sudo apt-get remove -y gcc libzdnn-dev libopenblas-dev && sudo apt-get autoremove -y && rm -rf ~/auraz`.
