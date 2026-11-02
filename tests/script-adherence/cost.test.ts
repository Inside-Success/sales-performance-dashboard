import {it,expect} from "vitest";
import {usageCost} from "../../src/lib/script-adherence/cost";
it("accounts for OpenAI cache writes and reasoning in total output",()=>expect(usageCost("gpt-6-luna",{prompt_tokens:8370,completion_tokens:1855,prompt_tokens_details:{cached_tokens:0,cache_write_tokens:8367}})).toBe(1974));
it("accounts for Anthropic's separately reported cache writes",()=>expect(usageCost("claude-haiku-5-5",{input_tokens:7551,cache_creation_input_tokens:5027,output_tokens:10000})).toBe(6384));
it("charges higher Haiku tier for whole long prompt",()=>expect(usageCost("claude-haiku-5-5",{input_tokens:100001,output_tokens:1000})).toBe(52501));
it("refuses incomplete billing receipts",()=>expect(()=>usageCost("gpt-6-luna",{})).toThrow());
it("refuses unpriced models",()=>expect(()=>usageCost("other",{})).toThrow());
