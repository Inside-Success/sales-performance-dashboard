"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function BackfillProgress({ status }: {status: {state:string; total:number; completed:number; excluded:number; failed:number; stalled:number; spent: string | number; budget: string | number; in_flight:number} | null}) {
  const router=useRouter();
  const refresh = !!status && status.state!=="completed";
  useEffect(()=> {
    if(!refresh) return;
    const timer=setInterval(()=>router.refresh(),30000);
    return ()=>clearInterval(timer);
  },[router,refresh]);
  if(!status) return null;
  const done=status.completed+status.excluded+status.failed;
  return <section className="magic-card p-4 text-sm" aria-label="September score update progress">
    <div className="flex flex-wrap justify-between gap-2"><strong>September score update: {done}/{status.total}</strong><span>{status.state} · {status.in_flight} active</span></div>
    <progress className="mt-2 h-3 w-full" value={done} max={status.total} />
    <p>{status.completed} scores updated · {status.excluded} ineligible · {status.failed} need review · estimated API spend ${Number(status.spent).toFixed(2)} / ${Number(status.budget).toFixed(0)} limit</p>
    {status.stalled>0 ? <p className="text-amber-800">{status.stalled} executions need reconciliation. They will not be charged again automatically.</p> : null}
    <button className="mt-2 underline" onClick={()=>router.refresh()}>Refresh progress</button>
  </section>;
}
