import {canonicalShow} from "../../src/lib/script-adherence/show";
import {existsSync,readFileSync,writeFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {neon} from "@neondatabase/serverless";
import {z} from "zod";
import {classificationSchema,classificationPrompt,providerExtractionSchema,unpackExtraction,type Classification} from "../../src/lib/script-adherence/structured";
import {analysisPrompt,scriptFor,validateAnalysis} from "../../src/lib/script-adherence/contract";
import {RUBRICS} from "../../src/lib/script-adherence/rubric";
import {usageCost} from "../../src/lib/script-adherence/cost";
import {indexTranscript,indexedText,resolveEvidence} from "../../src/lib/script-adherence/evidence";
const sql=neon(process.env.DATABASE_URL!),dir=".private-adherence/",project="pilot-2026-11-02";
const hash=(s:string)=>createHash("sha256").update(s).digest("hex");
type Call={source:Record<string,string>;transcript:string};
const calls:Call[]=JSON.parse(readFileSync(dir+"pilot-calls.json","utf8"));
const sourceKey=(c:Call)=>hash(JSON.stringify([c.source["Automation Key"]?.includes("ELrPk")?"ELrPkucySZ2nxcs4fpyAaA":"nTC8wAG7SsijjSRAP3IOng",c.source["Zoom Meeting UUID"]]));
const text=(c:Call)=>`Title (unreliable): ${c.source["Meeting Title"]}\nRep: ${c.source["Rep Name"]}\nTRANSCRIPT:\n${c.transcript.split("Full Transcript").slice(1).join("Full Transcript").trim()}`;
const args=process.argv.slice(2),command=args[0];
if(command==="schema"){
 await sql`alter table script_adherence_requests add column if not exists stage text not null default 'combined'`;
 await sql`alter table script_adherence_requests add column if not exists validation_error text`;
 console.log("Stage metadata installed");
}else if(command==="prepare"){
 const stage=args[1];if(!["classify","extract","review"].includes(stage))throw Error("Invalid stage");
 const requests=[];
 for(const [callIndex,c] of calls.entries()){
  if(args[2]&&!args[2].split(",").map(Number).includes(callIndex))continue;
  const source=sourceKey(c);let classification:Classification|undefined;
  if(stage!=="classify"){
   const rows=await sql`select result,status from script_adherence_requests where source_key=${source} and stage='classify' order by created_at desc limit 1`;
   if(!rows.length||rows[0].status!=="completed")continue;classification=classificationSchema.parse(rows[0].result);if(!scriptFor(classification))continue;
  }
  const script=classification?scriptFor(classification):null;
  const turns=indexTranscript(c.transcript.split("Full Transcript").slice(1).join("Full Transcript"));if(!turns.length)throw Error("No indexed source evidence");
  const evidenceIds=["",...turns.map(t=>t.id)] as [string,...string[]];
  let draft:unknown=null;
  if(stage==="review"){const rows=await sql`select result,status from script_adherence_requests where source_key=${source} and stage='extract' order by created_at desc limit 1`;if(!rows.length||rows[0].status!=="completed")continue;draft=rows[0].result;}
  const system=(stage==="classify"?classificationPrompt:analysisPrompt().split("Rubrics:\n")[0]+`\nThe classification is already established: ${JSON.stringify(classification)}. Extract ONLY the supplied checklist. Do not return classification or any action from another script. Return an actions array containing each supplied action ID exactly once. Return components as an array in the stated rubric order. No omitted or extra actions or components.\n${JSON.stringify(RUBRICS[script!])}`)+"\nEVIDENCE FORMAT OVERRIDE: The transcript is indexed T0001, T0002 etc. Return ONLY one exact T-ID in familyEvidence, stageEvidence, priorPresentationEvidence, and component quote fields, not copied or paraphrased text. Choose the most decisive passage. The application resolves IDs to the original source text and timestamps. Return empty string for absent/unknown evidence; component timestamp may be empty because the application supplies it. Read all indexed passages; timestamps preserve chronology even in long recorded-video passages.";
  const reviewInstruction=stage==="review"?"\nAudit the draft against the FULL transcript, independently checking every completed, omitted and conditional component. Return the corrected full actions array. Do not merely agree. Distinguish asking/confirming from announcing/explaining, and live rep speech from recorded playback. A broad question with a substantive prospect answer can satisfy the action; literal wording is not required. Do not penalize omitted steps whose explicit trigger never happened. For conditional financial fit, if the rep actually performs the affordability check, the action is observable and applicable; otherwise apply its trigger. For video fractions, do not invent exact percentages such as .7 or .9. Use .5 as the conservative lower bound only when the content supports at least half; use 1 only when beginning/end demonstrably establish the whole distinct video. Video1 and Video2 must remain separate playback roles, never divide one pitch into both. Re-check source evidence for each claim; a relevant quote is not proof if it does not show the defined action.\n":"";
  const findings=stage==="review"&&existsSync(dir+"audit-findings.json")?JSON.parse(readFileSync(dir+"audit-findings.json","utf8"))[callIndex]||"":"";
  const outputSchema=stage==="classify"?classificationSchema.extend({familyEvidence:z.enum(evidenceIds),stageEvidence:z.enum(evidenceIds),priorPresentationEvidence:z.enum(evidenceIds)}):providerExtractionSchema(script!);
  const schema=z.toJSONSchema(outputSchema);delete schema.$schema;
  const providerSchema=JSON.parse(JSON.stringify(schema,(key,value)=>["minimum","maximum"].includes(key)?undefined:value));
  const body={model:"claude-haiku-5-5",max_tokens:16000,system:[{type:"text",text:system+reviewInstruction,cache_control:{type:"ephemeral"}}],messages:[{role:"user",content:`Title (unreliable): ${c.source["Meeting Title"]}\nRep: ${c.source["Rep Name"]}\n${indexedText(turns)}${draft?"\nDRAFT FOR INDEPENDENT AUDIT (not ground truth):\n"+JSON.stringify(draft)+"\nSOURCE-CHECKED REVIEW FINDINGS TO VERIFY AND APPLY:\n"+findings:""}`}],output_config:{effort:stage==="extract"?"low":"medium",format:{type:"json_schema",schema:providerSchema}}};
  if(Buffer.byteLength(text(c))>200000||Buffer.byteLength(system)>30000)throw Error("Input too large");
  const requestHash=hash(JSON.stringify(body)),id=hash(source+requestHash);
  const reserved=await sql`with budget as (select * from script_adherence_budget where project=${project} for update),inserted as (insert into script_adherence_requests(id,project,source_key,request_hash,model,reserved_microusd,status,stage) select ${id},${project},${source},${requestHash},'claude-haiku-5-5',200000,'reserved',${stage} from budget where committed_microusd+200000<=ceiling_microusd on conflict do nothing returning id), debited as (update script_adherence_budget set committed_microusd=committed_microusd+200000 where project=${project} and exists(select 1 from inserted) returning project) select id from inserted`;
  if(reserved.length)requests.push({id,body,classification,script});
 }
 writeFileSync(dir+"structured-requests.json",JSON.stringify({requests}),{mode:0o600});console.log({stage,prepared:requests.length});
}else if(command==="collect"){
 const results=JSON.parse(readFileSync(dir+args[1],"utf8"));
 for(const item of results){
  const rows=await sql`select * from script_adherence_requests where id=${item.id}`;if(!rows.length)throw Error("Unreserved receipt");const req=rows[0];if(req.actual_microusd!==null)continue;
  const r=item.response;if(!r.usage){await sql`update script_adherence_requests set status='held',validation_error='No usage receipt' where id=${item.id}`;continue;}
  const cost=usageCost(req.model,r.usage);if(cost>req.reserved_microusd)throw Error("Reservation exceeded");
  let parsed:unknown=null,error="";
  try{
   if(r.stop_reason!=="end_turn")throw Error("Incomplete provider output");
   parsed=JSON.parse(r.content.filter((x:{type:string})=>x.type==="text").map((x:{text:string})=>x.text).join(""));
   const c=calls.find(c=>sourceKey(c)===req.source_key)!;const turns=indexTranscript(c.transcript.split("Full Transcript").slice(1).join("Full Transcript"));
   if(req.stage==="classify"){
     const v=classificationSchema.parse(parsed);v.show=canonicalShow(v.show);v.familyEvidence=resolveEvidence(v.familyEvidence,turns).quote;v.stageEvidence=resolveEvidence(v.stageEvidence,turns).quote;v.priorPresentationEvidence=resolveEvidence(v.priorPresentationEvidence,turns).quote;if(v.currentCallPurpose==="questions_after_prior_presentation"){if(!v.priorPresentationEvidence)throw Error("Followup context requires evidence");v.stage="followup";}parsed=v;
     for(const quote of [v.familyEvidence,v.stageEvidence])if(quote&&!text(c).replace(/\s+/g," ").includes(quote.replace(/\s+/g," ")))throw Error("Classification evidence absent from source");
     if((v.family!=="unknown"&&!v.familyEvidence)||(v.stage!=="unknown"&&!v.stageEvidence))throw Error("Missing classification evidence");
   }
   else {
     const extraction=parsed as {actions:Array<{components:Array<{quote:string;timestamp:string}>}>};
     for(const action of Object.values(extraction.actions))for(const component of Object.values(action.components))Object.assign(component,resolveEvidence(component.quote,turns));
     parsed=validateAnalysis(unpackExtraction(item.script,item.classification,parsed),text(c));
   }
  }catch(e){error=e instanceof Error?e.message:"Invalid output";}
  await sql`with settled as (update script_adherence_requests set actual_microusd=${cost},status=${error?"held":"completed"},validation_error=${error||null},provider_id=${r.id??null},usage=${JSON.stringify(r.usage)}::jsonb,result=${JSON.stringify(parsed)}::jsonb,updated_at=now() where id=${item.id} and actual_microusd is null returning project,reserved_microusd) update script_adherence_budget b set committed_microusd=b.committed_microusd-s.reserved_microusd+${cost} from settled s where b.project=s.project`;
  console.log({id:item.id.slice(0,12),stage:req.stage,cost:cost/1e6,valid:!error,error});
 }
}else if(command==="reconcile-baseline"){
 // Re-price saved baseline usage after including OpenAI cache-write tokens.
 const rows=await sql`select * from script_adherence_requests where actual_microusd is not null`;
 for(const r of rows){const correct=usageCost(r.model,r.usage);if(correct!==Number(r.actual_microusd))await sql`with corrected as (update script_adherence_requests set actual_microusd=${correct} where id=${r.id} and actual_microusd=${r.actual_microusd} returning project) update script_adherence_budget set committed_microusd=committed_microusd+${correct-Number(r.actual_microusd)} where project in (select project from corrected)`;}
 console.log("Usage receipts reconciled");
}else throw Error("Use schema, prepare classify|extract|review, collect FILE, reconcile-baseline");
