#!/bin/sh
set -eu

DATA_DIR="${ATOLL_DATA_DIR:-/var/lib/atoll}"
MANAGED_ENV_PATH="${ATOLL_MANAGED_ENV_PATH:-$DATA_DIR/.env}"

mkdir -p "$DATA_DIR"
touch "$MANAGED_ENV_PATH"

ln -sfn "$MANAGED_ENV_PATH" /app/.env

exec "$@"
