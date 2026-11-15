#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
: "${DATACENTER_STORAGE_DIR:?DATACENTER_STORAGE_DIR is required}"
: "${SNAPSHOT_DIR:?SNAPSHOT_DIR is required}"
if [[ "${CONFIRM_RESTORE:-}" != "YES" ]]; then
  echo 'Refusing to restore without CONFIRM_RESTORE=YES.' >&2
  exit 2
fi
[[ -d "$SNAPSHOT_DIR" ]] || { echo 'Storage snapshot not found.' >&2; exit 2; }
mkdir -p "$DATACENTER_STORAGE_DIR"
rsync -a --delete --numeric-ids "$SNAPSHOT_DIR/" "${DATACENTER_STORAGE_DIR%/}/"
echo 'Storage restore completed. Verify file hashes and document metadata before reopening traffic.'
