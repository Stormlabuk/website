#!/usr/bin/env bash
# Download the news images referenced by the imported WordPress posts.
#
# Reads scripts/news_images.tsv (columns: <remote-url>\t<local-path-under-assets/images>)
# and saves each image into assets/images/. Safe to re-run: existing files are
# skipped. Requires outbound access to stormlabuk.com (works from a GitHub
# Actions runner or any machine that can reach the live site).
#
# Usage:  bash scripts/fetch_news_images.sh
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MANIFEST="$ROOT/scripts/news_images.tsv"
DEST_ROOT="$ROOT/assets/images"

[ -f "$MANIFEST" ] || { echo "manifest not found: $MANIFEST" >&2; exit 1; }

ok=0; skip=0; fail=0
while IFS=$'\t' read -r url local; do
  [ -z "${url:-}" ] && continue
  out="$DEST_ROOT/$local"
  if [ -s "$out" ]; then skip=$((skip+1)); continue; fi
  mkdir -p "$(dirname "$out")"
  if curl -fsSL --retry 3 --retry-delay 2 --max-time 60 -o "$out" "$url"; then
    echo "  ✓ $local"
    ok=$((ok+1))
  else
    echo "  ✗ FAILED $url" >&2
    rm -f "$out"
    fail=$((fail+1))
  fi
done < "$MANIFEST"

echo "Done. downloaded=$ok skipped=$skip failed=$fail"
[ "$fail" -eq 0 ]
