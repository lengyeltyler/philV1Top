const fs = require("fs");
const path = require("path");

async function main() {
  const root = process.cwd();
  const deployPath = path.join(root, "out_top", `deploy_${hre.network.name}.json`);
  if (!fs.existsSync(deployPath)) {
    throw new Error(`Missing ${deployPath}. Deploy first.`);
  }

  const dep = JSON.parse(fs.readFileSync(deployPath, "utf8"));
  const atlasAddr = dep.atlas;

  const TopAtlas = await ethers.getContractFactory("TopAtlas");
  const atlas = TopAtlas.attach(atlasAddr);

  const count = Number(await atlas.count());
  console.log("atlas:", atlasAddr);
  console.log("count:", count);

  const outDir = path.join(root, "out_top", "rendered_from_chain");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  for (let i = 0; i < count; i++) {
    const name = dep.items[i]?.name ?? `top_${i}`;
    const svg = await atlas.getSvg(i);

    const outPath = path.join(outDir, `${String(i).padStart(3, "0")}_${name}.svg`);
    fs.writeFileSync(outPath, svg, "utf8");
    console.log("wrote:", outPath, "len=", svg.length);
  }

  console.log("done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});