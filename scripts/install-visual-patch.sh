#!/usr/bin/env bash
set -euo pipefail
TARGET="${1:-$HOME/Desktop/nile-quest-web}"
PATCH_DIR="$(cd "$(dirname "$0")/.." && pwd)"
if [[ ! -f "$TARGET/package.json" || ! -f "$TARGET/public/app.js" ]]; then
  echo "Error: target is not the NILE QUEST project: $TARGET" >&2
  exit 1
fi
mkdir -p "$TARGET/public/media"
BACKUP="$TARGET/.nile-quest-visual-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP"
cp "$TARGET/public/index.html" "$TARGET/public/styles.css" "$TARGET/public/app.js" "$TARGET/src/server.mjs" "$BACKUP/"
cp "$PATCH_DIR/public/index.html" "$PATCH_DIR/public/styles.css" "$PATCH_DIR/public/app.js" "$TARGET/public/"
cp "$PATCH_DIR/src/server.mjs" "$TARGET/src/server.mjs"
cp "$PATCH_DIR"/public/media/*-visual-v13.webp "$TARGET/public/media/"
node --check "$TARGET/public/app.js"
node --check "$TARGET/src/server.mjs"
if grep -q 'weatherFromBrowser' "$TARGET/public/app.js" && grep -q 'visual-1.3' "$TARGET/public/index.html" && test -f "$TARGET/public/media/italy-visual-v13.webp" && grep -q "'.webp':'image/webp'" "$TARGET/src/server.mjs"; then
  echo "SUCCESS: NILE QUEST visual v1.3 installed"
  echo "Backup: $BACKUP"
  echo "Restart npm start, then Command + Shift + R in your browser."
else
  echo "ERROR: some files were not applied" >&2
  exit 1
fi
