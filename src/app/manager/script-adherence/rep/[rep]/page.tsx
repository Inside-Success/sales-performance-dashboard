import {resolveRep} from '@/lib/script-adherence/rep-route';
import {notFound} from 'next/navigation';
import {requireRepScoringAdmin} from '@/lib/rep-scoring/access';
import {readAdherence} from '@/lib/script-adherence/data';
import {AdherenceView} from '../../view';
import {parseFilters} from '@/lib/script-adherence/filters';
export const dynamic='force-dynamic';
export const metadata={title:'Rep Script Adherence | Magic Mike',robots:{index:false,follow:false}};
export default async function RepPage({params,searchParams}:{params:Promise<{rep:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
 await requireRepScoringAdmin();
 const {rep:segment}=await params;
 const data=await readAdherence().catch(()=>null);
 if(!data)return <main className="magic-page p-8"><h1 className="text-2xl font-bold">Rep results unavailable</h1><p role="status" className="mt-4">Please try again later. No saved results have been removed.</p></main>;
 const rep=resolveRep(segment,data.calls.map(c=>c.rep));
 if(!rep)notFound();
 return <AdherenceView {...data} repName={rep} initialFilters={parseFilters(await searchParams)}/>;
}
