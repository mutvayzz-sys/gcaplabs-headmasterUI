#!/usr/bin/env bash

set -euo pipefail

ARTIFACTS_DIR="${1:-build-artifacts}"

rm -rf "$ARTIFACTS_DIR"
mkdir -p "$ARTIFACTS_DIR/windows-build-x64"

VERSION="${MOCK_VERSION:-1.0.0}"

# Windows x64 — only platform built
INSTALLER_NAME="Headmaster-${VERSION}-win-x64.exe"
touch "$ARTIFACTS_DIR/windows-build-x64/${INSTALLER_NAME}"
cat > "$ARTIFACTS_DIR/windows-build-x64/latest.yml" <<EOF
version: ${VERSION}
files:
  - url: ${INSTALLER_NAME}
    sha512: fake-sha512-x64
    size: 100000
path: ${INSTALLER_NAME}
sha512: fake-sha512-x64
releaseDate: '2025-01-01'
EOF

echo "Mock artifacts created in $ARTIFACTS_DIR:"
find "$ARTIFACTS_DIR" -type f | sort
