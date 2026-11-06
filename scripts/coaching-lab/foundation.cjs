const { hash } = require("./accounting.cjs");
// Ordered, immutable source layers. Reasoning layers are not provider stages.
function compose(layers) {
  const ids = new Set();
  for (const layer of layers) {
    if (
      !layer.id ||
      ids.has(layer.id) ||
      !layer.source ||
      !layer.revision ||
      typeof layer.text !== "string"
    )
      throw Error("Invalid foundation layer");
    if (hash(layer.text) !== layer.digest)
      throw Error("Foundation digest mismatch");
    ids.add(layer.id);
  }
  return layers.map((layer) => layer.text).join("");
}
function manifest(layers) {
  compose(layers);
  return layers.map(({ text, ...metadata }) => metadata);
}
module.exports = { compose, manifest };
