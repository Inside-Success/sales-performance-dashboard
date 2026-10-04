import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m=vi.hoisted(()=>({auth:vi.fn(),create:vi.fn(),update:vi.fn()}));
vi.mock("@/auth",()=>({auth:m.auth}));
vi.mock("@/lib/db",()=>({hasDatabase:()=>true,createManualFeedbackReport:m.create,updateManualFeedbackStatus:m.update}));
vi.mock("@/lib/zoom-transcript",()=>({resolveZoomTranscript:vi.fn()}));
import { POST } from "@/app/api/manual-reports/route";
const origin="https://sales-performance-dashboard-rose.vercel.app";
const request=(base=origin)=>new NextRequest(base+"/api/manual-reports",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({input_type:"transcript",rep_name:"Test",transcript_text:"x".repeat(100)})});
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv("VERCEL_ENV","production");vi.stubEnv("INGEST_SECRET","fixture-secret");m.auth.mockResolvedValue({user:{email:"test@example.com"}});m.update.mockResolvedValue({status:"processing"});});
describe("manual submission acceptance",()=>{
 it("does not dispatch unauthenticated submissions",async()=>{m.auth.mockResolvedValue(null);const fetch=vi.spyOn(globalThis,"fetch");expect((await POST(request())).status).toBe(401);expect(m.create).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled();});
 it("does not create or dispatch a localhost job",async()=>{const fetch=vi.spyOn(globalThis,"fetch");expect((await POST(request("http://localhost:3000"))).status).toBe(400);expect(m.create).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled();});
 it("authenticates dispatch and respects an already completed callback",async()=>{const fetch=vi.spyOn(globalThis,"fetch").mockResolvedValue(new Response('{"ok":true}',{status:202}));m.update.mockResolvedValue({status:"completed"});const body=await (await POST(request())).json();expect(body.status).toBe("completed");const options=fetch.mock.calls[0][1];expect(options?.headers).toMatchObject({authorization:"Bearer fixture-secret"});expect(JSON.parse(String(options?.body)).callback_url).toBe(origin+"/api/manual-reports/callback");});
 it("keeps checking after an ambiguous timeout instead of claiming generation failed",async()=>{vi.spyOn(globalThis,"fetch").mockRejectedValue(new DOMException("Timeout","TimeoutError"));expect((await (await POST(request())).json()).status).toBe("processing");expect(m.update.mock.calls[0][1]).toBe("processing");});
 it("reports a definite rejected job without starting another one",async()=>{vi.spyOn(globalThis,"fetch").mockResolvedValue(new Response('{}',{status:400}));expect((await (await POST(request())).json()).status).toBe("failed");expect(m.create).toHaveBeenCalledTimes(1);});
});
