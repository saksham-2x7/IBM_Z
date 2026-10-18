#!/usr/bin/env bash
# Retrain + audit on every downloaded PhysioNet stay, writing to public/full/ (the first-run results in public/ are kept for comparison).
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p public/full
AURAZ_OUT=public/full python3 -W ignore ml/train_physionet_gbm.py
AURAZ_OUT=public/full python3 -W ignore ml/audit_physionet.py
python3 scripts/make_full_report.py
python3 scripts/make_model_card.py
