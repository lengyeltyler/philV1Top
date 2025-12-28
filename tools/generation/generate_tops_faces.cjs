#!/usr/bin/env node
/**
 * generate_tops.cjs (Illustrator-safe, character faces, spaced, small)
 *
 * Key Illustrator compatibility:
 * - Use only "Arial" (avoid DejaVu/Noto warnings)
 * - Default: ASCII-only faces (no missing glyphs / alternate glyph warnings)
 * - Optional: --asciiOnly 0 enables full unicode list (may warn depending on fonts)
 *
 * Usage:
 *   node generate_tops.cjs
 *   node generate_tops.cjs --faces 42
 *   node generate_tops.cjs --faces 42 --asciiOnly 0   # full list (may warn)
 */

const fs = require("fs");
const path = require("path");

const { pointInSvgPath } = require("point-in-svg-path");
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
const FACES = parseInt(getArg("faces", "42"), 10);
const DECIMALS = parseInt(getArg("decimals", "0"), 10);
const MINIFY = String(getArg("minify", "1")) !== "0";
const SEED = getArg("seed", null) !== null ? parseInt(getArg("seed"), 10) : null;
const FORCE_FILL = getArg("fill", null);
const ASCII_ONLY = String(getArg("asciiOnly", "1")) !== "0"; // default ON

// Illustrator-friendly discrete opacity
const OP_LEVELS = [0.45, 0.6, 0.75, 0.9, 1.0];

// Your full list
const EMOTES_ALL = [
  ":-)", ":-D", ":-(", ";-)", ":-P", ":-O", "8-)", ":/", "XD", "<3",
  "(^^)", "(◕‿◕)", "(UwU)", "(OwO)", "(*^ω^)", "(✿◠‿◠)", "(>ᴗ<)", "^^",
  "(T_T)", "( ;; )", "(..)", "(--)", "(><)", "(x_x)", "(..)?", "¯_(ツ)/¯",
  "(ಠ_ಠ)", "(¬¬)", "(╬ Ò﹏Ó)", "t(--t)", "(╯°□°）╯︵ ┻━┻", "(ง'̀-'́)ง",
  "(=^･^=)", "(^(I)^)", "ʕ•ᴥ•ʔ", "(V) (;,,;) (V)", "[¬º-°]¬", "><((((º>",
  "( ͡° ͜ʖ ͡°)", "($_$)", "(_)", "(¬‿¬)"
];

// ASCII-safe subset (no Unicode glyph dependency)
const EMOTES_ASCII = [
  ":-)", ":-D", ":-(", ";-)", ":-P", ":-O", "8-)", ":/", "XD", "<3",
  "(^^)", "^^", "(T_T)", "( ;; )", "(..)", "(--)", "(><)", "(x_x)", "(..)?",
  "t(--t)", "($_$)", "(_)", "(V) (;,,;) (V)"
];

// Pick list
const EMOTES = ASCII_ONLY ? EMOTES_ASCII : EMOTES_ALL;

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
const pick = (arr) => arr[rInt(0, arr.length - 1)];

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

// XML escape for text content
function xmlEscape(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
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

// -------------------- Placement geometry --------------------
function emoteMetrics(scale, emoteStr) {
  const len = Math.max(1, emoteStr.length);
  const fudge = len >= 8 ? 2 : 1;
  const glyphs = len + fudge;

  const halfW = scale * 12 * 0.6 * (glyphs / 2);
  const halfH = scale * 12 * 0.75;
  const r = Math.sqrt(halfW * halfW + halfH * halfH);
  return { halfW, halfH, r };
}

function emoteFits(pathD, x, y, scale, rotDeg, emoteStr) {
  if (!pointInSvgPath(pathD, x, y)) return false;

  const { halfW, halfH } = emoteMetrics(scale, emoteStr);
  const rad = (rotDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const corners = [
    { dx: -halfW, dy: -halfH },
    { dx: halfW, dy: -halfH },
    { dx: halfW, dy: halfH },
    { dx: -halfW, dy: halfH },
  ];

  for (const c of corners) {
    const px = x + c.dx * cos - c.dy * sin;
    const py = y + c.dx * sin + c.dy * cos;
    if (!pointInSvgPath(pathD, px, py)) return false;
  }
  return true;
}

function spacedEnough(x, y, r, placed, pad = 5) {
  for (const p of placed) {
    const dx = x - p.x;
    const dy = y - p.y;
    const minD = r + p.r + pad;
    if (dx * dx + dy * dy < minD * minD) return false;
  }
  return true;
}

// -------------------- Symbols --------------------
function emoteSymbol(symbolId, emoteText, fillOpacity) {
  const t = xmlEscape(emoteText);

  // Keep it simple: Arial only to avoid DejaVu warnings
  const fontFamily = "Arial";

  return `
<symbol id="${symbolId}" overflow="visible">
  <text x="0" y="0"
        text-anchor="middle"
        dominant-baseline="middle"
        font-family="${fontFamily}"
        font-size="12"
        fill="#000"
        fill-opacity="${fillOpacity}">${t}</text>
</symbol>`;
}

// -------------------- Main --------------------
const TOP_FILES = [
  { name: "hoodieTop", file: "hoodieTop.json" },
  { name: "shirtTop", file: "shirtTop.json" },
  { name: "tankTop", file: "tankTop.json" },
  { name: "turtleTop", file: "turtleTop.json" },
];

const PALETTE = ["#ffcc00","#ff6a00","#00c2ff","#7c4dff","#00d18f","#ff3d71","#e6e6e6","#111111"];

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rInt(0, i);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function generateOneTop(topName, topPathD, outPath) {
  const [minX, minY, maxX, maxY] = svgPathBounds(topPathD);
  const pad = 2;
  const bx0 = Math.max(0, minX - pad);
  const by0 = Math.max(0, minY - pad);
  const bx1 = Math.min(CANVAS, maxX + pad);
  const by1 = Math.min(CANVAS, maxY + pad);

  const fillColor = FORCE_FILL ? FORCE_FILL : pick(PALETTE);

  // Jittered grid candidates for spread
  const w = Math.max(1, bx1 - bx0);
  const h = Math.max(1, by1 - by0);
  const gridN = Math.ceil(Math.sqrt(FACES * 2));
  const cellW = w / gridN;
  const cellH = h / gridN;

  const candidates = [];
  for (let gy = 0; gy < gridN; gy++) {
    for (let gx = 0; gx < gridN; gx++) {
      for (let k = 0; k < 2; k++) {
        const x = bx0 + gx * cellW + rFloat(0.15, 0.85) * cellW;
        const y = by0 + gy * cellH + rFloat(0.15, 0.85) * cellH;
        candidates.push({ x, y });
      }
    }
  }
  shuffle(candidates);

  const placed = []; // {x,y,r,ei,oi,rot,sc}
  let attempts = 0;

  function tryPlaceAt(x, y) {
    const sc = rFloat(0.75, 1.25);
    const rot = rFloat(-14, 14);
    const ei = rInt(0, EMOTES.length - 1);
    const oi = rInt(0, OP_LEVELS.length - 1);

    const { r } = emoteMetrics(sc, EMOTES[ei]);

    if (!emoteFits(topPathD, x, y, sc, rot, EMOTES[ei])) return false;
    if (!spacedEnough(x, y, r, placed, 6)) return false;

    placed.push({ x, y, r, ei, oi, rot, sc });
    return true;
  }

  // Pass 1: candidates
  for (const c of candidates) {
    if (placed.length >= FACES) break;
    attempts++;
    tryPlaceAt(c.x, c.y);
  }

  // Pass 2: random fallback
  const maxAttempts = FACES * 400;
  while (placed.length < FACES && attempts < maxAttempts) {
    attempts++;
    const x = rFloat(bx0, bx1);
    const y = rFloat(by0, by1);
    tryPlaceAt(x, y);
  }

  // Only define symbols actually used
  const usedKeys = new Map(); // "ei_oi" -> "s0"
  let symCount = 0;
  for (const p of placed) {
    const key = `${p.ei}_${p.oi}`;
    if (!usedKeys.has(key)) usedKeys.set(key, `s${symCount++}`);
  }

  let defs = "";
  for (const [key, sid] of usedKeys.entries()) {
    const [eiStr, oiStr] = key.split("_");
    const ei = parseInt(eiStr, 10);
    const oi = parseInt(oiStr, 10);
    defs += emoteSymbol(sid, EMOTES[ei], OP_LEVELS[oi]);
  }

  let uses = "";
  for (const p of placed) {
    const sid = usedKeys.get(`${p.ei}_${p.oi}`);
    uses += `<use xlink:href="#${sid}" transform="translate(${fmt(p.x)} ${fmt(p.y)}) rotate(${fmt(
      p.rot
    )}) scale(${fmt(p.sc)})"/>`;
  }

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${CANVAS}" height="${CANVAS}" viewBox="0 0 ${CANVAS} ${CANVAS}">
  <defs>
    ${defs}
    <pattern id="pat_${topName}"
             patternUnits="userSpaceOnUse"
             patternContentUnits="userSpaceOnUse"
             x="0" y="0" width="${CANVAS}" height="${CANVAS}">
      <rect x="0" y="0" width="${CANVAS}" height="${CANVAS}" fill="${fillColor}"/>
      ${uses}
    </pattern>
  </defs>

  <path d="${topPathD}" fill="url(#pat_${topName})"/>
  <path d="${topPathD}" fill="none" stroke="#000" stroke-opacity="0.25" stroke-width="1"/>
</svg>`;

  const out = MINIFY ? minifySvg(svg) : svg;
  fs.writeFileSync(outPath, out, "utf8");

  return {
    placed: placed.length,
    attempts,
    fillColor,
    bytes: Buffer.byteLength(out, "utf8"),
    symbols: usedKeys.size,
  };
}

function main() {
  const root = process.cwd();
  const jsonDir = path.join(root, "jsons");
  const outDir = path.join(root, "out");
  ensureDir(outDir);

  console.log(
    `canvas=${CANVAS} faces=${FACES} asciiOnly=${ASCII_ONLY ? 1 : 0} emotes=${EMOTES.length} opLevels=${OP_LEVELS.length} decimals=${DECIMALS} minify=${
      MINIFY ? 1 : 0
    } seed=${SEED ?? "none"} fill=${FORCE_FILL ?? "random"}`
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
      `  placed=${info.placed}/${FACES} attempts=${info.attempts} symbols=${info.symbols} fill=${info.fillColor} bytes=${info.bytes}\n`
    );
  }

  console.log("done.");
}

main();