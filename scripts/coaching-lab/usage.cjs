// Receipt accounting only; never estimates a missing provider receipt.
function openAiUsage(raw, pricing) {
  const u = raw.usage;
  if (!u) throw Error("Missing usage");
  const cache = u.prompt_tokens_details?.cached_tokens || 0;
  const write =
    u.prompt_tokens_details?.cache_write_tokens ??
    u.prompt_tokens_details?.cache_creation_tokens ??
    0;
  const input = u.prompt_tokens - cache - write;
  const output = u.completion_tokens;
  if ([input, output, cache, write].some((n) => !Number.isFinite(n) || n < 0))
    throw Error("Invalid usage");
  return {
    usage: {
      input_tokens: input,
      cache_read_input_tokens: cache,
      cache_creation_input_tokens: write,
      output_tokens: output,
    },
    costs: {
      total_cost_usd:
        (input * pricing.input_mtok +
          cache * pricing.cache_read_mtok +
          write * pricing.cache_write_mtok +
          output * pricing.output_mtok) /
        1e6,
    },
  };
}
module.exports = { openAiUsage };
