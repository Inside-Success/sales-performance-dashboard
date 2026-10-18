import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { coachingCoverage } from '@/lib/coaching-coverage';
export const runtime='nodejs';
export const maxDuration=60;
const input=z.discriminatedUnion('action',[
  z.object({action:z.literal('scan')}),
  z.object({action:z.literal('ack'),token:z.string().uuid(),missing_ids:z.array(z.string().regex(/^rec[A-Za-z0-9]+$/)).max(500).default([])}),
]);
export async function POST(request:Request) {
  const expected=process.env.INGEST_SECRET;
  const supplied=request.headers.get('authorization')?.replace(/^Bearer\s+/i,'').trim()||'';
  if(!expected||Buffer.byteLength(expected)!==Buffer.byteLength(supplied)||!timingSafeEqual(Buffer.from(expected),Buffer.from(supplied))) return Response.json({error:'Unauthorized'},{status:401});
  try {
    const raw=await request.text();
    if(raw.length>30000) return Response.json({error:'Invalid request'},{status:400});
    const parsed=input.safeParse(JSON.parse(raw));
    if(!parsed.success) return Response.json({error:'Invalid request'},{status:400});
    return Response.json(await coachingCoverage(parsed.data.action,'token' in parsed.data?parsed.data.token:undefined,'missing_ids' in parsed.data?parsed.data.missing_ids:[]),{headers:{'Cache-Control':'no-store'}});
  } catch {return Response.json({error:'Coverage source unavailable; cursor retained'},{status:503});}
}
