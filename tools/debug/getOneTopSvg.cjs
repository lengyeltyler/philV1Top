const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
  const atlas = process.env.ATLAS;
  const idx = Number(process.env.IDX || "0");

  if (!atlas) throw new Error("Set ATLAS=0x...");

  const TopAtlas = await hre.ethers.getContractFactory("TopAtlas");
  const a = TopAtlas.attach(atlas);

  const svg = await a.getSvg(idx);
  const outDir = path.join(__dirname, "..", "out_top", "oneoffs");
  fs.mkdirSync(outDir, { recursive: true });

  const outPath = path.join(outDir, `top_${String(idx).padStart(3, "0")}.svg`);
  fs.writeFileSync(outPath, svg, "utf8");
  console.log("wrote:", outPath, "len=", svg.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});