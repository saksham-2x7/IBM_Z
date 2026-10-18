/*
 * Optimised-CPU baseline for AuraZ-N on the z17: the same 108-64-32-1 network, forward pass with OpenBLAS sgemm
 * (vector-tuned for s390x), so the accelerator speed-up is compared with a tuned library, not a naive loop.
 *
 *   gcc -O3 -o cpu_blas_mlp ml/cpu_blas_mlp.c -lopenblas -lm
 *   OPENBLAS_NUM_THREADS=1 ./cpu_blas_mlp weights.bin x.bin 32768 nnpa_out.bin   (reads the files written by ml/train_physionet_mlp.py)
 */
#include <cblas.h>
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

static double now_ms(void) { struct timespec t; clock_gettime(CLOCK_MONOTONIC, &t); return t.tv_sec * 1e3 + t.tv_nsec / 1e6; }

int main(int argc, char **argv) {
  if (argc < 4) { fprintf(stderr, "usage: %s weights.bin x.bin n_rows [nnpa_out.bin]\n", argv[0]); return 2; }
  FILE *f = fopen(argv[1], "rb"); int nl; if (!f || fread(&nl, 4, 1, f) != 1) return 2;
  int in[8], out[8]; float *W[8], *b[8];
  for (int l = 0; l < nl; l++) {
    if (fread(&in[l], 4, 1, f) != 1 || fread(&out[l], 4, 1, f) != 1) return 2;
    W[l] = malloc(4L * in[l] * out[l]); b[l] = malloc(4L * out[l]);
    if (fread(W[l], 4, (size_t)in[l] * out[l], f) != (size_t)in[l] * out[l] || fread(b[l], 4, out[l], f) != (size_t)out[l]) return 2;
  }
  fclose(f);
  int n = atoi(argv[3]), d = in[0];
  float *X = malloc(4L * n * d), *A = malloc(4L * n * 128), *B = malloc(4L * n * 128);
  f = fopen(argv[2], "rb"); if (!f || fread(X, 4, (size_t)n * d, f) != (size_t)n * d) return 2; fclose(f);

  double best = 1e18;
  for (int r = 0; r < 8; r++) {
    double t0 = now_ms(); const float *cur = X; float *dst = A, *other = B;
    for (int l = 0; l < nl; l++) {
      for (int i = 0; i < n; i++) memcpy(dst + (long)i * out[l], b[l], 4L * out[l]);           /* bias */
      cblas_sgemm(CblasRowMajor, CblasNoTrans, CblasNoTrans, n, out[l], in[l], 1.0f, cur, in[l], W[l], out[l], 1.0f, dst, out[l]);
      long m = (long)n * out[l];
      if (l < nl - 1) for (long i = 0; i < m; i++) { if (dst[i] < 0) dst[i] = 0; }
      else for (long i = 0; i < m; i++) dst[i] = 1.0f / (1.0f + expf(-dst[i]));
      cur = dst; float *t = dst; dst = other; other = t;
    }
    double ms = now_ms() - t0; if (ms < best) best = ms;
  }
  const float *res = A; /* final output lives in the buffer written last */
  /* recompute pointer: after the loop 'cur' points to the last written buffer; simple approach: rerun once and keep pointer */
  { const float *cur = X; float *dst = A, *other = B;
    for (int l = 0; l < nl; l++) { for (int i = 0; i < n; i++) memcpy(dst + (long)i * out[l], b[l], 4L * out[l]);
      cblas_sgemm(CblasRowMajor, CblasNoTrans, CblasNoTrans, n, out[l], in[l], 1.0f, cur, in[l], W[l], out[l], 1.0f, dst, out[l]);
      long m = (long)n * out[l]; if (l < nl - 1) for (long i = 0; i < m; i++) { if (dst[i] < 0) dst[i] = 0; } else for (long i = 0; i < m; i++) dst[i] = 1.0f / (1.0f + expf(-dst[i]));
      cur = dst; float *t = dst; dst = other; other = t; }
    res = cur; }
  double maxd = -1;
  if (argc > 4) { FILE *g = fopen(argv[4], "rb"); if (g) { float *y = malloc(4L * n); if (fread(y, 4, n, g) == (size_t)n) { maxd = 0; for (int i = 0; i < n; i++) { double dd = fabs(y[i] - res[i]); if (dd > maxd) maxd = dd; } } fclose(g); } }
  const char *th = getenv("OPENBLAS_NUM_THREADS");
  printf("{\"rows\": %d, \"openblas_threads\": %s, \"openblas_ms\": %.3f, \"max_abs_diff_vs_nnpa\": %.6f}\n", n, th ? th : "\"default\"", best, maxd);
  return 0;
}
