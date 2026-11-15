#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_FILE:?BACKUP_FILE is required}"
if [[ "${CONFIRM_RESTORE:-}" != "YES" ]]; then
  echo 'Refusing to restore without CONFIRM_RESTORE=YES. Restore to an isolated database first.' >&2
  exit 2
fi
[[ -f "$BACKUP_FILE" ]] || { echo 'Backup file not found.' >&2; exit 2; }
[[ -f "$BACKUP_FILE.sha256" ]] || { echo 'Backup checksum file not found.' >&2; exit 2; }
(cd "$(dirname "$BACKUP_FILE")" && sha256sum --check "$(basename "$BACKUP_FILE").sha256")
pg_restore --exit-on-error --clean --if-exists --no-owner --no-acl --dbname="$DATABASE_URL" "$BACKUP_FILE"
echo 'Database restore command completed. Run migration/status checks before switching application traffic.'
