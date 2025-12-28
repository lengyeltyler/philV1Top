#!/usr/bin/env node
/**
 * Escapes illegal XML characters inside <text>...</text> nodes.
 * Specifically fixes "<3" (and any other "<" that appears in text),
 * by converting "<" -> "&lt;".
 *
 * Usage:
 *   node scripts/fix_text_escape.cjs out_top/optimized_fixed
 *
 * (Runs in-place on all .svg files in the folder)
 */
const fs = require("fs");
const path = require("path");

const dir = process.argv[2];
if (!dir) {
  console.error("Usage: node scripts/fix_text_escape.cjs <folder>");
  process.exit(1);
}
if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
  console.error(`Not a directory: ${dir}`);
  process.exit(1);
}

function sanitizeSvg(svg) {
  // Only touch content INSIDE <text> ... </text>
  return svg.replace(/(<text\b[^>]*>)([\s\S]*?)(<\/text>)/g, (m, open, content, close) => {
    // Escape any raw "<" that would start an invalid tag inside text nodes.
    // (Do NOT double-escape existing entities like &lt; — they don't contain "<" anyway.)
    const fixed = content.replace(/</g, "&lt;");
    return open + fixed + close;
  });
}

const files = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith(".svg"));
if (!files.length) {
  console.log(`No .svg files found in ${dir}`);
  process.exit(0);
}

let changed = 0;
for (const f of files) {
  const p = path.join(dir, f);
  const before = fs.readFileSync(p, "utf8");
  const after = sanitizeSvg(before);
  if (after !== before) {
    fs.writeFileSync(p, after, "utf8");
    changed++;
  }
}

console.log(`Processed ${files.length} SVGs in ${dir}. Updated ${changed}.`);