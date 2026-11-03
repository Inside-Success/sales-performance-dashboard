import {timingSafeEqual} from 'node:crypto';
import {runProviderBatch,recordSchedulerFailure} from '@/lib/script-adherence/provider-batch';
export const runtime='nodejs';
export const maxDuration=180;
export async function POST(request:Request){
 const expected=process.env.INGEST_SECRET||'',supplied=request.headers.get('authorization')?.replace(/^Bearer\s+/i,'').trim()||'';
 if(!expected||Buffer.byteLength(expected)!==Buffer.byteLength(supplied)||!timingSafeEqual(Buffer.from(expected),Buffer.from(supplied)))return Response.json({error:'Unauthorized'},{status:401});
 try{const body=await request.json().catch(()=>({}));if(body?.event==='scheduler_error'){await recordSchedulerFailure();return Response.json({recorded:true});}return Response.json(await runProviderBatch(),{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'Batch step retained for recovery; inspect operator status'},{status:503});}
}
