#!/usr/bin/env bash
# Copies the demo into the portfolio site repository. site/ mirrors the site's paths exactly.
# Files under this demo's own folders that no longer exist in site/ are removed from the site.
# Usage: scripts/sync-to-site.sh [path-to-site-repo]
set -euo pipefail
SRC="$(cd "$(dirname "$0")/.." && pwd)/site"
SITE="${1:-$SRC/../../neuromorphic-inference-lab-site}"

if [ ! -f "$SITE/index.html" ] || [ ! -d "$SITE/functions" ]; then
  echo "Not the site repository: $SITE" >&2
  exit 1
fi
SITE="$(cd "$SITE" && pwd)"

# This demo's own folders, synced as mirrors (copy, then delete what the source no longer has).
for dir in config/board functions/api/board demos/innovation-board; do
  mkdir -p "$SITE/$dir"
  (cd "$SRC/$dir" && find . -type f) | while read -r f; do
    mkdir -p "$SITE/$dir/$(dirname "$f")"
    cp "$SRC/$dir/$f" "$SITE/$dir/$f"
  done
  (cd "$SITE/$dir" && find . -type f) | while read -r f; do
    if [ ! -f "$SRC/$dir/$f" ]; then rm "$SITE/$dir/$f"; echo "Removed $dir/${f#./}"; fi
  done
done

# Tests share the site's test folder: only board-* files belong to this demo.
mkdir -p "$SITE/test"
cp "$SRC"/test/board-*.js "$SITE/test/"
for f in "$SITE"/test/board-*.js; do
  [ -f "$SRC/test/$(basename "$f")" ] || { rm "$f"; echo "Removed test/$(basename "$f")"; }
done
echo "Synced into $SITE"
