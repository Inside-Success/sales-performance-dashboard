import { createHash, timingSafeEqual } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { z } from 'zod';
export const runtime='nodejs';
export const maxDuration=30;
const input=z.object({requests:z.array(z.object({id:z.string().regex(/^[a-f0-9]{64}$/),body:z.record(z.string(),z.unknown()),classification:z.unknown().optional(),script:z.string().nullable().optional()}).strict()).max(24)}).strict();
export async function POST(request:Request){
 const expected=process.env.INGEST_SECRET||'',supplied=request.headers.get('authorization')?.replace(/^Bearer\s+/i,'').trim()||'';
 if(!expected||Buffer.byteLength(expected)!==Buffer.byteLength(supplied)||!timingSafeEqual(Buffer.from(expected),Buffer.from(supplied)))return Response.json({error:'Unauthorized'},{status:401});
 try{
  const raw=await request.text();if(Buffer.byteLength(raw)>3_000_000)return Response.json({error:'Payload too large'},{status:413});
  const parsed=input.safeParse(JSON.parse(raw));if(!parsed.success)return Response.json({error:'Invalid request'},{status:400});
  const sql=neon(process.env.DATABASE_URL!),claimed=[];
  // Validate the entire batch before claiming any request.
  for(const {body} of parsed.data.requests){
   const cap=String(body.model).startsWith('gpt-')?body.max_completion_tokens:body.max_tokens;
   if(!['claude-haiku-5-5','gpt-6.1-terra','gpt-6-luna'].includes(String(body.model))||!Number.isInteger(cap)||Number(cap)<1||Number(cap)>16000||Buffer.byteLength(JSON.stringify(body))>260000)throw Error('Invalid bounds');
   if(String(body.model).startsWith('gpt-')&&(body.service_tier!=='default'||body.tools!==undefined||body.stream===true))throw Error('Unsupported billing configuration');
  }
  for(const item of parsed.data.requests){
   const reserve=item.body.model==='gpt-6.1-terra'?500000:200000;
   const hash=createHash('sha256').update(JSON.stringify(item.body)).digest('hex');
   // Atomic compare-and-set: duplicate/concurrent delivery never gets a second dispatch.
   // A lost response remains submitted for receipt reconciliation, never automatic replay.
   const rows=await sql`update script_adherence_requests r set status='submitted',updated_at=now() where r.id=${item.id} and r.request_hash=${hash} and r.project='pilot-2026-11-02' and r.model=${String(item.body.model)} and r.status='reserved' and r.reserved_microusd>=${reserve} and exists(select 1 from script_adherence_budget b where b.project=r.project and b.committed_microusd<=b.ceiling_microusd) returning r.id`;
   if(rows.length)claimed.push(item);
  }
  return Response.json({requests:claimed},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Dispatch held; reconcile before retry'},{status:503});}
}
