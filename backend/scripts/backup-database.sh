#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
: "${DATABASE_URL:?DATABASE_URL is required}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/handbook/postgres}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
mkdir -p "$BACKUP_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$BACKUP_DIR/handbook-$STAMP.dump"
TEMP_FILE="$FILE.partial"
TEMP_CHECKSUM="$TEMP_FILE.sha256"
cleanup_partial() { rm -f -- "$TEMP_FILE" "$TEMP_CHECKSUM"; }
trap cleanup_partial EXIT INT TERM
pg_dump "$DATABASE_URL" --format=custom --no-owner --no-acl --file="$TEMP_FILE"
HASH="$(sha256sum "$TEMP_FILE" | awk '{print $1}')"
printf '%s  %s\n' "$HASH" "$(basename "$FILE")" > "$TEMP_CHECKSUM"
mv "$TEMP_FILE" "$FILE"
mv "$TEMP_CHECKSUM" "$FILE.sha256"
trap - EXIT INT TERM
find "$BACKUP_DIR" -type f -name 'handbook-*.dump*' -mtime "+$RETENTION_DAYS" -delete
printf 'Database backup completed: %s\n' "$FILE"
