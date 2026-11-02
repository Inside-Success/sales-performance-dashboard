// Standard global endpoint rates verified 2026-11-02. MicroUSD avoids floating
// budget totals. Output counts already include reasoning; never add it twice.
export function usageCost(model:string,usage:Record<string,unknown>){
  const oa=model==="gpt-6-luna";if(!oa&&model!=="claude-haiku-5-5")throw Error("Unpriced model");
  const details=(usage.prompt_tokens_details??{}) as Record<string,number>;
  const input=Number(oa?usage.prompt_tokens:usage.input_tokens),output=Number(oa?usage.completion_tokens:usage.output_tokens);
  const cached=Number(oa?(details.cached_tokens??0):(usage.cache_read_input_tokens??0));
  const writes=Number(oa?(details.cache_write_tokens??0):(usage.cache_creation_input_tokens??0));
  if([input,output,cached,writes].some(x=>!Number.isInteger(x)||x<0))throw Error("Invalid usage");
  if(oa&&cached+writes>input)throw Error("Overlapping usage accounting");
  const long=!oa&&input+cached+writes>100000;const rate=long?.5:.1;
  return Math.ceil((oa?input-cached-writes:input)*rate+cached*rate*.1+writes*rate*1.25+output*(long?2.5:.5));
}
