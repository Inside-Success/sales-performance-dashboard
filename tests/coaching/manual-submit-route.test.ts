import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { BRANDED_MAGIC_MIKE_ORIGIN } from "@/lib/magic-mike-origin";
const m=vi.hoisted(()=>({auth:vi.fn(),create:vi.fn(),update:vi.fn(),zoom:vi.fn(),archive:vi.fn()}));
vi.mock("@/auth",()=>({auth:m.auth}));
vi.mock("@/lib/db",()=>({hasDatabase:()=>true,createManualFeedbackReport:m.create,updateManualFeedbackStatus:m.update}));
vi.mock("@/lib/zoom-transcript",()=>({resolveZoomTranscript:m.zoom}));
vi.mock("@/lib/manual-transcript-archive",()=>({resolveManualArchivedTranscript:m.archive}));
import { POST } from "@/app/api/manual-reports/route";
const origin="https://sales-performance-dashboard-rose.vercel.app";
const request=(base=origin)=>new NextRequest(base+"/api/manual-reports",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({input_type:"transcript",rep_name:"Test",transcript_text:"x".repeat(100)})});
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv("VERCEL_ENV","production");vi.stubEnv("INGEST_SECRET","fixture-secret");m.auth.mockResolvedValue({user:{email:"test@example.com"}});m.update.mockResolvedValue({status:"processing"});});
describe("manual submission acceptance",()=>{
 it("does not dispatch unauthenticated submissions",async()=>{m.auth.mockResolvedValue(null);const fetch=vi.spyOn(globalThis,"fetch");expect((await POST(request())).status).toBe(401);expect(m.create).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled();});
 it("does not create or dispatch a localhost job",async()=>{const fetch=vi.spyOn(globalThis,"fetch");expect((await POST(request("http://localhost:3000"))).status).toBe(400);expect(m.create).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled();});
 it.each([origin, BRANDED_MAGIC_MIKE_ORIGIN])("dispatches from %s and respects an already completed callback",async(base)=>{const fetch=vi.spyOn(globalThis,"fetch").mockResolvedValue(new Response('{"ok":true}',{status:202}));m.update.mockResolvedValue({status:"completed"});const body=await (await POST(request(base))).json();expect(body.status).toBe("completed");const options=fetch.mock.calls[0][1];expect(options?.headers).toMatchObject({authorization:"Bearer fixture-secret"});const payload=JSON.parse(String(options?.body));expect(payload.callback_url).toBe(origin+"/api/manual-reports/callback");expect(payload.report_url).toBe(origin+"/self-report/"+payload.public_id);});
 it("uses the authenticated email for archive ownership and dispatches the full transcript", async()=>{
  const recording={owner:"Rep",title:"Casting Follow-up",startedAt:"2026-11-17T18:58:25.000Z"};
  const transcript="[00:00:24.001] Buyer: " + "Could I use the footage with my team after release? ".repeat(4);
  m.archive.mockResolvedValue(transcript);
  m.zoom.mockImplementation(async (_link,archive)=>({transcriptText:await archive(recording),transcriptUrl:null,fileId:"fixture"}));
  const fetch=vi.spyOn(globalThis,"fetch").mockResolvedValue(new Response("{}",{status:202}));
  const res=await POST(new NextRequest(origin+"/api/manual-reports",{method:"POST",body:JSON.stringify({
   input_type:"zoom_link",zoom_link:"https://zoom.us/rec/share/fixture",rep_name:"Rep",rep_email:"form-value@example.com",
  })}));
  expect(res.status).toBe(200);
  expect(m.archive).toHaveBeenCalledExactlyOnceWith(recording,"test@example.com");
  expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toMatchObject({input_type:"zoom_link",transcript_text:transcript});
 });
 it("keeps checking after an ambiguous timeout instead of claiming generation failed",async()=>{vi.spyOn(globalThis,"fetch").mockRejectedValue(new DOMException("Timeout","TimeoutError"));expect((await (await POST(request())).json()).status).toBe("processing");expect(m.update.mock.calls[0][1]).toBe("processing");});
 it("reports a definite rejected job without starting another one",async()=>{vi.spyOn(globalThis,"fetch").mockResolvedValue(new Response('{}',{status:400}));expect((await (await POST(request())).json()).status).toBe("failed");expect(m.create).toHaveBeenCalledTimes(1);});
});
