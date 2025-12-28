#!/usr/bin/env node
/* scripts/deployTopDataAndAtlas.cjs */

const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const OUT_DIR = "out_top";
const MANIFEST = path.join(OUT_DIR, "manifest.json");
const DEPLOY_OUT =
  hre.network.name === "sepolia"
    ? path.join(OUT_DIR, "deploy_sepolia.json")
    : path.join(OUT_DIR, `deploy_${hre.network.name}.json`);

function decodeHexToUtf8(hex) {
  const h = hex.startsWith("0x") ? hex : "0x" + hex;
  return Buffer.from(h.slice(2), "hex").toString("utf8");
}

function assertNoLiteralLessThan3(label, svg) {
  // Fail only on *literal* "<3". "&lt;3" is fine.
  if (svg.includes("<3")) {
    // Print a small context window to help locate it
    const idx = svg.indexOf("<3");
    const start = Math.max(0, idx - 40);
    const end = Math.min(svg.length, idx + 40);
    const ctx = svg.slice(start, end);
    throw new Error(
      `[${label}] contains literal "<3" (invalid XML). Context: ${JSON.stringify(ctx)}`
    );
  }
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deploying ${hre.network.name}...`);
  console.log(`deployer: ${deployer.address}`);

  if (!fs.existsSync(MANIFEST)) {
    throw new Error(`Missing manifest: ${MANIFEST} (run buildTopManifest first)`);
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  if (!manifest.items || !Array.isArray(manifest.items)) {
    throw new Error("manifest.json missing items[]");
  }

  const TopData = await hre.ethers.getContractFactory("TopData");
  const ptrs = [];
  const names = [];
  const deployedItems = [];

  console.log(`Deploying ${manifest.items.length} TopData contracts...`);

  for (const it of manifest.items) {
    if (typeof it.hex !== "string") throw new Error(`Bad hex for ${it.name}`);
    const hex = it.hex.startsWith("0x") ? it.hex : "0x" + it.hex;

    // PRE-CHECK: decode the exact bytes we’re about to store
    const svgPre = decodeHexToUtf8(hex);
    assertNoLiteralLessThan3(`PRE ${it.name}`, svgPre);

    // bytes for constructor
    const dataBytes = hre.ethers.getBytes(hex);

    const topData = await TopData.deploy(dataBytes);
    await topData.waitForDeployment();

    const topDataAddr = await topData.getAddress();
    const pointer = await topData.pointer();

    // SANITY CHECK: pointer contract code must start with 0x00 (STOP prefix)
    const code = await hre.ethers.provider.getCode(pointer);
    if (!code || code.length < 4 || !code.startsWith("0x00")) {
      throw new Error(
        `Pointer sanity check failed for ${it.name}. ` +
          `Expected pointer runtime to start with 0x00. ` +
          `Got: ${code ? code.slice(0, 10) : code} ` +
          `pointer=${pointer} topData=${topDataAddr}`
      );
    }

    // POST-CHECK: read back the bytes via SSTORE2 and validate again
    // (pointer runtime is 0x00 + data, so strip first byte)
    const runtime = code.startsWith("0x") ? code.slice(2) : code;
    const dataHex = "0x" + runtime.slice(2); // drop 1 byte (2 hex chars)
    const svgPost = decodeHexToUtf8(dataHex);
    assertNoLiteralLessThan3(`POST ${it.name}`, svgPost);

    ptrs.push(pointer);
    names.push(it.name);

    deployedItems.push({
      index: it.index,
      name: it.name,
      filename: it.filename,
      bytes: it.bytes,
      TopData: topDataAddr,
      pointer,
    });

    console.log(
      `#${it.index} ${it.name}: TopData=${topDataAddr} pointer=${pointer} bytes=${it.bytes}`
    );
  }

  const TopAtlas = await hre.ethers.getContractFactory("TopAtlas");

  console.log("\nTopAtlas ctor types:", TopAtlas.interface.deploy.inputs.map((x) => x.type));
  console.log(`TopAtlas arg2 type=string[] value=Array(len=${names.length})\n`);

  const atlas = await TopAtlas.deploy(ptrs, names);
  await atlas.waitForDeployment();
  const atlasAddr = await atlas.getAddress();

  console.log(`TopAtlas: ${atlasAddr}`);
  console.log(`count: ${await atlas.count()}`);

  // OPTIONAL: Verify getSvg returns a string that still has no literal "<3"
  // (If the explorer shows "<3" later, it’s display/copy behavior.)
  for (let i = 0; i < Math.min(names.length, 13); i++) {
    const s = await atlas.getSvg(i);
    assertNoLiteralLessThan3(`ATLAS getSvg(${i}) ${names[i]}`, s);
  }
  console.log("roundtrip checks: OK (no literal <3 in getSvg outputs)");

  const out = {
    network: hre.network.name,
    deployer: deployer.address,
    atlas: atlasAddr,
    items: deployedItems,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(DEPLOY_OUT, JSON.stringify(out, null, 2));
  console.log(`wrote: ${DEPLOY_OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});