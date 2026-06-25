#!/usr/bin/env bash
# prepare-release-assets.sh
#
# Normalize electron-updater metadata from build artifacts
# into a deterministic release-assets/ directory.
#
# Usage:
#   ./scripts/prepare-release-assets.sh [ARTIFACTS_DIR] [OUTPUT_DIR]
#
# Defaults:
#   ARTIFACTS_DIR = build-artifacts
#   OUTPUT_DIR    = release-assets

set -euo pipefail

ARTIFACTS_DIR="${1:-build-artifacts}"
OUTPUT_DIR="${2:-release-assets}"

rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

# ---------------------------------------------------------------------------
# 1) Copy all distributables (unique file names)
# ---------------------------------------------------------------------------
echo "==> Copying distributables from $ARTIFACTS_DIR ..."
mapfile -t DISTRIBUTABLES < <(find "$ARTIFACTS_DIR" -type f \( \
  -name "*.exe" -o \
  -name "*.msi" -o \
  -name "*.dmg" -o \
  -name "*.deb" -o \
  -name "*.zip" \
\) | sort)

DUPLICATE_BASENAMES=$(for file in "${DISTRIBUTABLES[@]}"; do basename "$file"; done | sort | uniq -d || true)
if [ -n "$DUPLICATE_BASENAMES" ]; then
  echo "::error::Found duplicate distributable basenames that would be overwritten in flat output:"
  echo "$DUPLICATE_BASENAMES"
  exit 1
fi

for file in "${DISTRIBUTABLES[@]}"; do
  cp -f "$file" "$OUTPUT_DIR/"
done

# ---------------------------------------------------------------------------
# 2) Collect updater metadata — Windows x64 only build
# ---------------------------------------------------------------------------
echo "==> Collecting updater metadata ..."

WIN_X64_LATEST=$(find "$ARTIFACTS_DIR" -type f -path "*/windows-build-x64/*" -name "latest.yml" | sort | head -n 1 || true)
WIN_ARM64_LATEST=$(find "$ARTIFACTS_DIR" -type f -path "*/windows-build-arm64/*" -name "latest.yml" | sort | head -n 1 || true)

# ---------------------------------------------------------------------------
# 3) Write canonical updater metadata
# ---------------------------------------------------------------------------
echo "==> Writing canonical updater metadata ..."

[ -n "$WIN_X64_LATEST" ] && cp -f "$WIN_X64_LATEST" "$OUTPUT_DIR/latest.yml"

# ---------------------------------------------------------------------------
# 4) Architecture-specific metadata (arm64 if present)
# ---------------------------------------------------------------------------
echo "==> Writing architecture-specific updater metadata ..."

[ -n "$WIN_ARM64_LATEST" ] && cp -f "$WIN_ARM64_LATEST" "$OUTPUT_DIR/latest-win-arm64.yml"

# ---------------------------------------------------------------------------
# 5) Hard validation — only Windows x64 is required
# ---------------------------------------------------------------------------
echo "==> Validating required metadata ..."

MISSING=0
for required in latest.yml; do
  if [ ! -f "$OUTPUT_DIR/$required" ]; then
    echo "::error::Missing required updater metadata: $required"
    MISSING=1
  fi
done

if [ "$MISSING" -ne 0 ]; then
  exit 1
fi

echo ""
echo "==> Prepared release assets:"
ls -lh "$OUTPUT_DIR"
echo ""
echo "==> Done."
