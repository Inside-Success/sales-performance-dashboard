// JSONB may reorder keys. Restore the original JSON's order only when every value
// and array position still matches the validated saved object.
function checkpointJsonOrder(parsed,modelText) {
  const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
  try { const original=JSON.parse(modelText);return JSON.stringify(stable(original))===JSON.stringify(stable(parsed))?original:parsed; } catch { return parsed; }
}
module.exports={checkpointJsonOrder};
