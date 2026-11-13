#!/usr/bin/env bash
set -e

echo "Running tests in docker-compose..."
docker-compose run --rm api pytest
