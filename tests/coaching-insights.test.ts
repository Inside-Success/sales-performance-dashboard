import { describe,expect,it } from "vitest";
import { summarizeCoachingInsights,type InsightCall } from "@/lib/coaching-insights";
import { readReviewedCoaching } from "@/lib/reviewed-coaching";
const base:InsightCall={id:"1",rep_name:"Rep",rep_slug:"rep",client_name:"Buyer",call_date:null,one_line_verdict:null,what_to_improve:[],objections_surfaced:[],source_payload:{},source_id:"source",report_type:"official"};
describe("manager coaching grouping",()=>{
 it("counts each call once within a theme, not each repeated mention",()=>{const x=summarizeCoachingInsights([{...base,objections_surfaced:["Cannot afford payment; cash is unavailable","Budget remains tight"]}]);expect(x.topics.find(x=>x.key==="budget")?.calls).toHaveLength(1);expect(x.total).toBe(1)});
 it("does not count no-improvement or no-objection notes as findings",()=>{const x=summarizeCoachingInsights([{...base,what_to_improve:["No specific sales-execution improvement was supported by this call."],objections_surfaced:["No substantive objection was observed in the available transcript."]}]);expect(x.withImprovements).toBe(0);expect(x.topics).toEqual([])});
 it("keeps zero selection distinct from a data-read failure",()=>{expect(summarizeCoachingInsights([]).total).toBe(0)});
 it("rejects malformed and mismatched structured enrichment while preserving legacy readers",()=>{expect(readReviewedCoaching({reviewed_coaching_v1:{version:"future"}},"source")).toBeNull()});
});
