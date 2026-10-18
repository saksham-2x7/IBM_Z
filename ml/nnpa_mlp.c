/*
 * AuraZ-N (MLP 108-64-32-1) on the IBM Z Telum II NNPA accelerator via IBM zDNN.
 *
 *   gcc -O2 -o nnpa_mlp ml/nnpa_mlp.c -lzdnn -lm
 *   ./nnpa_mlp weights.bin x.bin n_rows out.bin        (files written by ml/train_physionet_mlp.py)
 *
 * Layers run back-to-back on the accelerator with no host round trip between them:
 *   h1 = relu(X.W1+b1);  h2 = relu(h1.W2+b2);  y = sigmoid(h2.W3+b3)
 * NNPA computes in 16-bit DLFLOAT16, so outputs differ slightly from the FP32 CPU reference.
 * Prints one JSON object with timings; writes the NNPA probabilities to out.bin (float32).
 */
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <zdnn.h>

#define MAXL 8
static double now_ms(void) { struct timespec t; clock_gettime(CLOCK_MONOTONIC, &t); return t.tv_sec * 1e3 + t.tv_nsec / 1e6; }
static int chk(zdnn_status s, const char *w) { if (s != ZDNN_OK) { fprintf(stderr, "zDNN error in %s: 0x%08x %s\n", w, s, zdnn_get_status_message(s)); return 1; } return 0; }

typedef struct { int in, out; float *W, *b; zdnn_ztensor zW, zb; zdnn_tensor_desc pw, tw, pb, tb; } Layer;

static int load_layers(const char *path, Layer *L, int *nl) {
  FILE *f = fopen(path, "rb"); if (!f) { perror(path); return 1; }
  if (fread(nl, 4, 1, f) != 1) return 1;
  for (int l = 0; l < *nl; l++) {
    if (fread(&L[l].in, 4, 1, f) != 1 || fread(&L[l].out, 4, 1, f) != 1) return 1;
    L[l].W = malloc(4L * L[l].in * L[l].out); L[l].b = malloc(4L * L[l].out);
    if (fread(L[l].W, 4, (size_t)L[l].in * L[l].out, f) != (size_t)L[l].in * L[l].out || fread(L[l].b, 4, L[l].out, f) != (size_t)L[l].out) return 1;
  }
  fclose(f); return 0;
}

static void cpu_forward(const Layer *L, int nl, const float *X, int n, float *Y) {
  float *a = malloc(4L * n * 128), *c = malloc(4L * n * 128); const float *in = X; int d = L[0].in;
  for (int l = 0; l < nl; l++) {
    float *out = (l == nl - 1) ? Y : (l % 2 ? c : a);
    for (int i = 0; i < n; i++) for (int o = 0; o < L[l].out; o++) {
      float z = L[l].b[o]; for (int j = 0; j < d; j++) z += in[(long)i * d + j] * L[l].W[(long)j * L[l].out + o];
      out[(long)i * L[l].out + o] = (l == nl - 1) ? 1.0f / (1.0f + expf(-z)) : (z > 0 ? z : 0);
    }
    in = out; d = L[l].out;
  }
  free(a); free(c);
}

/* run the whole network on NNPA for one chunk; *t_xfer = host<->NNPA conversion, *t_comp = accelerator compute */
static int nnpa_forward(Layer *L, int nl, const float *X, int n, float *Y, double *t_xfer, double *t_comp) {
  zdnn_tensor_desc px, tx; zdnn_ztensor zx;
  zdnn_init_pre_transformed_desc(ZDNN_3DS, FP32, &px, 1, n, L[0].in);
  if (chk(zdnn_generate_transformed_desc(&px, &tx), "desc x") || chk(zdnn_init_ztensor_with_malloc(&px, &tx, &zx), "alloc x")) return 1;
  double t0 = now_ms();
  if (chk(zdnn_transform_ztensor(&zx, X), "transform x")) return 1;
  double t1 = now_ms();
  /* zDNN tensors keep POINTERS to their descriptors, so every tensor gets its own descriptor that lives for the whole call */
  zdnn_ztensor *cur = &zx, outs[MAXL], acts[MAXL]; zdnn_tensor_desc po[MAXL], to[MAXL];
  for (int l = 0; l < nl; l++) {
    zdnn_init_pre_transformed_desc(ZDNN_3DS, FP32, &po[l], 1, n, L[l].out);
    if (chk(zdnn_generate_transformed_desc(&po[l], &to[l]), "desc out")) return 1;
    if (chk(zdnn_init_ztensor_with_malloc(&po[l], &to[l], &outs[l]), "alloc out") || chk(zdnn_init_ztensor_with_malloc(&po[l], &to[l], &acts[l]), "alloc act")) return 1;
  }
  double t2 = now_ms();
  for (int l = 0; l < nl; l++) {
    if (chk(zdnn_matmul_op(cur, &L[l].zW, &L[l].zb, MATMUL_OP_ADDITION, &outs[l]), "matmul")) return 1;
    if (l < nl - 1) { if (chk(zdnn_relu(&outs[l], NULL, &acts[l]), "relu")) return 1; }
    else            { if (chk(zdnn_sigmoid(&outs[l], &acts[l]), "sigmoid")) return 1; }
    cur = &acts[l];
  }
  double t3 = now_ms();
  if (chk(zdnn_transform_origtensor(cur, Y), "transform out")) return 1;
  double t4 = now_ms();
  *t_xfer = (t1 - t0) + (t4 - t3); *t_comp = t3 - t2;
  zdnn_free_ztensor_buffer(&zx);
  for (int l = 0; l < nl; l++) { zdnn_free_ztensor_buffer(&outs[l]); zdnn_free_ztensor_buffer(&acts[l]); }
  return 0;
}

int main(int argc, char **argv) {
  if (argc < 5) { fprintf(stderr, "usage: %s weights.bin x.bin n_rows out.bin\n", argv[0]); return 2; }
  Layer L[MAXL]; int nl; if (load_layers(argv[1], L, &nl)) return 2;
  int n = atoi(argv[3]), d = L[0].in; const int CH = 16384;
  float *X = malloc(4L * n * d), *Yn = malloc(4L * n), *Yc = malloc(4L * n);
  FILE *f = fopen(argv[2], "rb"); if (!f || fread(X, 4, (size_t)n * d, f) != (size_t)n * d) { fprintf(stderr, "bad x.bin\n"); return 2; } fclose(f);
  if (!zdnn_is_nnpa_installed()) { fprintf(stderr, "NNPA not available\n"); return 1; }
  /* upload weights once */
  double tw0 = now_ms();
  for (int l = 0; l < nl; l++) {
    zdnn_init_pre_transformed_desc(ZDNN_3DS, FP32, &L[l].pw, 1, L[l].in, L[l].out); zdnn_init_pre_transformed_desc(ZDNN_2DS, FP32, &L[l].pb, 1, L[l].out);
    if (chk(zdnn_generate_transformed_desc(&L[l].pw, &L[l].tw), "dw") || chk(zdnn_generate_transformed_desc(&L[l].pb, &L[l].tb), "db")) return 1;
    if (chk(zdnn_init_ztensor_with_malloc(&L[l].pw, &L[l].tw, &L[l].zW), "aw") || chk(zdnn_init_ztensor_with_malloc(&L[l].pb, &L[l].tb, &L[l].zb), "ab")) return 1;
    if (chk(zdnn_transform_ztensor(&L[l].zW, L[l].W), "tw") || chk(zdnn_transform_ztensor(&L[l].zb, L[l].b), "tb")) return 1;
  }
  double weights_ms = now_ms() - tw0;

  int reps = 5; double best_total = 1e18, best_comp = 1e18, best_x = 1e18;
  for (int r = 0; r < reps; r++) {
    double xf = 0, cp = 0, a, b2; double t0 = now_ms();
    for (int s = 0; s < n; s += CH) { int m = (n - s < CH) ? n - s : CH; if (nnpa_forward(L, nl, X + (long)s * d, m, Yn + s, &a, &b2)) return 1; xf += a; cp += b2; }
    double tot = now_ms() - t0; if (tot < best_total) { best_total = tot; best_comp = cp; best_x = xf; }
  }
  cpu_forward(L, nl, X, n, Yc);                                        /* warm-up */
  double c0 = now_ms(); for (int r = 0; r < 3; r++) cpu_forward(L, nl, X, n, Yc); double cpu_ms = (now_ms() - c0) / 3;
  double maxd = 0, sumd = 0; for (int i = 0; i < n; i++) { double dd = fabs(Yc[i] - Yn[i]); if (dd > maxd) maxd = dd; sumd += dd; }
  f = fopen(argv[4], "wb"); fwrite(Yn, 4, n, f); fclose(f);
  printf("{\"rows\": %d, \"layers\": %d, \"zdnn_version\": \"%s\", \"cpu_fp32_ms\": %.3f, \"nnpa_total_ms\": %.3f, \"nnpa_compute_ms\": %.3f, \"nnpa_transform_ms\": %.3f, "
         "\"weights_upload_ms\": %.3f, \"speedup_total_vs_cpu\": %.2f, \"speedup_compute_vs_cpu\": %.2f, \"max_abs_prob_diff_vs_fp32\": %.6f, \"mean_abs_prob_diff_vs_fp32\": %.6f}\n",
         n, nl, zdnn_get_library_version_str(), cpu_ms, best_total, best_comp, best_x, weights_ms, cpu_ms / best_total, cpu_ms / best_comp, maxd, sumd / n);
  return 0;
}
