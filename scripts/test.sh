#!/usr/bin/env bash
# Runs every test suite in the repository.
# Usage: ./scripts/test.sh [backend|frontend|mobile]  (default: all)
set -euo pipefail

cd "$(dirname "$0")/.."

run_backend() {
  echo "== Backend (check + tests)"
  (cd backend && npm run check && npm test)
}

run_frontend() {
  echo "== Frontend (tests + build)"
  (cd frontend && npm test && npm run build)
}

run_mobile() {
  echo "== Mobile (typecheck + tests)"
  (cd mobile && npm run typecheck && npm test)
}

target="${1:-all}"
case "$target" in
  backend) run_backend ;;
  frontend) run_frontend ;;
  mobile) run_mobile ;;
  all) run_backend && run_frontend && run_mobile ;;
  *) echo "Unknown target: $target" >&2; exit 1 ;;
esac
