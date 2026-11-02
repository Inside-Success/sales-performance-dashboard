import {resolveRep} from '@/lib/script-adherence/rep-route';
import {notFound} from 'next/navigation';
import {requireRepScoringAdmin} from '@/lib/rep-scoring/access';
import {readAdherence,readRepNames} from '@/lib/script-adherence/data';
import {AdherenceView} from '../../view';
import {parseFilters} from '@/lib/script-adherence/filters';
export const dynamic='force-dynamic';
export const metadata={title:'Rep Script Adherence | Magic Mike',robots:{index:false,follow:false}};
export default async function RepPage({params,searchParams}:{params:Promise<{rep:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
 await requireRepScoringAdmin();
 const {rep:segment}=await params;
 const names=await readRepNames(),rep=resolveRep(segment,names);if(!rep)notFound();
 const raw=await searchParams,filters=parseFilters(raw),page=Math.floor(Math.max(1,Math.min(1000000,Number(raw.page)||1)));
 const data=await readAdherence(filters,rep,page).catch(()=>null);
 if(!data)return <main className="magic-page p-8"><h1 className="text-2xl font-bold">Rep results unavailable</h1><p role="status" className="mt-4">Please try again later. No saved results have been removed.</p></main>;
 return <AdherenceView {...data} repName={rep} key={JSON.stringify(filters)} initialFilters={filters}/>;
}
