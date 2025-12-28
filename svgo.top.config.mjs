export default {
  multipass: true,
  js2svg: { pretty: false },
  plugins: [
    "preset-default",
    // Keep viewBox if you use it; your SVGs already use width/height/viewBox but this is safe.
    { name: "removeViewBox", active: false },

    // Don’t remove IDs because patterns/defs/use might rely on them
    { name: "cleanupIds", active: false },

    // Keep groups/defs structure stable
    { name: "collapseGroups", active: false },

    // Often helps size
    { name: "convertStyleToAttrs", active: true },
    { name: "removeDimensions", active: false },

    // Sometimes Illustrator gets weird with tiny precision; keep a sane float precision
    { name: "convertPathData", params: { floatPrecision: 2 } },
  ],
};