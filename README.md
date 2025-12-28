# Phil v1 — Top Trait (On-Chain SVG)

This repository contains the **Top (clothing) trait** for the Phil v1 NFT system.

The Top trait is:
- Fully **on-chain**
- Stored via **SSTORE2**
- Served through a single **TopAtlas** contract
- Verifiable and readable on **Ethereum testnets (Sepolia)**

Each Top variant (hoodie, shirt, tank, turtle, etc.) is stored once on-chain and retrieved deterministically by index.

---

## Overview

### Contracts
- **TopData.sol**
  - Stores a single optimized SVG using SSTORE2
  - One contract per SVG asset

- **TopAtlas.sol**
  - Registry that maps:
    - index → SSTORE2 pointer
    - index → human-readable name
  - Primary contract consumers interact with
  TopAtlas
├── hoodieTopBars
├── hoodieTopFaces
├── hoodieTopFaces2
├── shirtTopBars
├── shirtTopFaces
├── shirtTopFaces2
├── tankTopBars
├── tankTopBars2
├── tankTopFaces
├── tankTopFaces2
├── turtleTopBars
├── turtleTopFaces
└── turtleTopFaces2
---

## Repository Structure
contracts/
TopAtlas.sol          # Main on-chain registry
TopData.sol           # Stores one SVG via SSTORE2
lib/SSTORE2.sol

scripts/
buildTopManifest.cjs      # Optimizes SVGs + builds manifest
deployTopDataAndAtlas.cjs # Deploys TopData + TopAtlas
verifyTopAtlas.cjs        # Reads SVGs back from chain
verifyArgs_topAtlas.js    # Generates Etherscan verify args

tools/
generation/               # SVG generation scripts
svg_fixes/                # SVG normalization / escaping
debug/

tops/
*.svg                     # Source SVGs (pre-optimization)

out_top/
deploy_*.json              # Deployment outputs (gitignored)
manifest.json              # Build manifest (gitignored)
rendered_from_chain/       # Readback SVGs (gitignored)

docs/
TESTING.md                 # Step-by-step test instructions
---

## Requirements

- **Node.js 20** (see `.nvmrc`)
- npm
- Hardhat

Install dependencies:
```bash
npm install