// Publish only a locally reviewed, exact-request manifest. No source-system writes.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {neon} from '@neondatabase/serverless';
import {validateAnalysis,scriptFor,summarize} from '../../src/lib/script-adherence/contract';
import {RUBRIC_VERSION} from '../../src/lib/script-adherence/rubric';
import {canonicalShow} from '../../src/lib/script-adherence/show';
const sql=neon(process.env.DATABASE_URL!);
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const calls=JSON.parse(readFileSync('.private-adherence/pilot-calls.json','utf8'));
const manifest=JSON.parse(readFileSync('.private-adherence/reviewed-manifest.json','utf8')) as {index:number;requestId:string;reviewed:boolean}[];
if(manifest.length!==calls.length||new Set(manifest.map(x=>x.index)).size!==calls.length||manifest.some(x=>!x.reviewed))throw Error('Incomplete review manifest');
const statements=[],results=[];
for(const m of manifest){
 const c=calls[m.index];if(!c)throw Error('Unknown source');
 const account=c.source['Automation Key']?.includes('ELrPk')?'ELrPkucySZ2nxcs4fpyAaA':'nTC8wAG7SsijjSRAP3IOng';
 const uuid=c.source['Zoom Meeting UUID'],key=hash(JSON.stringify([account,uuid]));
 const rows=await sql`select * from script_adherence_requests where id=${m.requestId} and source_key=${key} and status='completed' and actual_microusd is not null`;
 if(rows.length!==1)throw Error('Unsettled or mismatched result');const row=rows[0];
 let raw=row.result;
 if(row.stage==='classify'){
  const {familyEvidence,stageEvidence,currentCallPurpose,priorPresentationEvidence,...rest}=raw;
  void familyEvidence;void stageEvidence;void currentCallPurpose;void priorPresentationEvidence;
  raw={...rest,actions:[]};if(scriptFor(raw))throw Error('Supported script needs reviewed extraction');
 }
 const result=validateAnalysis({...raw,show:canonicalShow(raw.show)},c.transcript);results.push(result);
 statements.push(sql`insert into script_adherence_calls(source_key,account_id,meeting_uuid,transcript_hash,rep,title,started_at,source_url,rubric_version,result,request_id,review_status) values (${key},${account},${uuid},${hash(c.transcript)},${c.source['Rep Name']},${c.source['Meeting Title']},${c.source['Meeting Start Date']}::timestamptz,${c.source['Meeting Transcript Link']||c.source['Meeting Link']||''},${RUBRIC_VERSION},${JSON.stringify(result)}::jsonb,${row.id},'pilot') on conflict(source_key) do update set result=excluded.result,request_id=excluded.request_id,rubric_version=excluded.rubric_version,transcript_hash=excluded.transcript_hash,review_status='pilot',updated_at=now()`);
}
if(process.argv.includes('--publish')){await sql.transaction(statements);console.log('Pilot published atomically');}
console.log({calls:results.length,summary:summarize(results)});
