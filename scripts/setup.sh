#!/usr/bin/env bash
# Prepares a local environment for docker compose.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example - fill in the secrets before starting."
  exit 1
fi

echo "Validating docker-compose configuration..."
docker compose config --quiet

echo "Building images..."
docker compose build

echo "Setup completed. Start the stack with: docker compose up -d"
