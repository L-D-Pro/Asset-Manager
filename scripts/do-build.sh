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

# DO's buildpack already ran pnpm install, but the node_modules may have
# platform-sensitive binaries from a cached layer. Wipe and reinstall to be safe.
rm -rf node_modules
find . -type d -name node_modules -prune -exec rm -rf {} +

# DO's buildpack installs pnpm from the packageManager field in package.json.
# corepack is NOT available in the DO build environment, so use pnpm directly.
pnpm install --frozen-lockfile

case "$TARGET" in
  api)
    pnpm --filter @workspace/api-spec run codegen
    pnpm --filter @workspace/api-server run build
    ;;
  dashboard)
    pnpm --filter @workspace/api-spec run codegen
    pnpm --filter @workspace/dashboard run build
    ;;
  mockup-sandbox)
    pnpm --filter @workspace/mockup-sandbox run build
    ;;
esac
