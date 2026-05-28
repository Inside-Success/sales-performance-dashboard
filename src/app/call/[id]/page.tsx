import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Award,
  BookOpenText,
  CalendarDays,
  Clock3,
  ExternalLink,
  FileText,
  Lightbulb,
  MessageSquareText,
  PencilLine,
  Target,
  Video,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { BulletList, JsonSection } from "@/components/dashboard/json-section";
import { TrackRecentlyViewed } from "@/components/dashboard/recently-viewed";
import { ReportChatPanel } from "@/components/dashboard/report-chat-panel";
import { TrackedExternalLink, TrackUsageEvent } from "@/components/dashboard/usage-tracker";
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
  const isManagerUsageView = source === "manager-usage";
  const call = await getPerformanceCall(id);

  if (!call) notFound();

  const reportChatEnabled = isReportChatEnabledForCall(call);
  const closeTitle =
    call.close_section_type === "what_made_this_close_work"
      ? "What Made This Close Work"
      : "Why No Close";

  return (
    <main className="dashboard-page min-h-screen bg-background">
      <TrackRecentlyViewed call={call} />
      {!isManagerUsageView ? (
        <TrackUsageEvent
          eventName="report_detail_viewed"
          eventData={{
            source: "official_report",
            target_rep_slug: call.rep_slug,
            target_rep_name: call.rep_name,
            report_id: call.id,
            metadata: {
              client_name: call.client_name,
              meeting_title: call.meeting_title,
            },
          }}
        />
      ) : null}
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <article className="space-y-4">
          <header className="dashboard-card dashboard-hero rounded-2xl border bg-card/95 p-5 md:p-6">
            <Link href="/" className={cn(buttonVariants({ variant: "ghost" }), "mb-4 px-0")}>
              <ArrowLeft className="size-4" />
              Home
            </Link>

            <div className="flex flex-wrap items-center gap-2">
              {call.call_status ? <Badge variant="secondary">{call.call_status}</Badge> : null}
              {call.call_date ? (
                <Badge variant="outline" className="gap-1">
                  <CalendarDays className="size-3.5" />
                  Meeting {formatMiamiMeetingDateTime(call.call_date)}
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1">
                  <Clock3 className="size-3.5" />
                  Received {formatMiamiDateTime(call.updated_at)}
                </Badge>
              )}
            </div>

            <h1 className="mt-3 text-3xl font-semibold tracking-normal">
              {call.client_name || call.meeting_title || "Feedback Report"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {call.meeting_title && call.meeting_title !== call.client_name ? `${call.meeting_title} - ` : ""}
              {call.rep_name} sales feedback report.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
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
            <JsonSection value={call.close_section} />
          </ReportSection>

          <ReportSection title="Objections Surfaced" icon={<MessageSquareText className="size-4" />}>
            <BulletList items={call.objections_surfaced} />
          </ReportSection>
        </article>
      </div>
    </main>
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
        "rounded-xl border bg-card/95 p-5 shadow-xs",
        featured && "border-primary/20 bg-primary/5",
      )}
    >
      <h2 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-normal text-muted-foreground">
        <span className="grid size-7 place-items-center rounded-md border bg-background text-foreground">
          {icon}
        </span>
        {title}
      </h2>
      <div className="text-sm leading-7 text-foreground">{children}</div>
    </section>
  );
}

function ReportText({ children }: { children: React.ReactNode }) {
  return <p className="leading-7">{children}</p>;
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

  const className = cn(buttonVariants({ variant: "outline" }), "gap-1");
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
