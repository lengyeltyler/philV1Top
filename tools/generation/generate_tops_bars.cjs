#!/usr/bin/env node
/**
 * generate_tops_bars.cjs
 *
 * Stripe / bar pattern for Top trait (Illustrator-safe, NO clipPath):
 * - fills the top silhouette with a pattern of bars/stripes
 * - random bar direction + variable widths + variable lengths (chunky bars)
 * - random palette size: 3, 6, or 9 colors
 * - generates 1 SVG per Top JSON (hoodie/shirt/tank/turtle)
 *
 * UPDATED: bars now "fill" more:
 * - narrower widths (more bars)
 * - much smaller gaps
 * - fewer short chunks (more full bars)
 * - chunks are longer when used
 *
 * Usage:
 *   node generate_tops_bars.cjs
 *   node generate_tops_bars.cjs --seed 123
 *   node generate_tops_bars.cjs --colors 6 --angle 45 --density 1.6 --minify 1
 */

const fs = require("fs");
const path = require("path");
const svgPathBounds = require("svg-path-bounds");

// -------------------- CLI --------------------
function getArg(name, fallback = undefined) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  const val = process.argv[idx + 1];
  if (val == null || val.startsWith("--")) return true;
  return val;
}

const CANVAS = parseInt(getArg("canvas", "420"), 10);
const DECIMALS = parseInt(getArg("decimals", "0"), 10);
const MINIFY = String(getArg("minify", "1")) !== "0";
const SEED = getArg("seed", null) !== null ? parseInt(getArg("seed"), 10) : null;

// Optional controls
const FORCE_COLORS = getArg("colors", null) !== null ? parseInt(getArg("colors"), 10) : null; // 3/6/9
const FORCE_ANGLE = getArg("angle", null) !== null ? parseFloat(getArg("angle")) : null; // degrees

// NEW: density control (higher = more bars, smaller gaps)
const DENSITY = Math.max(0.6, Math.min(3.0, parseFloat(getArg("density", "1.6")))); // default 1.6

// -------------------- RNG --------------------
function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = SEED == null ? Math.random : mulberry32(SEED);
const r01 = () => rand();
const rInt = (min, max) => Math.floor(r01() * (max - min + 1)) + min;
const rFloat = (min, max) => r01() * (max - min) + min;

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rInt(0, i);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const fmt = (n) => Number(n).toFixed(DECIMALS);

// -------------------- Helpers --------------------
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
function minifySvg(svg) {
  return svg
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s+/g, " ")
    .replace(/>\s+</g, "><")
    .trim();
}

// -------------------- Path extraction --------------------
function extractPathData(jsonObj) {
  if (!jsonObj) throw new Error("Empty JSON");
  if (typeof jsonObj === "string") return jsonObj.trim();
  if (typeof jsonObj.path === "string") return jsonObj.path.trim();
  if (typeof jsonObj.d === "string") return jsonObj.d.trim();

  if (Array.isArray(jsonObj.paths)) {
    const parts = jsonObj.paths
      .map((p) => {
        if (!p) return "";
        if (typeof p === "string") return p;
        if (typeof p.d === "string") return p.d;
        if (typeof p.path === "string") return p.path;
        return "";
      })
      .filter(Boolean);
    if (parts.length) return parts.join(" ");
  }

  if (Array.isArray(jsonObj)) {
    const parts = jsonObj
      .map((p) => {
        if (!p) return "";
        if (typeof p === "string") return p;
        if (typeof p.d === "string") return p.d;
        if (typeof p.path === "string") return p.path;
        return "";
      })
      .filter(Boolean);
    if (parts.length) return parts.join(" ");
  }

  throw new Error("Could not find path data in JSON. Expected keys: path, d, paths.");
}

// -------------------- Config --------------------
const TOP_FILES = [
  { name: "hoodieTop", file: "hoodieTop.json" },
  { name: "shirtTop", file: "shirtTop.json" },
  { name: "tankTop", file: "tankTop.json" },
  { name: "turtleTop", file: "turtleTop.json" },
];

// Base palette pool (you can expand later)
const COLOR_POOL = [
  "#ffcc00", "#ff6a00", "#00c2ff", "#7c4dff", "#00d18f", "#ff3d71",
  "#ff5fa2", "#23c55e", "#0ea5e9", "#f97316", "#a855f7", "#22c55e",
  "#06b6d4", "#f43f5e", "#eab308", "#6366f1", "#14b8a6", "#111111"
];

function chooseColorCount() {
  if (FORCE_COLORS && [3, 6, 9].includes(FORCE_COLORS)) return FORCE_COLORS;
  return [3, 6, 9][rInt(0, 2)];
}

function chooseAngle() {
  if (FORCE_ANGLE != null) return FORCE_ANGLE;
  const angles = [0, 90, 25, -25, 45, -45, 65, -65];
  return angles[rInt(0, angles.length - 1)] + rFloat(-6, 6);
}

// -------------------- Pattern generation --------------------
function buildBarsPattern(topName, topPathD) {
  const colorsN = chooseColorCount();
  const pool = shuffle(COLOR_POOL.slice());
  const colors = pool.slice(0, colorsN);

  // bounds used only to bias bar range
  const [minX, minY, maxX, maxY] = svgPathBounds(topPathD);
  const pad = 6;
  const bx0 = Math.max(0, minX - pad);
  const by0 = Math.max(0, minY - pad);
  const bx1 = Math.min(CANVAS, maxX + pad);
  const by1 = Math.min(CANVAS, maxY + pad);

  const angle = chooseAngle();

  // Bars span large area so rotation still covers
  const bigH = CANVAS * 2.4;
  const bigY = -CANVAS * 0.7;

  // UPDATED: more dense bars
  // Higher density -> thinner bars and smaller gaps
  const wMin = Math.max(2.5, 6 / DENSITY);
  const wMax = Math.max(wMin + 2, 26 / DENSITY); // thinner max
  const gapMax = Math.max(0.5, 3.2 / DENSITY);   // smaller gaps

  // UPDATED: fewer chunk bars (so coverage looks "fuller")
  const chunkProb = 0.22;

  // Hard cap so SVG doesn't explode
  const MAX_RECTS = 260;

  let x = bx0 - 60;
  const xEnd = bx1 + 60;

  let rects = "";
  let rectCount = 0;

  let colorIdx = rInt(0, colors.length - 1);

  while (x < xEnd && rectCount < MAX_RECTS) {
    const w = rFloat(wMin, wMax);
    const fill = colors[colorIdx];

    // color progression
    if (r01() < 0.8) colorIdx = (colorIdx + 1) % colors.length;
    else colorIdx = rInt(0, colors.length - 1);

    if (r01() < chunkProb) {
      // UPDATED: chunk segments are LONGER (fills more)
      const hSpan = Math.max(40, by1 - by0);
      const segH = rFloat(hSpan * 0.55, hSpan * 1.10);
      const segY = rFloat(by0 - 18, by1 - segH + 18);

      rects += `<rect x="${fmt(x)}" y="${fmt(segY)}" width="${fmt(w)}" height="${fmt(segH)}" fill="${fill}"/>`;
      rectCount++;

      // Sometimes add a second long chunk to break monotony
      if (r01() < 0.18 && rectCount < MAX_RECTS) {
        const segH2 = rFloat(hSpan * 0.40, hSpan * 0.85);
        const segY2 = rFloat(by0 - 18, by1 - segH2 + 18);
        rects += `<rect x="${fmt(x)}" y="${fmt(segY2)}" width="${fmt(w)}" height="${fmt(segH2)}" fill="${fill}"/>`;
        rectCount++;
      }
    } else {
      // Full bar (dominant)
      rects += `<rect x="${fmt(x)}" y="${fmt(bigY)}" width="${fmt(w)}" height="${fmt(bigH)}" fill="${fill}"/>`;
      rectCount++;
    }

    x += w + rFloat(0, gapMax);
  }

  // Background: pick one of palette colors, but bias towards a "base" that won't dominate
  const bg = colors[rInt(0, colors.length - 1)];

  const cx = CANVAS / 2;
  const cy = CANVAS / 2;

  const defs = `
<pattern id="pat_${topName}"
         patternUnits="userSpaceOnUse"
         patternContentUnits="userSpaceOnUse"
         x="0" y="0" width="${CANVAS}" height="${CANVAS}">
  <rect x="0" y="0" width="${CANVAS}" height="${CANVAS}" fill="${bg}"/>
  <g transform="rotate(${fmt(angle)} ${fmt(cx)} ${fmt(cy)})">
    ${rects}
  </g>
</pattern>`;

  return { defs, colorsN, colors, angle, rectCount, wMin, wMax, gapMax, chunkProb };
}

// -------------------- SVG build --------------------
function generateOneTop(topName, topPathD, outPath) {
  const info = buildBarsPattern(topName, topPathD);

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     width="${CANVAS}" height="${CANVAS}" viewBox="0 0 ${CANVAS} ${CANVAS}">
  <defs>${info.defs}</defs>

  <path d="${topPathD}" fill="url(#pat_${topName})"/>
  <path d="${topPathD}" fill="none" stroke="#000" stroke-opacity="0.25" stroke-width="1"/>
</svg>`;

  const out = MINIFY ? minifySvg(svg) : svg;
  fs.writeFileSync(outPath, out, "utf8");

  return {
    bytes: Buffer.byteLength(out, "utf8"),
    colorsN: info.colorsN,
    colors: info.colors,
    angle: info.angle,
    rectCount: info.rectCount,
    wMin: info.wMin,
    wMax: info.wMax,
    gapMax: info.gapMax,
    chunkProb: info.chunkProb,
  };
}

// -------------------- Main --------------------
function main() {
  const root = process.cwd();
  const jsonDir = path.join(root, "jsons");
  const outDir = path.join(root, "out");
  ensureDir(outDir);

  console.log(
    `canvas=${CANVAS} decimals=${DECIMALS} minify=${MINIFY ? 1 : 0} seed=${SEED ?? "none"} colors=${
      FORCE_COLORS ?? "rand(3/6/9)"
    } angle=${FORCE_ANGLE ?? "rand"} density=${DENSITY}`
  );
  console.log(`reading from: ${jsonDir}`);
  console.log(`writing to:   ${outDir}\n`);

  for (const t of TOP_FILES) {
    const p = path.join(jsonDir, t.file);
    if (!fs.existsSync(p)) {
      console.warn(`- missing ${t.file} (skipping)`);
      continue;
    }

    const raw = fs.readFileSync(p, "utf8");
    const json = JSON.parse(raw);
    const d = extractPathData(json);

    const outPath = path.join(outDir, `${t.name}.svg`);
    const info = generateOneTop(t.name, d, outPath);

    console.log(`- ${t.name}: wrote ${outPath}`);
    console.log(
      `  bytes=${info.bytes} rects=${info.rectCount} w=[${info.wMin.toFixed(2)},${info.wMax.toFixed(
        2
      )}] gap<=${info.gapMax.toFixed(2)} chunkProb=${info.chunkProb.toFixed(2)}`
    );
    console.log(
      `  colors=${info.colorsN} angle=${info.angle.toFixed(2)} palette=${info.colors.join(",")}\n`
    );
  }

  console.log("done.");
}

main();