#!/bin/sh
# Starts the app when hosted (Railway). It runs when the container STARTS, because the persistent volume is
# only attached then (it is not there during the build).
set -e

DATA_DIR="${RAILWAY_VOLUME_MOUNT_PATH:-/app/data}"
mkdir -p "$DATA_DIR/uploads"

# The database and the photos must live on the volume, otherwise they are lost on every redeploy.
WANT_DB="file:$DATA_DIR/app.db"
case "${DATABASE_URL:-}" in
  "file:$DATA_DIR/"*) ;;                                   # already on the volume
  "") DATABASE_URL="$WANT_DB" ;;
  *)
    if [ -n "${RAILWAY_VOLUME_MOUNT_PATH:-}" ]; then
      echo "[start] WARNING: DATABASE_URL=$DATABASE_URL is not on the volume ($DATA_DIR). Using $WANT_DB instead."
      DATABASE_URL="$WANT_DB"
    fi ;;
esac
export DATABASE_URL

case "${UPLOADS_DIR:-}" in
  "$DATA_DIR/"*) ;;
  "") UPLOADS_DIR="$DATA_DIR/uploads" ;;
  *)
    if [ -n "${RAILWAY_VOLUME_MOUNT_PATH:-}" ]; then
      echo "[start] WARNING: UPLOADS_DIR=$UPLOADS_DIR is not on the volume ($DATA_DIR). Using $DATA_DIR/uploads instead."
      UPLOADS_DIR="$DATA_DIR/uploads"
    fi ;;
esac
export UPLOADS_DIR

echo "[start] database: $DATABASE_URL"
echo "[start] photos:   $UPLOADS_DIR"

npx prisma migrate deploy

# Sample businesses and listings. Safe to repeat. Set SEED_ON_START=false to skip.
if [ "${SEED_ON_START:-true}" = "true" ]; then
  node dist/seed.js
fi

exec node dist/main.js
