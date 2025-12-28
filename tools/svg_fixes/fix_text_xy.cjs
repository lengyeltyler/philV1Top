#!/usr/bin/env node
/**
 * fix_text_xy.cjs
 *
 * Fixes SVGs for on-chain + “copy/paste into .svg and open” reliability:
 *  1) Add x="0" y="0" on <text> when missing
 *  2) Escape invalid XML chars INSIDE text nodes (ex: "<3" -> "&lt;3")
 *
 * Usage:
 *   node scripts/fix_text_xy.cjs --in_dir ./out_top/optimized_fixed --out_dir ./out_top/optimized_fixed
 *
 * If out_dir == in_dir, it overwrites in place.
 */

const fs = require("fs");
const path = require("path");

function getArg(name, fallback = undefined) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  const val = process.argv[idx + 1];
  if (val == null || val.startsWith("--")) return true;
  return val;
}

const IN_DIR = getArg("in_dir", null);
const OUT_DIR = getArg("out_dir", null);

if (!IN_DIR || !OUT_DIR) {
  console.error("Missing args. Example:");
  console.error("  node scripts/fix_text_xy.cjs --in_dir ./out_top/optimized_fixed --out_dir ./out_top/optimized_fixed");
  process.exit(1);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function escapeTextNodeContent(s) {
  // Important: don't double-escape existing entities.
  // 1) escape '&' that is NOT already part of an entity
  s = s.replace(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;)/g, "&amp;");
  // 2) escape literal '<' and '>' in text content
  s = s.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return s;
}

function addXYAndEscape(svg) {
  // Add x="0" if missing
  svg = svg.replace(/<text(?![^>]*\bx=)([^>]*)>/g, `<text x="0"$1>`);
  // Add y="0" if missing
  svg = svg.replace(/<text(?![^>]*\by=)([^>]*)>/g, `<text y="0"$1>`);

  // Escape ONLY the content between <text ...> ... </text>
  svg = svg.replace(/<text([^>]*)>([\s\S]*?)<\/text>/g, (_m, attrs, content) => {
    const fixed = escapeTextNodeContent(content);
    return `<text${attrs}>${fixed}</text>`;
  });

  return svg;
}

function main() {
  ensureDir(OUT_DIR);

  const files = fs
    .readdirSync(IN_DIR)
    .filter((f) => f.toLowerCase().endsWith(".svg"))
    .sort();

  if (!files.length) {
    console.error(`No .svg files found in: ${IN_DIR}`);
    process.exit(1);
  }

  console.log(`Fixing ${files.length} SVG(s)`);
  console.log(`in:  ${IN_DIR}`);
  console.log(`out: ${OUT_DIR}`);
  console.log("");

  for (const f of files) {
    const inPath = path.join(IN_DIR, f);
    const outPath = path.join(OUT_DIR, f);

    const raw = fs.readFileSync(inPath, "utf8");
    const fixed = addXYAndEscape(raw);

    fs.writeFileSync(outPath, fixed, "utf8");
    console.log(`wrote: ${outPath} (bytes=${Buffer.byteLength(fixed, "utf8")})`);
  }

  console.log("\ndone.");
}

main();