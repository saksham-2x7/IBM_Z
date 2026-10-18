/*
 * AuraZ demo model (logistic regression, 16 features) on the IBM Z Telum II NNPA accelerator via IBM zDNN.
 *
 *   gcc -O2 -o nnpa_logreg ml/nnpa_logreg.c -lzdnn -lm
 *   ./nnpa_logreg public/model.json public/replay.json   (reads weights from model.json with a tiny parser; features
 *                                                        are synthesised from the replay-style ranges so no JSON lib is needed)
 *
 * score = sigmoid(X_std . w + b). On NNPA this is zdnn_matmul_op (with bias add) followed by zdnn_sigmoid.
 * NNPA computes in DLFLOAT16 (16-bit), so results differ from FP32 by a small amount; the program reports the error and
 * the time for CPU (FP32 loop) vs NNPA (including host<->accelerator format conversion) at several batch sizes.
 */
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <zdnn.h>

#define F 16

static double now_ms(void) { struct timespec t; clock_gettime(CLOCK_MONOTONIC, &t); return t.tv_sec * 1e3 + t.tv_nsec / 1e6; }

/* pull the first JSON array of numbers following "key" */
static int read_array(const char *txt, const char *key, double *out, int n) {
  char pat[64]; snprintf(pat, sizeof pat, "\"%s\"", key);
  const char *p = strstr(txt, pat); if (!p) return -1;
  p = strchr(p, '['); if (!p) return -1; p++;
  for (int i = 0; i < n; i++) { char *e; out[i] = strtod(p, &e); if (e == p) return -1; p = e; while (*p == ',' || *p == ' ') p++; }
  return 0;
}
static double read_scalar(const char *txt, const char *key) {
  char pat[64]; snprintf(pat, sizeof pat, "\"%s\"", key);
  const char *p = strstr(txt, pat); p = strchr(p, ':'); return strtod(p + 1, NULL);
}

static int check(zdnn_status s, const char *what) {
  if (s != ZDNN_OK) { fprintf(stderr, "zDNN error in %s: 0x%08x (%s)\n", what, s, zdnn_get_status_message(s)); return 1; }
  return 0;
}

/* dense layer on NNPA: Y = act(X[n x in] . W[in x out] + b[out]); times (ms) for host->NNPA transform, compute, NNPA->host transform */
static int nnpa_dense(const float *X, const float *W, const float *B, int n, int in, int out, int relu, float *Y, double *t_in, double *t_comp, double *t_out) {
  zdnn_tensor_desc pre_x, pre_w, pre_b, pre_y, t_x, t_w, t_b, t_y;
  zdnn_ztensor zx, zw, zb, zy, zs;
  zdnn_init_pre_transformed_desc(ZDNN_3DS, FP32, &pre_x, 1, n, in);
  zdnn_init_pre_transformed_desc(ZDNN_3DS, FP32, &pre_w, 1, in, out);
  zdnn_init_pre_transformed_desc(ZDNN_2DS, FP32, &pre_b, 1, out);
  zdnn_init_pre_transformed_desc(ZDNN_3DS, FP32, &pre_y, 1, n, out);
  if (check(zdnn_generate_transformed_desc(&pre_x, &t_x), "desc x")) return 1;
  if (check(zdnn_generate_transformed_desc(&pre_w, &t_w), "desc w")) return 1;
  if (check(zdnn_generate_transformed_desc(&pre_b, &t_b), "desc b")) return 1;
  if (check(zdnn_generate_transformed_desc(&pre_y, &t_y), "desc y")) return 1;
  if (check(zdnn_init_ztensor_with_malloc(&pre_x, &t_x, &zx), "alloc x")) return 1;
  if (check(zdnn_init_ztensor_with_malloc(&pre_w, &t_w, &zw), "alloc w")) return 1;
  if (check(zdnn_init_ztensor_with_malloc(&pre_b, &t_b, &zb), "alloc b")) return 1;
  if (check(zdnn_init_ztensor_with_malloc(&pre_y, &t_y, &zy), "alloc y")) return 1;
  if (check(zdnn_init_ztensor_with_malloc(&pre_y, &t_y, &zs), "alloc s")) return 1;
  double t0 = now_ms();
  if (check(zdnn_transform_ztensor(&zx, X), "transform x")) return 1;
  if (check(zdnn_transform_ztensor(&zw, W), "transform w")) return 1;
  if (check(zdnn_transform_ztensor(&zb, B), "transform b")) return 1;
  double t1 = now_ms();
  if (check(zdnn_matmul_op(&zx, &zw, &zb, MATMUL_OP_ADDITION, &zy), "matmul")) return 1;
  if (relu ? check(zdnn_relu(&zy, NULL, &zs), "relu") : check(zdnn_sigmoid(&zy, &zs), "sigmoid")) return 1;
  double t2 = now_ms();
  if (check(zdnn_transform_origtensor(&zs, Y), "transform out")) return 1;
  double t3 = now_ms();
  *t_in = t1 - t0; *t_comp = t2 - t1; *t_out = t3 - t2;
  zdnn_free_ztensor_buffer(&zx); zdnn_free_ztensor_buffer(&zw); zdnn_free_ztensor_buffer(&zb); zdnn_free_ztensor_buffer(&zy); zdnn_free_ztensor_buffer(&zs);
  return 0;
}

static void cpu_dense(const float *X, const float *W, const float *B, int n, int in, int out, int relu, float *Y) {
  for (int i = 0; i < n; i++) for (int o = 0; o < out; o++) {
    float z = B[o]; for (int j = 0; j < in; j++) z += X[i * in + j] * W[j * out + o];
    Y[i * out + o] = relu ? (z > 0 ? z : 0) : 1.0f / (1.0f + expf(-z));
  }
}

/* one benchmark case; prints a JSON object */
static int bench(const char *name, const float *W, const float *B, int n, int in, int out, int relu, int last) {
  float *X = malloc(sizeof(float) * n * in), *yc = malloc(sizeof(float) * n * out), *yn = malloc(sizeof(float) * n * out);
  for (int i = 0; i < n * in; i++) X[i] = (float)((rand() / (double)RAND_MAX) * 4.0 - 2.0);
  int reps = (long)n * in * out <= 2000000 ? 200 : 10;
  cpu_dense(X, W, B, n, in, out, relu, yc);                                  /* warm-up */
  double t0 = now_ms(); for (int r = 0; r < reps; r++) cpu_dense(X, W, B, n, in, out, relu, yc); double cpu = (now_ms() - t0) / reps;
  double bi = 1e18, bc = 1e18, bo = 1e18, ti, tc, to;
  nnpa_dense(X, W, B, n, in, out, relu, yn, &ti, &tc, &to);                  /* warm-up */
  for (int r = 0; r < reps; r++) { if (nnpa_dense(X, W, B, n, in, out, relu, yn, &ti, &tc, &to)) return 1; if (ti < bi) bi = ti; if (tc < bc) bc = tc; if (to < bo) bo = to; }
  double maxd = 0, scale = 0; for (int i = 0; i < n * out; i++) { double d = fabs(yc[i] - yn[i]); if (d > maxd) maxd = d; if (fabs(yc[i]) > scale) scale = fabs(yc[i]); }
  printf("  {\"case\": \"%s\", \"rows\": %d, \"in\": %d, \"out\": %d, \"cpu_fp32_ms\": %.4f, \"nnpa_compute_ms\": %.4f, \"nnpa_transform_in_ms\": %.4f, \"nnpa_transform_out_ms\": %.4f, "
         "\"nnpa_total_ms\": %.4f, \"compute_speedup_vs_cpu\": %.2f, \"total_speedup_vs_cpu\": %.2f, \"max_abs_diff\": %.6f, \"max_output\": %.3f}%s\n",
         name, n, in, out, cpu, bc, bi, bo, bi + bc + bo, cpu / bc, cpu / (bi + bc + bo), maxd, scale, last ? "" : ",");
  free(X); free(yc); free(yn); return 0;
}

int main(int argc, char **argv) {
  if (argc < 2) { fprintf(stderr, "usage: %s model.json\n", argv[0]); return 2; }
  FILE *f = fopen(argv[1], "r"); if (!f) { perror("model.json"); return 2; }
  fseek(f, 0, SEEK_END); long len = ftell(f); rewind(f);
  char *txt = malloc(len + 1); if (fread(txt, 1, len, f) != (size_t)len) return 2; txt[len] = 0; fclose(f);
  double mu[F], sd[F], coef[F];
  if (read_array(txt, "mean", mu, F) || read_array(txt, "std", sd, F) || read_array(txt, "coef", coef, F)) { fprintf(stderr, "bad model.json\n"); return 2; }
  double intercept = read_scalar(txt, "intercept");

  printf("{\"nnpa_installed\": %s, \"zdnn_version\": \"%s\", \"results\": [\n", zdnn_is_nnpa_installed() ? "true" : "false", zdnn_get_library_version_str());
  if (!zdnn_is_nnpa_installed()) { printf("]}\n"); fprintf(stderr, "NNPA not available on this host\n"); return 1; }

  /* fold standardisation into the weights: z = sum(coef*(x-mu)/sd) + b  =>  w = coef/sd, b' = b - sum(coef*mu/sd) */
  float w[F], bias = (float)intercept;
  for (int j = 0; j < F; j++) { w[j] = (float)(coef[j] / sd[j]); bias -= (float)(coef[j] * mu[j] / sd[j]); }

  srand(7);
  int sizes[] = {1, 64, 1024, 16384, 32768};
  for (size_t si = 0; si < sizeof sizes / sizeof *sizes; si++) if (bench("AuraZ logistic (16 -> 1, sigmoid)", w, &bias, sizes[si], F, 1, 0, 0)) { printf("]}\n"); return 1; }
  /* synthetic wide layer (NOT our model): where does the accelerator start to pay off? */
  enum { WI = 16, WO = 512 };
  float *W2 = malloc(sizeof(float) * WI * WO), *B2 = malloc(sizeof(float) * WO);
  for (int i = 0; i < WI * WO; i++) W2[i] = (float)((rand() / (double)RAND_MAX) - 0.5) * 0.5f;
  for (int i = 0; i < WO; i++) B2[i] = 0.1f;
  if (bench("synthetic wide layer (16 -> 512, relu)", W2, B2, 1024, WI, WO, 1, 0)) { printf("]}\n"); return 1; }
  if (bench("synthetic wide layer (16 -> 512, relu)", W2, B2, 16384, WI, WO, 1, 1)) { printf("]}\n"); return 1; }
  printf("]}\n");
  return 0;
}
