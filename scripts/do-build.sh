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

# DO's buildpack already ran `pnpm install` from the lockfile before this
# custom build command executes. However, `pnpm` is not on PATH inside the
# custom command phase. We locate it from the buildpack layer or fall back
# to installing it via npm (which IS always on PATH).

# Try to find pnpm in common buildpack locations
if command -v pnpm >/dev/null 2>&1; then
  PNPM="pnpm"
elif [ -x "$(npm root -g 2>/dev/null)/pnpm/bin/pnpm.cjs" ]; then
  PNPM="node $(npm root -g)/pnpm/bin/pnpm.cjs"
else
  echo "pnpm not on PATH, installing via npm..."
  npm install -g pnpm@10.33.0
  PNPM="pnpm"
fi

echo "Using pnpm at: $(command -v pnpm 2>/dev/null || echo 'npm-installed')"

case "$TARGET" in
  api)
    $PNPM --filter @workspace/api-spec run codegen
    $PNPM --filter @workspace/api-server run build
    ;;
  dashboard)
    $PNPM --filter @workspace/api-spec run codegen
    $PNPM --filter @workspace/dashboard run build
    ;;
  mockup-sandbox)
    $PNPM --filter @workspace/mockup-sandbox run build
    ;;
esac
