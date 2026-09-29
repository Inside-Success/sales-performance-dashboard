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

it("does not classify incidental time and package mentions as buyer concerns",()=>{const x=summarizeCoachingInsights([{...base,objections_surfaced:['The buyer asked about expected ROI; the rep explained the package at that time.']}]);expect(x.topics.map(x=>x.key)).toEqual(['value']);});
it("excludes explicit absence notes while preserving a different actual concern",()=>{const x=summarizeCoachingInsights([{...base,objections_surfaced:['No budget concerns. The buyer needed more time to review the agreement.']}]);expect(x.topics.some(x=>x.key==='budget')).toBe(false);expect(x.topics.map(x=>x.key)).toContain('timing');});
it("does not misclassify no supported improvement as a training need",()=>{const x=summarizeCoachingInsights([{...base,what_to_improve:['No supported improvement in answering questions or follow-up was identified.']}]);expect(x.withImprovements).toBe(0);expect(x.training).toEqual([]);});
it("retains resolved concern mentions without inventing an unresolved status",()=>{const x=summarizeCoachingInsights([{...base,objections_surfaced:['The buyer initially had a tight budget; a payment plan was agreed.']}]);expect(x.topics.map(x=>x.key)).toContain('budget');expect(x.topics[0].calls[0].evidence).toContain('was agreed');});

it("does not treat a negated funding or value objection as a positive theme",()=>{const x=summarizeCoachingInsights([{...base,objections_surfaced:['Sal wants to review the contract terms, a reasonable review request rather than a funding or value objection.']}]);expect(x.topics.map(x=>x.key)).toEqual(['terms']);});
it("recognizes team and mentor approval without mistaking partnerships for other people",()=>{const x=summarizeCoachingInsights([{...base,objections_surfaced:['Buyer needs mentor approval.']},{...base,id:'2',objections_surfaced:['Buyer wanted a 50-50 partnership.']}]);expect(x.topics.find(x=>x.key==='decision')?.calls).toHaveLength(1);});

it('does not classify speculative effects as a separate training need',()=>{const x=summarizeCoachingInsights([{...base,what_to_improve:['Follow-up date was not confirmed.','Possible effect: Questions may remain.','Better action: Confirm a time to reconnect.']}]);expect(x.training.map(x=>x.key)).toEqual(['close']);});
it('keeps uncategorized saved concerns available for inspection',()=>{const x=summarizeCoachingInsights([{...base,objections_surfaced:['Screen sharing failed.']}]);expect(x.unmatchedConcerns).toBe(1);expect(x.topics[0].key).toBe('other');expect(x.topics[0].calls[0].call.id).toBe(base.id);});

it('does not count a bare license price as an agreement question',()=>{const x=summarizeCoachingInsights([{...base,objections_surfaced:['Natalie could not afford the discussed license or initial payment.']}]);expect(x.topics.map(x=>x.key)).toEqual(['budget']);});
it('recognizes actual agreement review and payment clarification requests',()=>{const x=summarizeCoachingInsights([{...base,objections_surfaced:['Buyer wanted an attorney to review the agreement.']},{...base,id:'2',objections_surfaced:['Buyer was unsure about the payment plan.']}]);expect(x.topics.find(x=>x.key==='terms')?.calls).toHaveLength(2);});
