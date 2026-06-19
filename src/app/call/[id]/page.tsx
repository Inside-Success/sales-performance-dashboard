import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Award,
  BookOpenText,
  Clock3,
  ExternalLink,
  FileText,
  Lightbulb,
  MessageSquareText,
  PencilLine,
  Target,
  UserRound,
  Video,
  Wrench,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { BulletList, JsonSection } from "@/components/dashboard/json-section";
import { TrackRecentlyViewed } from "@/components/dashboard/recently-viewed";
import { ReportFeedbackWidget } from "@/components/dashboard/report-feedback-widget";
import { ReportChatPanel } from "@/components/dashboard/report-chat-panel";
import { ReportVersionBadge } from "@/components/dashboard/report-version-badge";
import {
  ReportEngagementTracker,
  TrackedExternalLink,
  TrackUsageEvent,
} from "@/components/dashboard/usage-tracker";
import { resolveCloseSection } from "@/lib/close-section";
import { getPerformanceCall } from "@/lib/db";
import { formatMiamiDateTime, formatMiamiMeetingDateTime } from "@/lib/format";
import { isReportChatEnabledForCall } from "@/lib/report-chat";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CallPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const source = Array.isArray(query.from) ? query.from[0] : query.from;
  const isManagerUsageView = source === "manager-usage" || source === "manager-compliance";
  const call = await getPerformanceCall(id);

  if (!call) notFound();

  const reportChatEnabled = isReportChatEnabledForCall(call);
  const closeSection = resolveCloseSection({
    whyNoClose: call.why_no_close,
    closeWorks: call.what_made_this_close_work,
  });
  const closeTitle =
    closeSection.type === "what_made_this_close_work"
      ? "What Made This Close Work"
      : "Why No Close";
  const meetingMeta = call.call_date
    ? {
        label: "Meeting time",
        value: formatMiamiMeetingDateTime(call.call_date),
      }
    : {
        label: "Received",
        value: formatMiamiDateTime(call.updated_at),
      };
  const officialUsageEventData = {
    source: "official_report",
    target_rep_slug: call.rep_slug,
    target_rep_name: call.rep_name,
    report_id: call.id,
    metadata: {
      client_name: call.client_name,
      meeting_title: call.meeting_title,
    },
  };

  return (
    <main className="magic-page">
      <TrackRecentlyViewed call={call} />
      {!isManagerUsageView ? (
        <>
          <TrackUsageEvent eventName="report_detail_viewed" eventData={officialUsageEventData} />
          <ReportEngagementTracker eventData={officialUsageEventData} />
        </>
      ) : null}
      <div className="magic-container max-w-5xl">
        <article className="space-y-4">
          <header className="magic-card magic-hero p-5 md:p-7">
            <div className="relative">
              <Link
                href="/"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-4 rounded-full px-0 text-slate-500 hover:text-[#B91C1C]")}
              >
                <ArrowLeft className="size-4" />
                Home
              </Link>

              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full bg-[#FEF2F2] px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-[#B91C1C]">
                  <FileText className="size-3.5" />
                  Sales feedback report
                </span>
                <ReportVersionBadge createdAt={call.created_at} />
              </div>

              <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight tracking-normal text-slate-950 md:text-5xl">
                {call.client_name || call.meeting_title || "Feedback Report"}
              </h1>
              {call.meeting_title && call.meeting_title !== call.client_name ? (
                <div className="mt-4 flex max-w-3xl flex-wrap gap-2.5">
                  <span className="inline-flex max-w-full items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm">
                    <MessageSquareText className="size-4 shrink-0 text-[#DC2626]" />
                    <span className="shrink-0 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                      Meeting
                    </span>
                    <span className="min-w-0 truncate">{call.meeting_title}</span>
                  </span>
                </div>
              ) : null}

              <div className="mt-6 grid gap-3 rounded-[20px] border border-slate-200 bg-white/80 p-4 text-sm sm:grid-cols-2">
                <MetaItem label="Rep" value={call.rep_name} icon={<UserRound className="size-4" />} />
                <MetaItem
                  label={meetingMeta.label}
                  value={meetingMeta.value}
                  icon={<Clock3 className="size-4" />}
                />
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                <ExternalButton
                  href={call.google_doc_link}
                  label="Open Google Doc"
                  icon={<FileText className="size-4" />}
                  eventName="google_doc_clicked"
                  reportId={call.id}
                  repSlug={call.rep_slug}
                  repName={call.rep_name}
                  trackingDisabled={isManagerUsageView}
                />
                <ExternalButton
                  href={call.meeting_link}
                  label="Zoom"
                  icon={<Video className="size-4" />}
                  eventName="zoom_clicked"
                  reportId={call.id}
                  repSlug={call.rep_slug}
                  repName={call.rep_name}
                  trackingDisabled={isManagerUsageView}
                />
                <ExternalButton
                  href={call.transcript_link}
                  label="Transcript"
                  icon={<MessageSquareText className="size-4" />}
                  eventName="transcript_clicked"
                  reportId={call.id}
                  repSlug={call.rep_slug}
                  repName={call.rep_name}
                  trackingDisabled={isManagerUsageView}
                />
                {reportChatEnabled ? (
                  <ReportChatPanel
                    reportId={call.id}
                    repName={call.rep_name}
                    clientName={call.client_name}
                  />
                ) : null}
              </div>
            </div>
          </header>

          <ReportSection title="Verdict" icon={<Lightbulb className="size-4" />} featured>
            <p className="text-base leading-8 md:text-lg">{call.one_line_verdict || "Not provided"}</p>
          </ReportSection>

          <ReportSection title="Biggest Strength" icon={<Award className="size-4" />}>
            <ReportText>{call.biggest_strength || "Not provided"}</ReportText>
          </ReportSection>

          <ReportSection title="What I'd Polish" icon={<PencilLine className="size-4" />}>
            <ReportText>{call.biggest_fix || "Not provided"}</ReportText>
          </ReportSection>

          <ReportSection title="Coaching Tip" icon={<Target className="size-4" />}>
            <ReportText>{call.coaching_tip || "Not provided"}</ReportText>
          </ReportSection>

          <ReportSection title="Rudy's Note" icon={<BookOpenText className="size-4" />}>
            <ReportText>{call.rudys_note || "Not provided"}</ReportText>
          </ReportSection>

          <ReportSection title="What Went Well" icon={<Award className="size-4" />}>
            <BulletList items={call.what_went_well} />
          </ReportSection>

          <ReportSection title="What To Improve" icon={<Wrench className="size-4" />}>
            <BulletList items={call.what_to_improve} />
          </ReportSection>

          <ReportSection title={closeTitle} icon={<Target className="size-4" />}>
            <JsonSection value={closeSection.value} />
          </ReportSection>

          <ReportSection title="Objections Surfaced" icon={<MessageSquareText className="size-4" />}>
            <BulletList items={call.objections_surfaced} />
          </ReportSection>

          <ReportFeedbackWidget
            reportType="official"
            reportId={call.id}
            repName={call.rep_name}
            clientName={call.client_name}
            reportCreatedAt={call.created_at}
          />
        </article>
      </div>
    </main>
  );
}

function MetaItem({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="magic-icon-bubble size-8 shrink-0">{icon}</span>
      <div className="min-w-0">
        <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">{label}</div>
        <div className="mt-0.5 truncate font-semibold text-slate-700">{value}</div>
      </div>
    </div>
  );
}

function ReportSection({
  title,
  icon,
  children,
  featured = false,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  featured?: boolean;
}) {
  return (
    <section
      className={cn(
        "magic-card p-5 md:p-6",
        featured && "border-red-100 bg-[#FEF2F2]/80",
      )}
    >
      <h2 className="mb-4 flex items-center gap-2.5 text-lg font-extrabold leading-tight tracking-normal text-slate-950">
        <span className="grid size-9 place-items-center rounded-xl border border-red-100 bg-white text-[#DC2626]">
          {icon}
        </span>
        {title}
      </h2>
      <div className="text-base leading-8 text-slate-700 md:text-[17px]">{children}</div>
    </section>
  );
}

function ReportText({ children }: { children: React.ReactNode }) {
  return <p className="leading-8">{children}</p>;
}

function ExternalButton({
  href,
  label,
  icon,
  eventName,
  reportId,
  repSlug,
  repName,
  trackingDisabled = false,
}: {
  href: string | null;
  label: string;
  icon: React.ReactNode;
  eventName: "google_doc_clicked" | "zoom_clicked" | "transcript_clicked";
  reportId: number;
  repSlug: string;
  repName: string;
  trackingDisabled?: boolean;
}) {
  if (!href) return null;

  const className = cn(
    buttonVariants({ variant: "outline" }),
    "h-10 gap-1 rounded-full border-slate-200 bg-white px-4 text-slate-700 hover:bg-[#FEF2F2] hover:text-[#B91C1C]",
  );
  const content = (
    <>
      {icon}
      {label}
      <ExternalLink className="size-4" />
    </>
  );

  if (trackingDisabled) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {content}
      </a>
    );
  }

  return (
    <TrackedExternalLink
      href={href}
      eventName={eventName}
      eventData={{
        source: "official_report",
        target_rep_slug: repSlug,
        target_rep_name: repName,
        report_id: reportId,
      }}
      target="_blank"
      rel="noreferrer"
      className={className}
    >
      {content}
    </TrackedExternalLink>
  );
}
