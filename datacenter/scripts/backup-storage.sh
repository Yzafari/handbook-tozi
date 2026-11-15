#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
: "${DATACENTER_STORAGE_DIR:?DATACENTER_STORAGE_DIR is required}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/handbook/storage}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
SOURCE="${DATACENTER_STORAGE_DIR%/}"
mkdir -p "$BACKUP_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
SNAPSHOT="$BACKUP_DIR/$STAMP"
TEMP_SNAPSHOT="$SNAPSHOT.partial"
PREVIOUS="$(find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -regextype posix-extended -regex '.*/[0-9]{8}T[0-9]{6}Z' | sort | tail -n 1)"
cleanup_partial() { rm -rf -- "$TEMP_SNAPSHOT"; }
trap cleanup_partial EXIT INT TERM
mkdir -p "$TEMP_SNAPSHOT"
if [[ -n "$PREVIOUS" ]]; then
  rsync -a --delete --numeric-ids --link-dest="$PREVIOUS" "$SOURCE/" "$TEMP_SNAPSHOT/"
else
  rsync -a --numeric-ids "$SOURCE/" "$TEMP_SNAPSHOT/"
fi
mv "$TEMP_SNAPSHOT" "$SNAPSHOT"
trap - EXIT INT TERM
find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -regextype posix-extended -regex '.*/[0-9]{8}T[0-9]{6}Z' -mtime "+$RETENTION_DAYS" -exec rm -rf -- {} +
printf 'Storage snapshot completed: %s\n' "$SNAPSHOT"
