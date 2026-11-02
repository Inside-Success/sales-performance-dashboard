import "server-only";
import { neon } from "@neondatabase/serverless";
import { resultSchema, type Analysis } from "./contract";
export type AdherenceCall={sourceKey:string;rep:string;title:string;startedAt:string;sourceUrl:string;reviewStatus:string;result:Analysis};
export async function readAdherence():Promise<{calls:AdherenceCall[];updatedAt:string|null;pilot:boolean;limited:boolean}> {
  if(!process.env.DATABASE_URL) throw Error("Adherence data unavailable");
  const sql=neon(process.env.DATABASE_URL);
  // Read only: schema is installed explicitly by the pilot runner, never on page load.
  const rows=await sql`select source_key,rep,title,started_at::text,source_url,review_status,result,updated_at::text from script_adherence_calls order by started_at desc limit 2001`;
  return {limited:rows.length>2000,calls:rows.slice(0,2000).map(r=>({sourceKey:r.source_key,rep:r.rep,title:r.title,startedAt:r.started_at,sourceUrl:r.source_url,reviewStatus:r.review_status,result:resultSchema.parse(r.result)})),updatedAt:rows.map(r=>r.updated_at as string).sort().at(-1)??null,pilot:rows.some(r=>r.review_status==="pilot")};
}
