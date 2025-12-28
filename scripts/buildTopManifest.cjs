#!/usr/bin/env node
/* scripts/buildTopManifest.cjs */

const fs = require("fs");
const path = require("path");
const { optimize } = require("svgo");

const INPUT_DIR = process.env.IN_DIR || "out_top/optimized_fixed";
const OUT_DIR = "out_top";
const OUT_MANIFEST = path.join(OUT_DIR, "manifest.json");

// Adjust this ordering if you use different filenames.
// This must match the order you want indices to map to.
const ORDER = [
  "hoodieTopBars.svg",
  "hoodieTopFaces.svg",
  "hoodieTopFaces2.svg",
  "shirtTopBars.svg",
  "shirtTopFaces.svg",
  "shirtTopFaces2.svg",
  "tankTopBars.svg",
  "tankTopBars2.svg",
  "tankTopFaces.svg",
  "tankTopFaces2.svg",
  "turtleTopBars.svg",
  "turtleTopFaces.svg",
  "turtleTopFaces2.svg",
];

// Map filename -> trait name
const NAME_BY_FILE = {
  "hoodieTopBars.svg": "hoodieTopBars",
  "hoodieTopFaces.svg": "hoodieTopFaces",
  "hoodieTopFaces2.svg": "hoodieTopFaces2",
  "shirtTopBars.svg": "shirtTopBars",
  "shirtTopFaces.svg": "shirtTopFaces",
  "shirtTopFaces2.svg": "shirtTopFaces2",
  "tankTopBars.svg": "tankTopBars",
  "tankTopBars2.svg": "tankTopBars2",
  "tankTopFaces.svg": "tankTopFaces",
  "tankTopFaces2.svg": "tankTopFaces2",
  "turtleTopBars.svg": "turtleTopBars",
  "turtleTopFaces.svg": "turtleTopFaces",
  "turtleTopFaces2.svg": "turtleTopFaces2",
};

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

// Only fix TEXT CONTENT cases that break XML (like "<3").
// We deliberately target the pattern `>...<` so we don't touch tag syntax.
function escapeBadText(svg) {
  // Convert literal "<3" *in text nodes* to "&lt;3"
  svg = svg.replace(/>([^<]*?)<3([^<]*?)</g, (m, a, b) => `>${a}&lt;3${b}<`);
  return svg;
}

function minifySvg(svg) {
  const res = optimize(svg, {
    multipass: true,
    plugins: [
      // Use preset-default, but do NOT try to configure removeViewBox inside it.
      {
        name: "preset-default",
        params: {
          overrides: {
            // Keep viewBox (you want it for scaling)
            removeViewBox: false,
          },
        },
      },
      // This is safe and often shrinks output a bit.
      { name: "convertStyleToAttrs" },
    ],
  });

  if (res.error) throw new Error(res.error);
  return res.data;
}

function main() {
  console.log(`reading from: ${INPUT_DIR}`);
  console.log(`writing to:   ${OUT_DIR}`);

  ensureDir(OUT_DIR);

  const items = [];

  for (let i = 0; i < ORDER.length; i++) {
    const filename = ORDER[i];
    const full = path.join(INPUT_DIR, filename);

    if (!fs.existsSync(full)) {
      throw new Error(`Missing file: ${full}`);
    }

    const raw = fs.readFileSync(full, "utf8");

    // 1) SVGO
    let svg = minifySvg(raw);

    // 2) Escape invalid XML text (e.g. "<3" inside <text>)
    svg = escapeBadText(svg);

    // 3) Convert to bytes/hex
    const buf = Buffer.from(svg, "utf8");
    const hex = "0x" + buf.toString("hex");

    const name = NAME_BY_FILE[filename] || path.parse(filename).name;

    items.push({
      index: i,
      name,
      filename,
      bytes: buf.length,
      hex,
    });

    console.log(`ok: ${name} bytes=${buf.length}`);
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    inputDir: INPUT_DIR,
    count: items.length,
    items,
  };

  fs.writeFileSync(OUT_MANIFEST, JSON.stringify(manifest, null, 2));
  console.log(`wrote: ${OUT_MANIFEST}`);
  console.log("done.");
}

main();