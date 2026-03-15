#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
exec "$ROOT_DIR/desktop-tauri/scripts/build-installer-dmg.sh" "$@"
