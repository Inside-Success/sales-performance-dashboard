import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { coachingCoverage,observeCoachingSource } from '@/lib/coaching-coverage';
export const runtime='nodejs';
export const maxDuration=60;
const input=z.discriminatedUnion('action',[
  z.object({action:z.literal('scan')}),
  z.object({action:z.literal('observe'),source_id:z.string().regex(/^rec[A-Za-z0-9]+$/),execution_id:z.string().regex(/^\d+$/)}),
  z.object({action:z.literal('ack'),token:z.string().uuid(),missing_ids:z.array(z.string().regex(/^rec[A-Za-z0-9]+$/)).max(5000).default([]),notified_ids:z.array(z.string().regex(/^rec[A-Za-z0-9]+$/)).max(5000).optional()}),
]);
export async function POST(request:Request) {
  const expected=process.env.INGEST_SECRET;
  const supplied=request.headers.get('authorization')?.replace(/^Bearer\s+/i,'').trim()||'';
  if(!expected||Buffer.byteLength(expected)!==Buffer.byteLength(supplied)||!timingSafeEqual(Buffer.from(expected),Buffer.from(supplied))) return Response.json({error:'Unauthorized'},{status:401});
  try {
    const raw=await request.text();
    if(raw.length>180000) return Response.json({error:'Invalid request'},{status:400});
    const parsed=input.safeParse(JSON.parse(raw));
    if(!parsed.success) return Response.json({error:'Invalid request'},{status:400});
    const data=parsed.data;
    return Response.json(data.action==='observe'?await observeCoachingSource(data.source_id,data.execution_id):await coachingCoverage(data.action,'token' in data?data.token:undefined,'missing_ids' in data?data.missing_ids:[],'notified_ids' in data?data.notified_ids:undefined),{headers:{'Cache-Control':'no-store'}});
  } catch {return Response.json({error:'Coverage source unavailable; cursor retained'},{status:503});}
}
