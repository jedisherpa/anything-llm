#!/bin/zsh
set -euo pipefail

if [[ $# -lt 4 ]]; then
  echo "Usage: $0 <app-path> <output-dmg> <volume-name> <product-name>" >&2
  exit 1
fi

APP_PATH="$1"
OUTPUT_DMG="$2"
VOLUME_NAME="$3"
PRODUCT_NAME="$4"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOGO_PATH="$ROOT_DIR/desktop-tauri/app/prism-dodeca.png"
# macOS BSD mktemp only replaces XXXXXX when it's at the end of the template,
# so we generate bare tempfiles and append the desired extensions manually.
BACKGROUND_TMP_BASE="$(mktemp /tmp/prismai-installer-background.XXXXXX)"
BACKGROUND_TMP="${BACKGROUND_TMP_BASE}.png"
mv "$BACKGROUND_TMP_BASE" "$BACKGROUND_TMP"
STAGE_DIR="$(mktemp -d /tmp/prismai-dmg-stage.XXXXXX)"
RW_DMG_BASE="$(mktemp /tmp/prismai-installer.XXXXXX)"
RW_DMG="${RW_DMG_BASE}.dmg"
rm -f "$RW_DMG_BASE"
CONVERT_BASE="$(mktemp /tmp/prismai-installer-final.XXXXXX)"
DEVICE=""
MOUNT_POINT=""

cleanup() {
  if [[ -n "$DEVICE" ]]; then
    hdiutil detach "$DEVICE" -force >/dev/null 2>&1 || true
  fi
  rm -rf "$STAGE_DIR" "$BACKGROUND_TMP" "$RW_DMG" "$CONVERT_BASE" "${CONVERT_BASE}.dmg"
}
trap cleanup EXIT

apply_finder_layout() {
/usr/bin/osascript <<OSA
set backgroundFile to POSIX file "$MOUNT_POINT/.background/installer-background.png" as alias
set appName to "$PRODUCT_NAME.app"

tell application "Finder"
  activate
  tell disk "$VOLUME_NAME"
    open
    set current view of container window to icon view
    set toolbar visible of container window to false
    set statusbar visible of container window to false
    set sidebar width of container window to 0
    set bounds of container window to {120, 120, 960, 680}
    set opts to the icon view options of container window
    set arrangement of opts to not arranged
    set icon size of opts to 128
    set text size of opts to 14
    set background picture of opts to backgroundFile
    set position of item appName to {190, 245}
    set position of item "Applications" to {585, 245}
    update without registering applications
    delay 2
    close
    open
    delay 2
    close
  end tell
end tell
OSA
}

persist_finder_layout() {
  local attempt=1
  local DS_STORE_TEMPLATE="$ROOT_DIR/desktop-tauri/packaging/installer-template.DS_Store"

  while [[ $attempt -le 3 ]]; do
    if apply_finder_layout 2>/dev/null; then
      sync
      if [[ -f "$MOUNT_POINT/.DS_Store" ]]; then
        return 0
      fi
    else
      echo "Finder AppleScript failed on attempt $attempt (timeout or no GUI)." >&2
    fi

    sleep 2
    attempt=$((attempt + 1))
  done

  # Fallback: use pre-built .DS_Store template if Finder is unavailable
  if [[ -f "$DS_STORE_TEMPLATE" ]]; then
    echo "Using pre-built .DS_Store template as fallback." >&2
    cp "$DS_STORE_TEMPLATE" "$MOUNT_POINT/.DS_Store"
    sync
    return 0
  fi

  echo "Finder did not persist the DMG layout metadata and no template available." >&2
  exit 1
}

rm -f "$OUTPUT_DMG"
rm -f "$RW_DMG" "$CONVERT_BASE" "${CONVERT_BASE}.dmg"
mkdir -p "$STAGE_DIR/.background"

swift "$SCRIPT_DIR/generate-installer-background.swift" "$BACKGROUND_TMP" "$PRODUCT_NAME" "$LOGO_PATH"
cp "$BACKGROUND_TMP" "$STAGE_DIR/.background/installer-background.png"
COPYFILE_DISABLE=1 tar -C "$(dirname "$APP_PATH")" -cf - "$(basename "$APP_PATH")" | (
  cd "$STAGE_DIR" && COPYFILE_DISABLE=1 tar -xf -
)
# NOTE: do NOT run `xattr -cr` here — it strips the notarization ticket from
# stapled app bundles and also causes hdiutil to fail with "Operation not permitted".
ln -s /Applications "$STAGE_DIR/Applications"

hdiutil create \
  -srcfolder "$STAGE_DIR" \
  -volname "$VOLUME_NAME" \
  -fs HFS+ \
  -format UDRW \
  "$RW_DMG" >/dev/null

ATTACH_OUTPUT="$(hdiutil attach -readwrite -noverify -noautoopen "$RW_DMG")"
DEVICE="$(echo "$ATTACH_OUTPUT" | awk '/^\/dev\// {print $1; exit}')"
MOUNT_POINT="$(echo "$ATTACH_OUTPUT" | awk -F '\t' '/\/Volumes\// {print $NF; exit}')"

if [[ -z "$DEVICE" || -z "$MOUNT_POINT" ]]; then
  echo "Failed to mount temporary DMG." >&2
  exit 1
fi

persist_finder_layout

bless --folder "$MOUNT_POINT" --openfolder "$MOUNT_POINT" >/dev/null 2>&1 || true
sync
hdiutil detach "$DEVICE" >/dev/null
DEVICE=""
MOUNT_POINT=""

hdiutil convert "$RW_DMG" -format UDZO -imagekey zlib-level=9 -o "$CONVERT_BASE" >/dev/null
mv "${CONVERT_BASE}.dmg" "$OUTPUT_DMG"
