import {readOperatorHealth} from '@/lib/script-adherence/health';
import {parseFilters} from "@/lib/script-adherence/filters";
import { requireRepScoringAdmin } from "@/lib/rep-scoring/access";
import { readAdherence } from "@/lib/script-adherence/data";
import { AdherenceView } from "./view";
export const dynamic="force-dynamic";
export const metadata={title:"Script Adherence | Magic Mike",robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams?:Promise<Record<string,string|string[]|undefined>>}){
  const session=await requireRepScoringAdmin();
  const raw=await searchParams??{},filters=parseFilters(raw),page=Math.max(1,Math.min(1000000,Number(raw.page)||1));
  const [data,operatorHealth]=await Promise.all([readAdherence(filters,'',Math.floor(page)).catch(()=>null),readOperatorHealth(session?.user?.email)]);
  if(!data)return <main className="magic-page"><div className="mx-auto max-w-5xl p-8"><h1 className="text-3xl font-bold">Script Adherence</h1><p role="status" className="mt-5">Results are temporarily unavailable. This does not mean there were no calls. Please try again later.</p></div></main>;
  return <AdherenceView operatorHealth={operatorHealth} {...data} key={JSON.stringify(filters)} initialFilters={filters}/>;
}
