import type { AdherenceGroup } from "@/lib/script-adherence/data";
import type { ScriptId } from "@/lib/script-adherence/rubric";
import { LEGACY_VERSION, rubricsFor } from "@/lib/script-adherence/versions";

const count = (value: number) => value.toLocaleString("en-US");
const percent = (complete: number, total: number) =>
  total ? `${Math.round((complete / total) * 100)}%` : "—";

// Use the full filtered aggregates, never the twenty calls on the current page.
// Keep saved script versions separate: action names and requirements can change.
export function managementSummary(groups: AdherenceGroup[]) {
  return groups.map((group) => {
    const rubric = rubricsFor(group.rubricVersion)[group.id as ScriptId];
    if (!rubric) throw new Error("No matching saved script for overview");
    const version = group.rubricVersion ?? LEGACY_VERSION;
    const versionLabel = groups.some((other) => other.id === group.id &&
      (other.rubricVersion ?? LEGACY_VERSION) !== version)
      ? version === LEGACY_VERSION ? "Earlier script" : "Updated script"
      : "";
    const actions = rubric.actions.map((action) => {
      const metric = group.actions.find((item) => item.id === action.id);
      return { id: action.id, label: action.label, complete: metric?.complete ?? 0,
        missed: metric?.notComplete ?? 0 };
    });
    const complete = actions.reduce((sum, action) => sum + action.complete, 0);
    const missed = actions.reduce((sum, action) => sum + action.missed, 0);
    return { key: `${group.id}:${version}`, label: rubric.label, versionLabel,
      complete, assessed: complete + missed, actions };
  }).sort((a, b) => a.key.localeCompare(b.key));
}

export function ManagementOverview({ groups }: { groups: AdherenceGroup[] }) {
  const scripts = managementSummary(groups);
  const missed = scripts.flatMap((script) => script.actions
    .filter((action) => action.missed > 0)
    .map((action) => ({ ...action, script })))
    .sort((a, b) => b.missed - a.missed ||
      a.script.key.localeCompare(b.script.key) || a.id.localeCompare(b.id))
    .slice(0, 5);

  return <section aria-labelledby="team-overview-title" className="space-y-3">
    <div>
      <h2 id="team-overview-title" className="text-xl font-bold">Team overview</h2>
      <p className="mt-1 text-sm text-slate-600">All reps combined for the selected filters. Completion measures script actions, not the percentage of reps following the script.</p>
    </div>
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <div className="magic-card p-5">
        <h3 className="font-bold">Completion by script</h3>
        <div className="mt-3 divide-y divide-slate-200">
          {scripts.map((script) => <div key={script.key} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">{script.label}</p>
              {script.versionLabel && <p className="text-xs text-slate-500">{script.versionLabel}</p>}
              <p className="mt-1 text-sm text-slate-600">{count(script.complete)} of {count(script.assessed)} actions completed</p>
            </div>
            <p className="shrink-0 text-xl font-bold text-slate-950">{percent(script.complete, script.assessed)}</p>
          </div>)}
          {!scripts.length && <p className="py-3 text-sm text-slate-600">No assessed script actions match these filters.</p>}
        </div>
      </div>
      <div className="magic-card p-5">
        <h3 className="font-bold">Most frequently missed actions</h3>
        <p className="mt-1 text-sm text-slate-600">Up to five actions, ranked by the number of calls where they were not complete.</p>
        <ol className="mt-3 divide-y divide-slate-200">
          {missed.map(({ id, label, complete, missed: notComplete, script }) => <li key={`${script.key}:${id}`} className="py-3">
            <p className="text-sm font-semibold">{label}</p>
            <p className="mt-1 text-xs text-slate-500">{script.label}{script.versionLabel ? ` · ${script.versionLabel}` : ""}</p>
            <p className="mt-1 text-sm text-amber-900">Not complete in {count(notComplete)} of {count(complete + notComplete)} assessable calls ({percent(notComplete, complete + notComplete)})</p>
          </li>)}
        </ol>
        {!missed.length && <p className="py-3 text-sm text-slate-600">{scripts.some((script) => script.assessed > 0) ? "No incomplete actions identified." : "No assessable actions to compare yet."}</p>}
      </div>
    </div>
  </section>;
}
