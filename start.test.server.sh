#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$ROOT_DIR/.test.env"
LOG_DIR="$ROOT_DIR/logs"
LOG_FILE="$LOG_DIR/start.test.server.log"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing root test environment file: $ENV_FILE" >&2
  exit 1
fi

set -a
source <(sed 's/\r$//' "$ENV_FILE")
set +a

mkdir -p "$LOG_DIR"
printf '\n[%s] Starting test stack\n' "$(date -Iseconds)" | tee -a "$LOG_FILE"

node \
  --import=tsx \
  --import=extensionless/register \
  "$ROOT_DIR/frontend/scripts/start.test.server.mjs" 2>&1 | tee -a "$LOG_FILE"
