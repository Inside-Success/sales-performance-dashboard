import {readFileSync,writeFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {neon} from "@neondatabase/serverless";
import {analysisPrompt,validateAnalysis} from "../../src/lib/script-adherence/contract";
import {RUBRIC_VERSION} from "../../src/lib/script-adherence/rubric";
import {usageCost} from "../../src/lib/script-adherence/cost";
const sql=neon(process.env.DATABASE_URL!);
const hash=(s:string)=>createHash("sha256").update(s).digest("hex");
const project="pilot-2026-11-02";
const dir=".private-adherence/";
type Call={source:Record<string,string>;transcript:string};
const calls:Call[]=JSON.parse(readFileSync(dir+"pilot-calls.json","utf8"));
const prompt=analysisPrompt();
function payload(c:Call){const text=c.transcript.split("Full Transcript").slice(1).join("Full Transcript").trim();return `Title (unreliable): ${c.source["Meeting Title"]}\nRep: ${c.source["Rep Name"]}\nTRANSCRIPT:\n${text}`;}
const args=process.argv.slice(2), command=args[0];
if(command==="schema"){
  for(const statement of readFileSync("scripts/script-adherence/schema.sql","utf8").split(";").filter(x=>x.trim()))await sql.query(statement);
  console.log("Isolated adherence schema installed");
}else if(command==="prepare"){
  const index=Number(args[1]??0),count=Number(args[2]??1);if(!Number.isInteger(index)||!Number.isInteger(count)||count<1||count>10)throw Error("Invalid pilot range");
  const requests=[];
  for(const c of calls.slice(index,index+count)){
    const text=payload(c);if(Buffer.byteLength(text)>200000||Buffer.byteLength(prompt)>30000)throw Error("Pilot input too large; do not truncate");
    const sourceKey=hash(JSON.stringify([c.source["Automation Key"]?.includes("ELrPk")?"ELrPkucySZ2nxcs4fpyAaA":"nTC8wAG7SsijjSRAP3IOng",c.source["Zoom Meeting UUID"]]));
    for(const model of ["gpt-6-luna","claude-haiku-5-5"]){
      const requestHash=hash(JSON.stringify([prompt,text,model,RUBRIC_VERSION,"low-effort-2026-11-02"]));const id=hash(sourceKey+requestHash);
      // A conservative $0.20 reservation per bounded request exceeds its maximum
      // input/output charge even under Haiku's long-context tier. Never retry an
      // ambiguous submission automatically. Unique id + row lock serialize spend.
      const reserved=await sql`with budget as (select * from script_adherence_budget where project=${project} for update),
        inserted as (insert into script_adherence_requests(id,project,source_key,request_hash,model,reserved_microusd,status)
          select ${id},${project},${sourceKey},${requestHash},${model},200000,'reserved' from budget
          where committed_microusd+200000<=ceiling_microusd on conflict do nothing returning id),
        debited as (update script_adherence_budget set committed_microusd=committed_microusd+200000 where project=${project} and exists(select 1 from inserted) returning project)
        select id from inserted`;
      if(!reserved.length){console.log("Skipped existing or budget-blocked request",id.slice(0,12));continue;}
      requests.push({id,sourceKey,model,system:prompt,text});
    }
  }
  writeFileSync(dir+"requests.json",JSON.stringify({requests}),{mode:0o600}); console.log({prepared:requests.length});
}else if(command==="mark-submitted"){
  const {requests}=JSON.parse(readFileSync(dir+"requests.json","utf8"));
  for(const r of requests)await sql`update script_adherence_requests set status='submitted',updated_at=now() where id=${r.id} and status='reserved'`;
  console.log({submitted:requests.length});
}else if(command==="collect"){
  const results=JSON.parse(readFileSync(dir+args[1],"utf8"));
  for(const item of results){
    const request=await sql`select * from script_adherence_requests where id=${item.id}`;
    if(!request.length)throw Error("Unreserved result"); const req=request[0];if(req.actual_microusd!==null)continue;
    const raw=item.response;
    const usage=raw.usage;if(!usage){await sql`update script_adherence_requests set status='held' where id=${item.id}`;console.log({id:item.id.slice(0,12),status:"held: no usage receipt"});continue;}
    const isOpenAI=req.model==="gpt-6-luna";
    const cost=usageCost(req.model,usage);
    if(!Number.isFinite(cost)||cost<0||cost>req.reserved_microusd)throw Error("Unexpected usage; reservation retained");
    let parsed:unknown=null,valid=false,error="";
    try{
      const content=isOpenAI?raw.choices?.[0]?.message?.content:raw.content?.filter((x:{type:string})=>x.type==="text").map((x:{text:string})=>x.text).join("");
      if(isOpenAI?raw.choices?.[0]?.finish_reason!=="stop":raw.stop_reason!=="end_turn")throw Error("Incomplete provider output");
      parsed=JSON.parse(content.replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,""));
      const c=calls.find(c=>hash(JSON.stringify([c.source["Automation Key"]?.includes("ELrPk")?"ELrPkucySZ2nxcs4fpyAaA":"nTC8wAG7SsijjSRAP3IOng",c.source["Zoom Meeting UUID"]]))===req.source_key)!;
      validateAnalysis(parsed,payload(c));valid=true;
    }catch(e){error=e instanceof Error?e.message:"Invalid result";}
    await sql`with settled as (update script_adherence_requests set actual_microusd=${cost},status=${valid?"completed":"held"},provider_id=${raw.id??null},usage=${JSON.stringify(usage)}::jsonb,result=${JSON.stringify(parsed)}::jsonb,updated_at=now() where id=${item.id} and actual_microusd is null returning project,reserved_microusd)
      update script_adherence_budget b set committed_microusd=b.committed_microusd-s.reserved_microusd+${cost} from settled s where b.project=s.project`;
    console.log({id:item.id.slice(0,12),model:req.model,cost:cost/1e6,valid,error});
  }
}else if(command==="status"){
  console.log(await sql`select model,status,count(*)::int,sum(actual_microusd)::text as actual_microusd from script_adherence_requests group by model,status`);
  console.log(await sql`select * from script_adherence_budget where project=${project}`);
}else throw Error("Use schema, prepare, mark-submitted, collect, status");
