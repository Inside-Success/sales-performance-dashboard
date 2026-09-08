import { coachingSections, coachingEvidence, type CoachingDisplayReport } from '@/lib/coaching-presentation';

export function CoachingReportContent({report}: {report:CoachingDisplayReport}) {
 return <>{coachingSections(report).map(section=><section key={section.key} className={`magic-card p-5 md:p-6 ${section.key==='outcome'?'border-red-100 bg-[#FEF2F2]/80':''}`}>
  <h2 className="mb-4 text-lg font-extrabold text-slate-950">{section.title}</h2>
  <div className="space-y-5">{section.items.map((item,i)=>{
   const {text,evidence}=coachingEvidence(item);
   return <div key={i} className={i?'border-t border-slate-100 pt-5':''}>
    <div className="space-y-2 text-base leading-7 text-slate-700">{text.split(/\n+/).filter(Boolean).map((line,j)=>{const label=line.match(/^(Why it matters:|Next time:)/);return <p key={j}>{label?<><strong className="font-semibold text-slate-900">{label[1]}</strong>{line.slice(label[1].length)}</>:line}</p>;})}</div>
    {evidence.length>0?<details className="mt-2 text-sm text-slate-500"><summary className="cursor-pointer">Transcript evidence</summary><p className="mt-1 font-mono">{evidence.join(' · ')}</p></details>:null}
   </div>;
  })}</div>
 </section>)}</>;
}
