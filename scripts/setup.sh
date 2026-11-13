#!/usr/bin/env bash
set -e

if [ ! -f .env ]; then
    cp .env.example .env
    echo "Created .env from .env.example"
fi

echo "Building docker containers..."
docker-compose build
echo "Setup completed successfully."
