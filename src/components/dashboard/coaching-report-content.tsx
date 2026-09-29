import { CoachingImprovement } from "@/components/dashboard/coaching-improvement";
import { readReviewedCoaching } from "@/lib/reviewed-coaching";
import { TranscriptEvidence } from "@/components/dashboard/transcript-evidence";
import {
  coachingEvidence,
  type CoachingDisplayReport,
} from "@/lib/coaching-presentation";
import { dashboardCoachingSections, isRecentCoachingReport } from "@/lib/coaching-dashboard-sections";

type CoachingSection = ReturnType<typeof dashboardCoachingSections>[number];

export function CoachingReportContent({
  report,
  reportType,
  reportId,
  transcriptUrl,
}: {
  report: CoachingDisplayReport;
  reportType: "official" | "manual";
  reportId: string;
  transcriptUrl?: string | null;
}) {
  const source = report.source_payload;
  const sourceId = reportType === "manual" ? reportId : (source && typeof source === "object" ? String((source as Record<string, unknown>).source_airtable_record_id || "") : "");
  const reviewed = readReviewedCoaching(source, sourceId);
  const sections = reviewed ? [
    { key: "outcome", title: "Call outcome", items: [reviewed.outcome.summary + (reviewed.outcome.evidence.length ? ` [${reviewed.outcome.evidence.join(", ")}]` : "")] },
    { key: "improvements", title: "What to improve", items: reviewed.improvements.length ? reviewed.improvements.map(x => [x.title ? `Focus: ${x.title}` : "", x.observation, `Why it matters: ${x.possible_effect}`, `Next time: ${x.better_action}`, x.evidence.length ? `[${x.evidence.join(", ")}]` : ""].filter(Boolean).join("\n")) : ["No specific sales-execution improvement was supported by this call."] },
    { key: "strengths", title: "What you did well", items: reviewed.strengths.map(x=>[x.observation,x.why_useful,x.evidence.length ? `[${x.evidence.join(", ")}]` : ""].filter(Boolean).join(" ")) },
    { key: "objections", title: "Buyer concerns", items: reviewed.blockers.map(x=>x.observation + (x.evidence.length ? ` [${x.evidence.join(", ")}]` : "")) },
    { key: "next-steps", title: "Agreed next steps", items: reviewed.next_steps.map(x=>x.observation + (x.evidence.length ? ` [${x.evidence.join(", ")}]` : "")) },
  ].filter(section=>section.items.length) : dashboardCoachingSections(report);
  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <CoachingSectionCard key={section.key} section={section} reportType={reportType} reportId={reportId} transcriptUrl={transcriptUrl} recent={!!reviewed || isRecentCoachingReport(report)} />
      ))}
    </div>
  );
}

function CoachingSectionCard({ section, reportType, reportId, transcriptUrl, recent }: {
  recent: boolean;
  section: CoachingSection;
  reportType: "official" | "manual";
  reportId: string;
  transcriptUrl?: string | null;
}) {
  const isOutcome = section.key === "outcome";
  const isImprovement = section.key === "improvements";
  const noImprovement = isImprovement && section.items.length === 1 && /^No (?:specific|clear|supported)/i.test(section.items[0]);
  const grouped = isImprovement && recent && !noImprovement;

  return (
    <section
      className={`magic-card overflow-hidden p-5 md:p-7 ${isOutcome ? "border-red-100 bg-[#fffafa]" : ""}`}
      aria-label={section.title}
    >
      <div className="mb-5 flex items-center gap-3">
        <span className={`h-7 w-1 rounded-full ${isOutcome || isImprovement ? "bg-[#c43132]" : "bg-slate-300"}`} aria-hidden="true" />
        <h2 className="text-xl font-bold tracking-tight text-slate-950 md:text-2xl">{section.title}</h2>
      </div>

      <ul className={`space-y-5 ${section.items.length > 1 && !grouped ? "divide-y divide-slate-100" : ""}`}>
        {section.items.map((item, index) => {
          const { text, evidence } = coachingEvidence(item);
          return (
            <li key={`${section.key}-${index}`} className={`min-w-0 ${grouped ? "rounded-2xl border border-slate-200 bg-slate-50/40 p-4 sm:p-5" : index > 0 ? "pt-5" : ""}`}>
              <div className="flex gap-3">
                {grouped ? <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-red-50 text-sm font-bold text-red-700" aria-label={`Improvement ${index+1}`}>{index+1}</span> : section.items.length > 1 ? (
                  <span className={`mt-2 size-1.5 shrink-0 rounded-full ${isImprovement ? "bg-[#c43132]" : "bg-slate-400"}`} aria-hidden="true" />
                ) : null}
                {isImprovement ? <CoachingImprovement text={text} expanded={false /* Set true to restore always-visible explanations. */}>{grouped && evidence.length > 0 ? <TranscriptEvidence evidence={evidence} reportType={reportType} reportId={reportId} transcriptUrl={transcriptUrl} /> : null}</CoachingImprovement> : <CoachingText text={text} isClosingDetail={section.key === "close"} />}
              </div>
              {!grouped && evidence.length > 0 ? <TranscriptEvidence evidence={evidence} reportType={reportType} reportId={reportId} transcriptUrl={transcriptUrl} /> : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function CoachingText({ text, isClosingDetail }: { text: string; isClosingDetail: boolean }) {
  const lines = text.split(/\n+/).filter(Boolean);
  const firstHeadingIndex = lines.findIndex((line) => /^(Observed concerns:|Agreed next steps:)$/.test(line));
  return (
    <div className="min-w-0 flex-1 space-y-2 text-[15.5px] leading-7 text-slate-700 md:text-base">
      {lines.map((line, index) => {
        if (isClosingDetail && /^(Observed concerns:|Agreed next steps:)$/.test(line)) {
          return <h3 key={index} className="pt-1 text-sm font-semibold text-slate-900">{line}</h3>;
        }
        return <CoachingLine key={index} line={line} asBullet={isClosingDetail && firstHeadingIndex >= 0 && index > firstHeadingIndex} />;
      })}
    </div>
  );
}

function CoachingLine({ line, asBullet }: { line: string; asBullet: boolean }) {
  const note = line.match(/^(Why it matters:|Next time:)/);
  if (note) {
    return (
      <p className="rounded-lg bg-slate-50 px-3 py-2 text-[14.5px] leading-6 text-slate-600 md:text-[15px]">
        <strong className="mr-1 font-semibold text-slate-900">{note[1]}</strong>
        {line.slice(note[1].length).trimStart()}
      </p>
    );
  }

  if (/^[“"].+[”"]$/.test(line)) {
    return <blockquote className="border-l-2 border-red-200 pl-3 italic text-slate-600">{line}</blockquote>;
  }

  return <p className={asBullet ? "relative pl-5 before:absolute before:left-1 before:top-3 before:size-1.5 before:rounded-full before:bg-slate-400" : ""}>{line}</p>;
}
