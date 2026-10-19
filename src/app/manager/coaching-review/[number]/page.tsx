import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, ChevronDown, ExternalLink } from "lucide-react";
import { getReview } from "@/lib/coaching-review/data";
import type { EvidenceBlock } from "@/lib/coaching-review/schema";

export const dynamic="force-dynamic";
export const metadata: Metadata={title:"Coaching Report Review | Magic Mike Bot",robots:{index:false,follow:false}};
const handling={handled_well:"Handled well",could_be_handled_better:"Could be handled better",not_enough_evidence:"Not enough evidence"};
const resolution={resolved:"Resolved on this call",partly_resolved:"Partly resolved",unresolved:"Still open at the end",unclear:"Resolution unclear"};
const sourceLabels={call1:"Rudy’s Master Call 1 script",call2:"Call 2 script",greenlight:"Green Light framework"};
export default async function ReviewPage({params}:{params:Promise<{number:string}>}) {
  const {number}=await params;
  const saved=await getReview(/^\d+$/.test(number)?Number(number):0);
  if(!saved)notFound();
  const {meta,report:r,evidence}=saved;
  return <main className="magic-page"><article className="mx-auto max-w-5xl space-y-6 px-5 pb-16 pt-6 sm:px-8">
    <Link href="/manager/coaching-review" className="inline-flex min-h-11 items-center gap-2 font-semibold text-slate-600 hover:text-red-700"><ArrowLeft className="size-4" aria-hidden="true"/>All ten review reports</Link>
    <header className="magic-card magic-hero p-6 md:p-8">
      <p className="magic-kicker">Review report {String(meta.number).padStart(2,"0")} of 10</p>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950">{meta.rep} · {meta.prospect}</h1>
      <p className="mt-3 leading-7 text-slate-600">{r.show} · {new Intl.DateTimeFormat("en-US",{dateStyle:"medium",timeZone:"America/New_York"}).format(new Date(meta.date))}</p>
      <p className="mt-5 text-lg font-semibold leading-8 text-slate-900">{r.summary}</p>
      <div className="mt-5 border-t border-slate-200 pt-4"><p className="text-sm font-semibold text-slate-900">Call outcome</p><p className="mt-1 leading-7 text-slate-600">{r.outcome.summary}</p><Evidence ids={r.outcome.evidence_ids} blocks={evidence}/></div>
      <Link href={`/call/${meta.call_id}`} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-red-700">Open original report <ExternalLink className="size-4" aria-hidden="true"/><span className="sr-only">(new tab)</span></Link>
    </header>
    <nav aria-label="Report sections" className="flex flex-wrap gap-2">{[["objections","Objections"],["improvements","What to improve"],["rudy","What would Rudy say?"],["strengths","What you did well"]].map(([id,label])=><a key={id} href={`#${id}`} className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:border-red-300 hover:text-red-700">{label}</a>)}</nav>
    <section id="objections" className="scroll-mt-32 space-y-4">
      <SectionTitle number="01" title="Objections and how you handled them"/>
      {r.objections.map((o,i)=><div key={i} className="magic-card p-6 md:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-medium text-slate-500">{o.category}</p><span className={`rounded-full px-3 py-1.5 text-sm font-semibold ${o.handling==="handled_well"?"bg-emerald-50 text-emerald-800":o.handling==="could_be_handled_better"?"bg-red-50 text-red-800":"bg-slate-100 text-slate-700"}`}>{handling[o.handling]}</span></div>
        <h3 className="mt-4 text-xl font-bold leading-8 text-slate-950">{o.title}</h3>
        <p className="mt-3 leading-7 text-slate-700">{o.concern}</p>
        <div className="mt-5 space-y-4 border-t border-slate-100 pt-5"><Labeled label="Your response" text={o.response}/><Labeled label="What worked or needs attention" text={o.assessment}/></div>
        {o.recommendation && <div className="mt-5 rounded-xl bg-red-50/60 p-4"><Labeled label="A better approach" text={o.recommendation}/>{o.suggested_words && <div className="mt-4"><p className="text-sm font-semibold text-slate-900">You could say</p><p className="mt-1 leading-7 text-slate-700">“{o.suggested_words}”</p></div>}</div>}
        <p className="mt-4 text-sm text-slate-500">{resolution[o.resolution]}</p>
        <Evidence ids={[...o.evidence_ids,...o.counterevidence_ids]} blocks={evidence}/>
      </div>)}
      {!r.objections.length && <div className="magic-card p-6"><h3 className="font-bold text-slate-950">No objections identified</h3><p className="mt-2 leading-7 text-slate-600">{r.no_objections_reason}</p></div>}
      {!!r.not_raised.length && <details className="group rounded-2xl border border-slate-200 bg-white"><summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 p-4 font-semibold text-slate-600 focus-visible:outline-2 focus-visible:outline-red-700 [&::-webkit-details-marker]:hidden"><span>View categories not raised ({r.not_raised.length})</span><ChevronDown className="size-5 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true"/></summary><ul className="list-disc space-y-2 px-9 pb-5 text-sm leading-6 text-slate-600">{r.not_raised.map(c=><li key={c}>{c}</li>)}</ul></details>}
    </section>
    <section id="improvements" className="scroll-mt-32 space-y-4"><SectionTitle number="02" title="What else to improve"/>
      {r.improvements.map((p,i)=><div key={i} className="magic-card space-y-4 p-6 md:p-7"><h3 className="text-xl font-bold text-slate-950">{p.title}</h3><p className="leading-7 text-slate-700">{p.observation}</p><Labeled label="Why it matters" text={p.why_it_matters}/><div className="rounded-xl bg-slate-50 p-4"><Labeled label="Next time" text={p.action}/></div><Evidence ids={[...p.evidence_ids,...p.counterevidence_ids]} blocks={evidence}/></div>)}
      {!r.improvements.length && <div className="magic-card p-6 leading-7 text-slate-600">{r.no_improvements_reason}</div>}
    </section>
    <section id="rudy" className="scroll-mt-32 space-y-4"><SectionTitle number="03" title="What would Rudy say?"/><div className="magic-card p-6 md:p-7"><p className="text-sm leading-6 text-slate-500">Coaching based on Rudy’s documented sales approach, not a quote from him.</p><h3 className="mt-4 text-xl font-bold text-slate-950">{r.rudy.title}</h3><p className="mt-3 text-lg leading-8 text-slate-800">{r.rudy.advice}</p><p className="mt-4 border-t border-slate-100 pt-4 text-sm leading-6 text-slate-500">{r.rudy.principle} · {sourceLabels[r.rudy.source_id]}</p><Evidence ids={r.rudy.evidence_ids} blocks={evidence}/></div></section>
    <section id="strengths" className="scroll-mt-32 space-y-4"><SectionTitle number="04" title="What you did well"/>
      {r.strengths.map((s,i)=><div key={i} className="magic-card p-6 md:p-7"><h3 className="text-xl font-bold text-slate-950">{s.title}</h3><p className="mt-3 leading-7 text-slate-700">{s.observation}</p><p className="mt-2 leading-7 text-slate-600">{s.why_it_matters}</p><Evidence ids={s.evidence_ids} blocks={evidence}/></div>)}
      {!r.strengths.length && <p className="magic-card p-6 text-slate-600">No distinct repeatable strength was established from this transcript.</p>}
    </section>
    <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-6">
      {meta.number>1?<Link className="inline-flex min-h-11 items-center gap-2 font-semibold text-red-700" href={`/manager/coaching-review/${meta.number-1}`}><ArrowLeft className="size-4"/>Previous report</Link>:<span/>}
      {meta.number<10?<Link className="inline-flex min-h-11 items-center gap-2 font-semibold text-red-700" href={`/manager/coaching-review/${meta.number+1}`}>Next report<ArrowRight className="size-4"/></Link>:<Link className="min-h-11 py-3 font-semibold text-red-700" href="/manager/coaching-review">Back to all reports</Link>}
    </footer>
  </article></main>;
}
function SectionTitle({number,title}:{number:string;title:string}) {return <h2 className="flex items-center gap-3 pt-3 text-2xl font-extrabold tracking-tight text-slate-950"><span className="text-sm font-bold text-red-700">{number}</span>{title}</h2>}
function Labeled({label,text}:{label:string;text:string}) {return <div><p className="text-sm font-bold text-slate-900">{label}</p><p className="mt-1 leading-7 text-slate-700">{text}</p></div>}
function Evidence({ids,blocks}:{ids:string[];blocks:EvidenceBlock[]}) {
  const selected=new Set(ids);
  return <details className="group mt-4 border-t border-slate-100"><summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 py-3 text-sm font-semibold text-red-700 focus-visible:outline-2 focus-visible:outline-red-700 [&::-webkit-details-marker]:hidden"><span>View transcript evidence</span><ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true"/></summary><div className="max-h-96 space-y-3 overflow-y-auto rounded-xl bg-slate-50 p-4">{blocks.filter(b=>selected.has(b.id)).map(b=><blockquote key={b.id} className="border-l-2 border-slate-300 pl-3 text-sm leading-7 whitespace-pre-wrap text-slate-600">{b.text}</blockquote>)}</div></details>;
}
