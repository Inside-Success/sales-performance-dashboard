import { describe, it, expect } from "vitest";
import { reportSchema, validateEvidence, categories } from "../../src/lib/coaching-review/schema";
function report() {
 return {version:"objection-review-v1",show:"Example show",summary:"A focused summary.",
 outcome:{payment:"not_confirmed",summary:"No payment confirmed.",evidence_ids:["T0001"]},
 objections:[],no_objections_reason:"No resistance established.",not_raised:categories.slice(0,9),
 improvements:[],no_improvements_reason:"No additional supported improvement.",
 rudy:{title:"Connect the goal",advice:"Use the buyer's stated goal.",principle:"Personalize value.",source_id:"greenlight",evidence_ids:["T0001"]},
 strengths:[{title:"Clear next step",observation:"You confirmed the next step.",why_it_matters:"Both parties know what happens next.",evidence_ids:["T0001"]}]};
}
describe("publication contract",()=>{
 it("rejects internal IDs and unfinished reader-facing placeholders",()=>{
  expect(reportSchema.safeParse({...report(),summary:"At T0012 you asked."}).success).toBe(false);
  expect(reportSchema.safeParse({...report(),summary:"Meet at ___ Eastern."}).success).toBe(false);
 });
 it("accepts a genuine no-objection/no-improvement call",()=>expect(reportSchema.parse(report()).objections).toEqual([]));
 it("rejects unknown evidence even when JSON is valid",()=>expect(()=>validateEvidence(reportSchema.parse(report()),[])).toThrow("Unknown evidence"));
 it("rejects a category simultaneously raised and absent",()=>{
 const r={...report(),no_objections_reason:"",objections:[{category:categories[0],title:"Funding unavailable",concern:"Funds unavailable.",handling:"handled_well",resolution:"unresolved",response:"You respected the limit.",assessment:"Sound handling.",recommendation:"",suggested_words:"",evidence_ids:["T0001"],counterevidence_ids:[]}]};
 expect(reportSchema.safeParse(r).success).toBe(false);
 });
 it("does not require a sale or resolution to credit good handling",()=>{
 const r={...report(),no_objections_reason:"",not_raised:categories.slice(1,9),objections:[{category:categories[0],title:"Funding unavailable",concern:"Funds unavailable.",handling:"handled_well",resolution:"unresolved",response:"You respected the limit.",assessment:"Sound handling.",recommendation:"",suggested_words:"",evidence_ids:["T0001"],counterevidence_ids:[]}]};
 expect(reportSchema.safeParse(r).success).toBe(true);
 r.objections[0].recommendation="Push again.";expect(reportSchema.safeParse(r).success).toBe(false);
 });
 it("rejects unaccounted categories, duplicate categories and false empty-section claims",()=>{
 expect(reportSchema.safeParse({...report(),not_raised:[]}).success).toBe(false);
 expect(reportSchema.safeParse({...report(),not_raised:[...categories.slice(0,8),categories[0]]}).success).toBe(false);
 expect(reportSchema.safeParse({...report(),no_objections_reason:""}).success).toBe(false);
 });
});

