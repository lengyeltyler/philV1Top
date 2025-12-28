#!/usr/bin/env node
/**
 * patch_top_svgs_for_xml.cjs
 *
 * Fixes SVGs so they are valid XML when returned by getSvg():
 * - Escapes XML special chars inside <text>...</text> nodes (e.g. "<3" -> "&lt;3")
 * - Also escapes & > " ' in text nodes
 * - Keeps everything else unchanged (paths, patterns, etc.)
 *
 * Usage:
 *   node scripts/patch_top_svgs_for_xml.cjs --in ./out_top/optimized --out ./out_top/optimized_fixed
 *   node scripts/patch_top_svgs_for_xml.cjs --in ./out_top/optimized --inplace 1
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

const IN_DIR = getArg("in", "./out_top/optimized");
const OUT_DIR = getArg("out", null);
const INPLACE = String(getArg("inplace", "0")) === "1";

if (!fs.existsSync(IN_DIR) || !fs.statSync(IN_DIR).isDirectory()) {
  console.error(`Input folder not found: ${IN_DIR}`);
  process.exit(1);
}

if (!INPLACE && !OUT_DIR) {
  console.error(`Provide --out <folder> or use --inplace 1`);
  process.exit(1);
}

if (!INPLACE) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

// Escape ONLY text-node content (not markup)
function escXmlText(s) {
  return String(s)
    .replace(/&/g, "&amp;")   // must be first
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Some SVGs might have already-escaped entities; we do NOT want to double-escape.
// Strategy:
// 1) Temporarily protect existing entities like &lt; &gt; &amp; &#...; &#x...;
// 2) Escape everything
// 3) Restore protected entities
function escXmlTextNoDouble(s) {
  const protectedEntities = [];
  const protect = (m) => {
    protectedEntities.push(m);
    return `__ENT_${protectedEntities.length - 1}__`;
  };

  // protect common entities and numeric entities
  const tmp = String(s).replace(/&(?:lt|gt|amp|quot|apos);|&#\d+;|&#x[0-9a-fA-F]+;/g, protect);

  const escaped = escXmlText(tmp);

  // restore entities
  return escaped.replace(/__ENT_(\d+)__/g, (_, i) => protectedEntities[Number(i)]);
}

// Patch all <text ...>CONTENT</text> nodes.
// Works for minified SVG too. Uses non-greedy match for content.
function patchSvg(svg) {
  let changed = 0;

  const out = svg.replace(
    /<text\b([^>]*)>([\s\S]*?)<\/text>/g,
    (full, attrs, content) => {
      const fixed = escXmlTextNoDouble(content);
      if (fixed !== content) changed++;
      return `<text${attrs}>${fixed}</text>`;
    }
  );

  // Optional: strip any illegal ASCII control chars (can break parsers)
  const cleaned = out.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");

  return { cleaned, changed };
}

function main() {
  const files = fs.readdirSync(IN_DIR).filter((f) => f.toLowerCase().endsWith(".svg"));
  if (!files.length) {
    console.log(`No .svg files found in ${IN_DIR}`);
    return;
  }

  let totalChangedNodes = 0;
  let totalFilesChanged = 0;

  for (const f of files) {
    const inPath = path.join(IN_DIR, f);
    const svg = fs.readFileSync(inPath, "utf8");

    const { cleaned, changed } = patchSvg(svg);

    const isDifferent = cleaned !== svg;
    if (isDifferent) totalFilesChanged++;
    totalChangedNodes += changed;

    const outPath = INPLACE ? inPath : path.join(OUT_DIR, f);
    fs.writeFileSync(outPath, cleaned, "utf8");

    const bytes = Buffer.byteLength(cleaned, "utf8");
    console.log(`${isDifferent ? "patched" : "ok     "}  ${f}  (text_nodes_fixed=${changed}, bytes=${bytes})`);
  }

  console.log("");
  console.log(`Done. Files processed: ${files.length}`);
  console.log(`Files modified: ${totalFilesChanged}`);
  console.log(`Total <text> nodes fixed: ${totalChangedNodes}`);

  if (!INPLACE) {
    console.log(`Output folder: ${OUT_DIR}`);
  }
}

main();