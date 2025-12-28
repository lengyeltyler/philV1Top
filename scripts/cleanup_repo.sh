#!/usr/bin/env bash
set -euo pipefail

echo "==> Cleaning macOS junk"
find . -name ".DS_Store" -delete || true

echo "==> Creating folders"
mkdir -p tools/svg_fixes tools/debug tools/generation deployments

echo "==> Moving dev-only scripts into tools/"
# Move only if present
for f in fix_text_escape.cjs fix_text_xy.cjs fix_top_svg_text_entities.cjs patch_top_svgs_for_xml.cjs; do
  if [ -f "scripts/$f" ]; then
    git mv "scripts/$f" "tools/svg_fixes/$f" 2>/dev/null || mv "scripts/$f" "tools/svg_fixes/$f"
  fi
done

if [ -f "scripts/getOneTopSvg.cjs" ]; then
  git mv "scripts/getOneTopSvg.cjs" "tools/debug/getOneTopSvg.cjs" 2>/dev/null || mv "scripts/getOneTopSvg.cjs" "tools/debug/getOneTopSvg.cjs"
fi

echo "==> Moving generation scripts (optional)"
if [ -d "traitGeneration" ]; then
  # Move entire folder contents
  mkdir -p tools/generation
  # If git mv fails (untracked), fall back to mv
  git mv traitGeneration/* tools/generation/ 2>/dev/null || mv traitGeneration/* tools/generation/ 2>/dev/null || true
  rmdir traitGeneration 2>/dev/null || true
fi

echo "==> Renaming verify script"
if [ -f "scripts/testTopAtlasRead.cjs" ]; then
  git mv scripts/testTopAtlasRead.cjs scripts/verifyTopAtlas.cjs 2>/dev/null || mv scripts/testTopAtlasRead.cjs scripts/verifyTopAtlas.cjs
fi

echo "==> Moving deploy jsons into deployments/"
if [ -d "out_top" ]; then
  for f in out_top/deploy_*.json; do
    if [ -f "$f" ]; then
      base="$(basename "$f")"
      git mv "$f" "deployments/${base#deploy_}" 2>/dev/null || mv "$f" "deployments/${base#deploy_}"
    fi
  done
fi

echo "==> Updating .gitignore"
touch .gitignore

add_ignore () {
  local line="$1"
  grep -qxF "$line" .gitignore 2>/dev/null || echo "$line" >> .gitignore
}

add_ignore ".DS_Store"
add_ignore ".env"
add_ignore ".env.*"
add_ignore "node_modules/"
add_ignore "artifacts/"
add_ignore "cache/"
add_ignore "coverage/"
add_ignore "typechain/"
add_ignore "out_top/optimized_fixed/"
add_ignore "out_top/manifest.json"
add_ignore "out_top/deploy_*.json"
add_ignore "deployments/deploy_*.json" # just in case
add_ignore "*.log"

echo "==> If these were tracked, untrack them safely"
git rm -r --cached node_modules artifacts cache out_top/optimized_fixed 2>/dev/null || true
git rm --cached out_top/manifest.json 2>/dev/null || true

echo "==> Done. Review changes with: git status"
