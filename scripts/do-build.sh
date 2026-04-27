#!/usr/bin/env sh
set -eu

TARGET="${1:-}"

if [ -z "$TARGET" ]; then
  echo "Usage: ./scripts/do-build.sh <api|dashboard|mockup-sandbox>"
  exit 1
fi

case "$TARGET" in
  api|dashboard|mockup-sandbox)
    ;;
  *)
    echo "Unsupported target: $TARGET"
    exit 1
    ;;
esac

echo "Preparing DigitalOcean build for target: $TARGET"

# Keep pnpm as the source of truth, but remove conflicting lockfiles if they exist.
rm -f package-lock.json yarn.lock

# Clean platform-sensitive install state so App Platform rebuilds dependencies on Linux.
rm -rf node_modules
find . -type d -name node_modules -prune -exec rm -rf {} +

corepack enable
corepack prepare pnpm@10.33.0 --activate
corepack pnpm install --frozen-lockfile

case "$TARGET" in
  api)
    corepack pnpm --filter @workspace/api-spec run codegen
    corepack pnpm --filter @workspace/api-server run build
    ;;
  dashboard)
    corepack pnpm --filter @workspace/api-spec run codegen
    corepack pnpm --filter @workspace/dashboard run build
    ;;
  mockup-sandbox)
    corepack pnpm --filter @workspace/mockup-sandbox run build
    ;;
esac
