const fs = require("fs"),
  crypto = require("crypto");
const hash = (x) =>
  crypto.createHash("sha256").update(JSON.stringify(x)).digest("hex");
function save(file, value) {
  const temp = file + ".tmp";
  fs.writeFileSync(temp, JSON.stringify(value, null, 2), { mode: 0o600 });
  fs.renameSync(temp, file);
}
function reserve(file, request, price, maxOutput) {
  const ledger = JSON.parse(fs.readFileSync(file)),
    id = hash(request);
  const old = ledger.requests.find((x) => x.id === id);
  if (old) return old;
  const upper =
    ((Buffer.byteLength(JSON.stringify(request)) + 4096) *
      Math.max(price.input_mtok, price.cache_write_mtok || 0) +
      maxOutput * price.output_mtok) /
    1e6;
  const used = ledger.requests.reduce(
    (s, r) => s + (r.status === "settled" ? r.cost : r.reserved),
    0,
  );
  if (used + upper > ledger.ceiling) throw Error("Budget ceiling");
  const row = {
    id,
    status: "intent",
    reserved: upper,
    started_at: new Date().toISOString(),
    model: request.model,
    case_id: request.case_id,
    stage: request.stage,
  };
  ledger.requests.push(row);
  save(file, ledger);
  return row;
}
function settle(file, id, receipt) {
  const ledger = JSON.parse(fs.readFileSync(file)),
    r = ledger.requests.find((x) => x.id === id);
  if (!r) throw Error("No reservation");
  const cost = receipt.costs?.total_cost_usd;
  if (
    !Number.isFinite(cost) ||
    cost < 0 ||
    !receipt.usage ||
    !receipt.provider_response_id
  )
    throw Error("Missing usage receipt");
  if (r.status === "settled") {
    if (
      r.provider_response_id !== receipt.provider_response_id ||
      r.cost !== cost
    )
      throw Error("Conflicting receipt");
    return;
  }
  if (cost > r.reserved) throw Error("Exceeded reservation");
  Object.assign(r, {
    status: "settled",
    cost,
    provider_response_id: receipt.provider_response_id,
    finished_at: new Date().toISOString(),
    usage: receipt.usage,
    latency_ms: receipt.latency_ms,
  });
  save(file, ledger);
}
module.exports = { hash, save, reserve, settle };
