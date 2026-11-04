import { beforeEach, describe,it,expect,vi } from "vitest";
const mocks=vi.hoisted(()=>({access:vi.fn(),reserve:vi.fn(),run:vi.fn(),rate:vi.fn(),save:vi.fn(),ready:vi.fn()}));
vi.mock("@/auth",()=>({auth:vi.fn()}));
vi.mock("@/lib/ask-sales-faq/access",()=>({getAskSalesFaqAccess:mocks.access}));
vi.mock("@/lib/ask-sales-faq/runtime-selector",()=>({runSelectedAskSalesFaq:mocks.run,selectedAskSalesFaqRuntimeVersion:()=>"revamp"}));
vi.mock("@/lib/db",()=>({checkAskSalesFaqRateLimit:mocks.rate,completeAskSalesFaqRequest:vi.fn(),ensureAskSalesFaqStorage:mocks.ready,failAskSalesFaqRequest:vi.fn(),reserveAskSalesFaqRequest:mocks.reserve,saveAskSalesFaqDiagnostic:vi.fn(),saveAskSalesFaqExchange:mocks.save}));
import { NextRequest } from "next/server";
import { POST } from "../../src/app/api/ask-sales-faq/route";
const request=()=>new NextRequest("https://example.com/api/ask-sales-faq",{method:"POST",body:JSON.stringify({clientRequestId:"same-key",messages:[{role:"user",content:"My question"}]})});
beforeEach(()=>{vi.clearAllMocks();mocks.access.mockReturnValue({ok:true,viewerEmail:"a@example.com",viewerName:"A"});mocks.ready.mockResolvedValue(true);});
describe("existing server guard used by manual recovery",()=>{
  it("replays a saved answer without another model run, rate-limit charge or exchange write",async()=>{
    const saved={ok:true,conversationId:"original-chat",messageId:"original-answer",answer:"Saved reviewed answer",outcome:"answer_from_evidence"};
    mocks.reserve.mockResolvedValue({state:"existing",status:"completed",response:saved});
    const res=await POST(request());
    expect(await res.json()).toEqual(saved);
    expect(res.headers.get("X-Ask-Sales-FAQ-Replayed")).toBe("true");
    expect(mocks.run).not.toHaveBeenCalled();expect(mocks.rate).not.toHaveBeenCalled();expect(mocks.save).not.toHaveBeenCalled();
  });
  it("does not steal an active request",async()=>{
    mocks.reserve.mockResolvedValue({state:"existing",status:"in_progress",response:null});
    expect((await (await POST(request())).json()).outcome).toBe("duplicate_in_progress");
    expect(mocks.run).not.toHaveBeenCalled();
  });
  it("checks authentication before request storage",async()=>{
    mocks.access.mockReturnValue({ok:false,status:401,message:"Sign in",code:"auth_blocked"});
    expect((await POST(request())).status).toBe(401);
    expect(mocks.reserve).not.toHaveBeenCalled();
  });
  it("scopes the replay key to the signed-in viewer",async()=>{
    mocks.reserve.mockResolvedValue({state:"existing",status:"in_progress"});
    await POST(request());const first=mocks.reserve.mock.calls[0][0];
    mocks.access.mockReturnValue({ok:true,viewerEmail:"b@example.com"});
    await POST(request());const second=mocks.reserve.mock.calls[1][0];
    expect(second.id).not.toBe(first.id);expect(second.viewerEmail).toBe("b@example.com");
  });
});
