#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$ROOT_DIR/.test.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing root test environment file: $ENV_FILE" >&2
  exit 1
fi

set -a
source <(sed 's/\r$//' "$ENV_FILE")
set +a

exec node \
  --import=tsx \
  --import=extensionless/register \
  "$ROOT_DIR/frontend/scripts/start.test.server.mjs"
