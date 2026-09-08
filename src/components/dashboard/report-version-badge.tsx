import { Badge } from "@/components/ui/badge";
import { getReportVersion, getReportVersionLabel, type ReportVersion } from "@/lib/report-version";
import { cn } from "@/lib/utils";

type ReportVersionBadgeProps = {
  coachingVersion?: unknown;
  className?: string;
};

export function ReportVersionBadge({ coachingVersion, className }: ReportVersionBadgeProps) {
  const version = getReportVersion(coachingVersion);

  return <ReportVersionLabel version={version} className={className} />;
}

export function ReportVersionLabel({
  version,
  className,
}: {
  version: ReportVersion;
  className?: string;
}) {
  const isEnhanced = version === "enhanced";

  return (
    <Badge
      variant="outline"
      className={cn(
        "h-6 rounded-full px-2.5 text-[0.7rem] font-semibold uppercase tracking-[0.08em]",
        isEnhanced
          ? "border-[#FCA5A5] bg-[#FEF2F2] text-[#B91C1C]"
          : "border-slate-200 bg-slate-50 text-slate-500",
        className,
      )}
    >
      {getReportVersionLabel(version)}
    </Badge>
  );
}
