import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { claimSource, reserveMissingSource, settleSource } from '@/lib/coaching-source-claim';
export const runtime='nodejs';
export const maxDuration=60;
const source=z.string().regex(/^rec[A-Za-z0-9]+$/), execution=z.string().regex(/^\d+$/);
const input=z.discriminatedUnion('action',[
 z.object({action:z.literal('reserve'),source_id:source}),
 z.object({action:z.literal('claim'),source_id:source,identity:z.string().min(1).max(500),execution_id:execution,recovery:z.boolean().default(false),previous_owner:execution.optional(),previous_status:z.enum(['error','crashed','canceled']).optional()}),
 z.object({action:z.literal('settle'),source_id:source,execution_id:execution,status:z.enum(['queued','delivered','excluded','existing_report','needs_review'])})
]);
export async function POST(request:Request) {
 const expected=process.env.INGEST_SECRET||'', supplied=request.headers.get('authorization')?.replace(/^Bearer\s+/i,'').trim()||'';
 if(!expected||Buffer.byteLength(expected)!==Buffer.byteLength(supplied)||!timingSafeEqual(Buffer.from(expected),Buffer.from(supplied)))return Response.json({error:'Unauthorized'},{status:401});
 try {
  const body=await request.text();if(body.length>4000)return Response.json({error:'Invalid request'},{status:400});
  const parsed=input.safeParse(JSON.parse(body));if(!parsed.success)return Response.json({error:'Invalid request'},{status:400});
  const p=parsed.data;
  if(p.action==='claim'&&p.previous_owner&&(!p.recovery||!p.previous_status))return Response.json({error:'Terminal execution proof required'},{status:400});
  const data=p.action==='reserve'?await reserveMissingSource(p.source_id):p.action==='settle'?await settleSource(p.source_id,p.execution_id,p.status):await claimSource(p.source_id,p.identity,p.execution_id,p.recovery,p.previous_owner);
  return Response.json(data,{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Source claim unavailable; no processing authorized'},{status:503});}
}
