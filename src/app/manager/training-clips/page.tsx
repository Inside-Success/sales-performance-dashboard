import { neon } from "@neondatabase/serverless";
import { requireRepScoringAdmin } from "@/lib/rep-scoring/access";

type Pick = { id: string; rep: string; show: string; topic: string; moment: string[];
  date: string; duration: string; range: string };

export default async function TrainingClips({ searchParams }: {
  searchParams: Promise<{ rep?: string; clip?: string }>;
}) {
  await requireRepScoringAdmin();
  const { rep, clip } = await searchParams;
  const sql = neon(process.env.DATABASE_URL!);
  const [report] = await sql`SELECT report_date::text, picks, sheet_url FROM training_clip_reports
    ORDER BY report_date DESC LIMIT 1`;
  const picks: Pick[] = report?.picks ?? [];
  const reps = [...new Set(picks.map(p => p.rep))].sort();
  const filtered = picks.filter(p => !rep || p.rep === rep);
  // A sign-in redirect can drop the URL fragment. Keep the linked clip in view.
  const selected = filtered.find(p => p.id === clip);
  const visible = selected ? [selected, ...filtered.filter(p => p !== selected)] : filtered;
  return <main className="mx-auto max-w-4xl space-y-5 px-4 py-6">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="text-2xl font-semibold">Training Clips</h1>
        {report && <p className="text-sm text-slate-500">Call 2 · {report.report_date}</p>}</div>
      {report && <a className="underline" href={report.sheet_url}>Open companion Sheet</a>}
    </header>
    <form className="flex items-center gap-3">
      <label htmlFor="rep">Rep</label>
      <select className="rounded border p-2" name="rep" id="rep" defaultValue={rep ?? ""}>
        <option value="">All reps</option>{reps.map(r => <option key={r}>{r}</option>)}
      </select><button className="rounded border px-3 py-2">Apply</button>
    </form>
    {!filtered.length && <p>{report ? "No clips for this selection." : "No report published yet."}</p>}
    {visible.map(p => <details key={p.id} id={p.id} open={clip === p.id} className="rounded-lg border p-4">
      <summary className="cursor-pointer"><strong>{p.topic}</strong>
        <span className="mt-1 block text-sm">{p.moment[0]}</span>
        <span className="mt-1 block text-sm text-slate-500">{p.rep} · {p.show} · {p.date} · {p.duration} ({p.range})</span>
      </summary>
      <ul className="my-3 list-disc space-y-1 pl-5">{p.moment.slice(1).map((s,i) => <li key={i}>{s}</li>)}</ul>
      <video controls playsInline preload="none" className="aspect-video w-full rounded bg-black"
        aria-label={p.topic} src={`/api/training-clips/${p.id}`} />
    </details>)}
  </main>;
}
