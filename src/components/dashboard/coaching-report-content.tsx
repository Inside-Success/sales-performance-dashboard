import { ExternalLink } from "lucide-react";
import {
  coachingSections,
  coachingEvidence,
  formatCoachingTimestamp,
  type CoachingDisplayReport,
} from "@/lib/coaching-presentation";

type CoachingSection = ReturnType<typeof coachingSections>[number];

export function CoachingReportContent({
  report,
  recordingUrl,
}: {
  report: CoachingDisplayReport;
  recordingUrl?: string | null;
}) {
  return (
    <div className="space-y-4">
      {coachingSections(report).map((section) => (
        <CoachingSectionCard key={section.key} section={section} recordingUrl={recordingUrl} />
      ))}
    </div>
  );
}

function CoachingSectionCard({ section, recordingUrl }: { section: CoachingSection; recordingUrl?: string | null }) {
  const isOutcome = section.key === "outcome";
  const isImprovement = section.key === "improvements";

  return (
    <section
      className={`magic-card overflow-hidden p-5 md:p-7 ${isOutcome ? "border-red-100 bg-[#fffafa]" : ""}`}
      aria-label={section.title}
    >
      <div className="mb-5 flex items-center gap-3">
        <span className={`h-7 w-1 rounded-full ${isOutcome || isImprovement ? "bg-[#c43132]" : "bg-slate-300"}`} aria-hidden="true" />
        <h2 className="text-xl font-bold tracking-tight text-slate-950 md:text-2xl">{section.title}</h2>
      </div>

      <ul className={`space-y-5 ${section.items.length > 1 ? "divide-y divide-slate-100" : ""}`}>
        {section.items.map((item, index) => {
          const { text, evidence } = coachingEvidence(item);
          return (
            <li key={`${section.key}-${index}`} className={`min-w-0 ${index > 0 ? "pt-5" : ""}`}>
              <div className="flex gap-3">
                {section.items.length > 1 ? (
                  <span className={`mt-2 size-1.5 shrink-0 rounded-full ${isImprovement ? "bg-[#c43132]" : "bg-slate-400"}`} aria-hidden="true" />
                ) : null}
                <CoachingText text={text} isClosingDetail={section.key === "close"} />
              </div>
              {evidence.length > 0 ? <EvidenceTimes evidence={evidence} recordingUrl={recordingUrl} /> : null}
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

function EvidenceTimes({ evidence, recordingUrl }: { evidence: string[]; recordingUrl?: string | null }) {
  return (
    <details className="mt-3 text-sm text-slate-500">
      <summary className="w-fit cursor-pointer font-medium hover:text-[#a92728]">Transcript evidence</summary>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {evidence.map((time) => (
          recordingUrl ? (
            <a
              key={time}
              href={recordingUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open recording and seek to ${formatCoachingTimestamp(time)}`}
              title={`Open recording and seek to ${formatCoachingTimestamp(time)}`}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-red-100 bg-red-50/70 px-2.5 font-semibold tabular-nums text-[#a92728] hover:border-red-200 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
            >
              {formatCoachingTimestamp(time)} <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          ) : (
            <span key={time} className="inline-flex min-h-9 items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 font-semibold tabular-nums text-slate-600">
              {formatCoachingTimestamp(time)}
            </span>
          )
        ))}
      </div>
      {recordingUrl ? <p className="mt-2 text-xs text-slate-500">The recording opens separately; seek to the time shown.</p> : null}
    </details>
  );
}
