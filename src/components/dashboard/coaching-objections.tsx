import { OBJECTION_CATEGORIES } from "@/lib/objection-coaching.cjs";

export type CoachingObjection = {
  id: string;
  title: string;
  category: string;
  exchange?: string;
  concern: string;
  response: string;
  handling: "sound" | "needs_work" | "uncertain";
  resolution: "resolved" | "partly_resolved" | "unresolved" | "unclear";
  assessment: string;
  teaching: string;
  example: string;
};

const handlingLabels = {
  sound: "Handled well",
  needs_work: "Could improve",
  uncertain: "Not enough evidence",
};
const resolutionLabels = {
  resolved: "Resolved",
  partly_resolved: "Partly resolved",
  unresolved: "Unresolved",
  unclear: "Unclear",
};

// Display only: callers supply the source-bound, validated and safety-reviewed record.
// Never reconstruct categories or assessment boundaries from generated prose.
export function CoachingObjections({ objections, focusId, compact = false, numbered = false }: {
  objections: CoachingObjection[];
  focusId: string;
  compact?: boolean;
  numbered?: boolean;
}) {
  if (compact) return (
    <section className="magic-card min-w-0 p-5 md:p-7" aria-label="Objections and how you handled them">
      <h2 className="mb-5 text-xl font-bold tracking-tight text-slate-950 md:text-2xl">Objections and how you handled them</h2>
      <ul className="divide-y divide-slate-200">
        {objections.map((o, i) => <li key={o.id} className={`space-y-3 break-words py-5 ${i === 0 ? "pt-0" : ""}`}>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-slate-950">{numbered ? `${i+1}. ` : ""}{o.title}</h3>
            <p className="text-sm font-medium text-slate-600">{OBJECTION_CATEGORIES[o.category]}</p>
          </div>
          <p className="whitespace-pre-line text-base leading-7 text-slate-700">{o.exchange}</p>
          {o.handling === "sound" ? <p className="text-base italic leading-7 text-slate-600">Handled well—no further feedback.</p> :
            numbered ? <div className="space-y-2 border-l-2 border-red-200 pl-4 text-base leading-7 text-slate-700">
              <p><strong className="text-slate-950">{o.handling === "needs_work" ? "Improvement: " : "Assessment: "}</strong>{o.assessment}</p>
              {o.teaching ? <p>{o.teaching}</p> : null}
              {o.example ? <p><strong className="text-slate-950">For example: </strong>{o.example}</p> : null}
            </div> : <p className="border-l-2 border-red-200 pl-4 text-base leading-7 text-slate-700"><strong className="text-slate-950">{o.handling === "needs_work" ? "Improvement: " : "Assessment: "}</strong>{[o.assessment, o.teaching, o.example ? `For example: ${o.example}` : ""].filter(Boolean).join(" ")}</p>}
        </li>)}
      </ul>
    </section>
  );
  return (
    <section className="magic-card min-w-0 p-5 md:p-7" aria-label="Objections and how you handled them">
      <div className="mb-5 flex items-center gap-3">
        <span className="h-7 w-1 shrink-0 rounded-full bg-slate-300" aria-hidden="true" />
        <h2 className="text-xl font-bold tracking-tight text-slate-950 md:text-2xl">Objections and how you handled them</h2>
      </div>
      <ul className="space-y-6 divide-y divide-slate-200">
        {objections.map((objection, index) => (
          <li key={objection.id} className={`min-w-0 space-y-4 break-words ${index ? "pt-6" : ""}`}>
            <div className="space-y-2">
              {objection.id === focusId ? <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Main takeaway</p> : null}
              <h3 className="text-lg font-semibold text-slate-950">{objection.title}</h3>
              <dl className="flex flex-wrap gap-x-4 gap-y-2 text-sm leading-6 text-slate-600">
                <div><dt className="inline font-medium text-slate-900">Category: </dt><dd className="inline">{OBJECTION_CATEGORIES[objection.category]}</dd></div>
                <div><dt className="inline font-medium text-slate-900">Handling: </dt><dd className="inline">{handlingLabels[objection.handling]}</dd></div>
                <div><dt className="inline font-medium text-slate-900">Resolution: </dt><dd className="inline">{resolutionLabels[objection.resolution]}</dd></div>
              </dl>
            </div>
            <dl className="space-y-4 text-base leading-7 text-slate-700">
              <div className="space-y-3 rounded-xl bg-slate-50 p-4">
                <div><dt className="font-semibold text-slate-900">Buyer’s concern</dt><dd className="mt-1 whitespace-pre-line">{objection.concern}</dd></div>
                <div><dt className="font-semibold text-slate-900">Your response</dt><dd className="mt-1 whitespace-pre-line">{objection.response}</dd></div>
              </div>
              <div><dt className="font-semibold text-slate-900">How you handled it</dt><dd className="mt-1 whitespace-pre-line">{objection.assessment}</dd></div>
              {objection.teaching ? <div className="border-l-2 border-red-200 pl-4"><dt className="font-semibold text-slate-900">Take into your next call</dt><dd className="mt-1 whitespace-pre-line">{objection.teaching}</dd></div> : null}
              {objection.example ? <div><dt className="font-semibold text-slate-900">Example wording</dt><dd className="mt-1 whitespace-pre-line">{objection.example}</dd></div> : null}
            </dl>
          </li>
        ))}
      </ul>
    </section>
  );
}
