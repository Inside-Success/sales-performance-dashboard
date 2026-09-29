"use client";
import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export function CoachingImprovement({ text, expanded = false, children }: { text: string; expanded?: boolean; children?: ReactNode }) {
  const [open, setOpen] = useState(expanded);
  const lines = text.split(/\n+/).filter(Boolean);
  const action = lines.find(line => /^Next time:/.test(line));
  const title = lines.find(line => /^Focus:/.test(line));
  const explanation = lines.filter(line => line !== action && line !== title);
  if (!action || !explanation.length || expanded) return <div className="space-y-3 text-base leading-7 text-slate-700">{lines.map((line,index)=><p key={index}>{line}</p>)}{children}</div>;
  return <div className="min-w-0 flex-1">
    {title ? <h3 className="mb-2 text-lg font-bold leading-7 text-slate-950">{title.replace(/^Focus:\s*/,"")}</h3> : null}
    <p className="text-base font-semibold leading-7 text-slate-900">{action.replace(/^Next time:\s*/,"")}</p>
    <details className="mt-3" open={open} onToggle={event=>setOpen(event.currentTarget.open)}>
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg px-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 [&::-webkit-details-marker]:hidden">
        {open ? "Hide explanation" : "Show explanation"}<ChevronDown aria-hidden="true" className={`size-4 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`} />
      </summary>
      <div className="mt-2 space-y-3 border-l-2 border-slate-200 pl-4 text-[15px] leading-7 text-slate-600">{explanation.map((line,index)=><p key={index}>{line}</p>)}{children}</div>
    </details>
  </div>;
}
