import { timingSafeEqual } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { databaseUrl } from '@/lib/database-connection';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {validateProgress}=require('../../../../../scripts/coaching-foundations/progress.cjs');
export const runtime='nodejs';
export async function POST(request:Request){
 const expected=process.env.INGEST_SECRET||'',supplied=request.headers.get('authorization')?.replace(/^Bearer\s+/i,'').trim()||'';
 if(!expected||Buffer.byteLength(expected)!==Buffer.byteLength(supplied)||!timingSafeEqual(Buffer.from(expected),Buffer.from(supplied)))return Response.json({error:'Unauthorized'},{status:401});
 try{
  const text=await request.text();if(Buffer.byteLength(text)>5_000_000)return Response.json({error:'Payload too large'},{status:413});
  const x=validateProgress(JSON.parse(text)),sql=neon(databaseUrl()!);
  const rows=await sql`insert into coaching_recovery_states(source_id,channel,execution_id,source_hash,status,state)
   values(${x.source_id},${x.channel},${x.execution_id},${x.source_hash},${x.status},${JSON.stringify(x.state)}::jsonb)
   on conflict(source_id,channel,execution_id) do update set status=excluded.status,state=excluded.state,updated_at=now()
   where coaching_recovery_states.source_hash=excluded.source_hash returning source_id`;
  if(rows.length!==1)throw Error('Progress conflict');
  return Response.json({ok:true,source_id:x.source_id},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Progress not saved'},{status:503});}
}
