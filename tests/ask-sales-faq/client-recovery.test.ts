import { describe, it, expect, vi } from "vitest";
import { recoveryAfterResponse, requestFaqAnswer, type RecoveryRequest } from "../../src/lib/ask-sales-faq/client-recovery";
const request: RecoveryRequest = { conversationId: null, clientRequestId: "original", messages: [{role:"user",content:"What are the rules?"},{role:"assistant",content:"Which show?"},{role:"user",content:"Daymond John"}] };
const reply = (outcome = "answer_from_evidence") => ({ok:true,conversationId:"saved-chat",messageId:"saved-answer",answer:"Reviewed answer",outcome});
describe("manual FAQ recovery", () => {
  it("resends the exact request after lost transport and accepts the saved answer", async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new TypeError("network")).mockResolvedValueOnce(new Response(JSON.stringify(reply())));
    await expect(requestFaqAnswer(request,fetcher)).rejects.toThrow();
    expect(await requestFaqAnswer(request,fetcher)).toMatchObject(reply());
    const bodies=fetcher.mock.calls.map(c=>JSON.parse(c[1].body));
    expect(bodies).toEqual([request,request]);
    expect(bodies[1].messages).toHaveLength(3);
  });
  it("keeps the same key while the original is working and never automatically loops", async () => {
    const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify(reply("duplicate_in_progress"))));
    const answer=await requestFaqAnswer(request,fetcher);
    const newId=vi.fn(()=>"new");
    expect(recoveryAfterResponse(request,answer,newId)).toBe(request);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(newId).not.toHaveBeenCalled();
  });
  it("only creates a fresh attempt after a confirmed failed response, retaining original context", () => {
    expect(recoveryAfterResponse(request,{outcome:"safe_fallback",conversationId:"saved-chat"},()=>"new")).toEqual({...request,conversationId:"saved-chat",clientRequestId:"new"});
    expect(request.clientRequestId).toBe("original");
  });
  it.each(["answer_from_evidence","low_confidence_route","route_from_evidence","rate_limited","validation_error","auth_blocked","feature_disabled"])("does not offer regeneration for %s", outcome => {
    expect(recoveryAfterResponse(request,{outcome,conversationId:"saved"} as Parameters<typeof recoveryAfterResponse>[1],()=>"new")).toBeNull();
  });
  it("does not regard malformed or HTTP failure responses as completed", async () => {
    for (const response of [new Response("not json"),new Response(JSON.stringify({ok:true})),new Response(JSON.stringify(reply()),{status:503})]) {
      await expect(requestFaqAnswer(request,vi.fn().mockResolvedValue(response))).rejects.toThrow();
    }
  });
});
