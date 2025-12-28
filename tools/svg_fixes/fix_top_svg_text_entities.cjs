#!/usr/bin/env node
/**
 * Fix SVG <text> node content so it parses everywhere (Chrome, Illustrator, on-chain reads).
 * Escapes raw '<' and '&' inside <text>...</text>.
 *
 * Usage:
 *   node scripts/fix_top_svg_text_entities.cjs \
 *     --in  out_top/optimized_fixed \
 *     --out out_top/optimized_fixed
 *
 * Tip: you can write to a new folder:
 *   --out out_top/optimized_fixed2
 */

const fs = require("fs");
const path = require("path");

function getArg(name, fallback = null) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  const val = process.argv[idx + 1];
  if (!val || val.startsWith("--")) return true;
  return val;
}

const IN_DIR = getArg("in", "out_top/optimized_fixed");
const OUT_DIR = getArg("out", "out_top/optimized_fixed");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function escapeTextNodeContent(s) {
  // Escape '&' that isn't already an entity
  s = s.replace(/&(?!lt;|gt;|amp;|quot;|apos;|#\d+;|#x[0-9A-Fa-f]+;)/g, "&amp;");
  // Escape raw angle brackets inside text nodes
  s = s.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return s;
}

function fixSvg(svg) {
  // Only touch <text ...>CONTENT</text>
  return svg.replace(/<text\b([^>]*)>([\s\S]*?)<\/text>/g, (m, attrs, content) => {
    const fixed = escapeTextNodeContent(content);
    return `<text${attrs}>${fixed}</text>`;
  });
}

function main() {
  if (!fs.existsSync(IN_DIR)) {
    console.error(`Input folder not found: ${IN_DIR}`);
    process.exit(1);
  }
  ensureDir(OUT_DIR);

  const files = fs.readdirSync(IN_DIR).filter((f) => f.toLowerCase().endsWith(".svg"));
  if (!files.length) {
    console.error(`No .svg files found in: ${IN_DIR}`);
    process.exit(1);
  }

  let changed = 0;

  for (const f of files) {
    const inPath = path.join(IN_DIR, f);
    const outPath = path.join(OUT_DIR, f);

    const svg = fs.readFileSync(inPath, "utf8");
    const fixed = fixSvg(svg);

    if (fixed !== svg) changed++;
    fs.writeFileSync(outPath, fixed, "utf8");
  }

  console.log(`done. files=${files.length} changed=${changed}`);
  console.log(`in:  ${IN_DIR}`);
  console.log(`out: ${OUT_DIR}`);
}

main();