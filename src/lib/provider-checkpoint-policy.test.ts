import { describe, expect, it } from "vitest";
import { checkpointInput, retryableProviderFailure, retryDelaySeconds, validProviderResult } from "./provider-checkpoint-policy";

describe("coaching checkpoint boundaries", () => {
  it("requires exact request hashes and a supported provider", () => {
    expect(checkpointInput.safeParse({action:"claim",source_id:"recTest",stage:"classifier",provider:"anthropic",request_hash:"a".repeat(64)}).success).toBe(true);
    expect(checkpointInput.safeParse({action:"claim",source_id:"recTest",stage:"classifier",provider:"other",request_hash:"a".repeat(64)}).success).toBe(false);
    expect(checkpointInput.safeParse({action:"claim",source_id:"recTest",stage:"classifier",provider:"anthropic",request_hash:""}).success).toBe(false);
  });
  it("refuses incomplete, refused, malformed and empty provider results", () => {
    for (const result of [{ok:false,parsed_json:{}},{ok:true,parsed_json:null},{ok:true,parsed_json:{} ,parse_error:"bad JSON"},{ok:true,parsed_json:{},stop_reason:"max_tokens"}]) expect(validProviderResult(result)).toBe(false);
    expect(validProviderResult({ok:true,parsed_json:{decision:"scored"},stop_reason:"end_turn"})).toBe(true);
  });
  it("backs off transient faults without treating credentials or policy failures as retryable", () => {
    for (const error of ["524", "429 rate limit", "request timed out", "JSON parse failed"]) expect(retryableProviderFailure(error)).toBe(true);
    for (const error of ["401 Unauthorized", "unsafe report", "invalid source ID"]) expect(retryableProviderFailure(error)).toBe(false);
    expect([1,2,3,99].map(retryDelaySeconds)).toEqual([300,900,3600,3600]);
  });
});
