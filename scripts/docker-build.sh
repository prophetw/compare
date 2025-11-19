#!/usr/bin/env bash
set -euo pipefail

IMAGE_TAG="${1:-compare-app:latest}"

echo "==> Building frontend (pnpm --filter frontend build)"
pnpm --filter frontend build

echo "==> Syncing frontend dist into server/public"
pnpm sync:static

echo "==> Building Docker image (${IMAGE_TAG})"
docker build -t "${IMAGE_TAG}" .

echo "Docker image ${IMAGE_TAG} built successfully."
