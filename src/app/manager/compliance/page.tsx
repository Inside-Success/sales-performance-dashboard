import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  Clock3,
  ExternalLink,
  FileSpreadsheet,
  Filter,
  Flag,
  Search,
  ShieldCheck,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";
import { ComplianceDrilldownBoard } from "@/components/dashboard/compliance-drilldown-board";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  COMPLIANCE_COUNT_FILTERS,
  getComplianceDashboardData,
  type ComplianceDashboardData,
  type ComplianceSearchParams,
} from "@/lib/compliance-dashboard";
import { formatMiamiDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Compliance Review | Magic Mike Bot",
  description: "Hidden manager dashboard for weekly sales compliance review.",
  robots: {
    index: false,
    follow: false,
  },
};

const numberFormatter = new Intl.NumberFormat("en-US");

export default async function ManagerCompliancePage({
  searchParams,
}: {
  searchParams: Promise<ComplianceSearchParams>;
}) {
  const params = await searchParams;
  const data = await getComplianceDashboardData(params);

  return (
    <main className="magic-page">
      <div className="mx-auto flex w-full max-w-[84rem] flex-col gap-5 px-5 pb-16 pt-8 sm:px-8">
        <header className="magic-card magic-hero p-5 md:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="gap-1 rounded-full border-red-100 bg-[#FEF2F2] text-[#B91C1C]">
                  <ShieldCheck className="size-3.5" />
                  Hidden manager view
                </Badge>
                <Badge variant="outline" className="gap-1 rounded-full border-slate-200 bg-white/80 text-slate-600">
                  <FileSpreadsheet className="size-3.5" />
                  Sheet-backed
                </Badge>
                {data.selectedWeek ? (
                  <Badge variant="outline" className="gap-1 rounded-full border-slate-200 bg-white/80 text-slate-600">
                    <CalendarDays className="size-3.5" />
                    {data.selectedWeek.label}
                  </Badge>
                ) : null}
              </div>
              <h1 className="text-4xl font-semibold tracking-normal text-slate-950 md:text-5xl">
                Compliance Review
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
                Weekly flags by rep and category. Click any row to see the exact call evidence.
              </p>
            </div>

            <div className="flex flex-col gap-2 text-sm text-slate-500 lg:items-end">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-2">
                <Clock3 className="size-4 text-slate-700" />
                Loaded {formatMiamiDateTime(data.generatedAt)}
              </div>
              <div className="flex flex-wrap gap-2 lg:justify-end">
                <Link href="/coaching" className={cn(buttonVariants({ variant: "outline" }), "h-9 w-fit rounded-full border-slate-200 bg-white hover:bg-[#FEF2F2] hover:text-[#B91C1C]")}>
                  Open dashboard
                </Link>
                <Link
                  href={data.sheetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(buttonVariants({ variant: "outline" }), "h-9 w-fit rounded-full border-slate-200 bg-white hover:bg-[#FEF2F2] hover:text-[#B91C1C]")}
                >
                  Open sheet
                  <ExternalLink className="size-4" />
                </Link>
              </div>
            </div>
          </div>
        </header>

        {data.error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm leading-6 text-destructive">
            {data.error}
          </div>
        ) : null}

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            icon={Flag}
            title="Flags"
            value={formatNumber(data.summary.totalFlags)}
            description={
              data.selectedWeek
                ? `${data.summary.categories} categories in ${data.selectedWeek.label}`
                : "No week selected"
            }
          />
          <MetricCard
            icon={Users}
            title="Reps involved"
            value={formatNumber(data.summary.repsInvolved)}
            description={
              data.summary.topRep
                ? `Top rep: ${data.summary.topRep.rep} (${formatNumber(data.summary.topRep.totalCount)})`
                : "At least one compliance flag"
            }
          />
          <MetricCard
            icon={AlertTriangle}
            title="High-risk flags"
            value={formatNumber(data.summary.highSeverityFlags)}
            description="Flags marked High in the weekly summary"
          />
          <MetricCard
            icon={Target}
            title="Top issue"
            value={data.summary.topIssue?.category || "None"}
            description={
              data.summary.topIssue
                ? `${formatNumber(data.summary.topIssue.totalCount)} flags`
                : "No flags in selected week"
            }
            valueClassName="text-lg leading-snug"
          />
        </section>

        <ComplianceFilters data={data} />

        <ComplianceDrilldownBoard data={data} />

        <p className="max-w-4xl text-xs leading-5 text-slate-500">
          This view only reads the compliance sheet and dashboard records. It does not change
          alerts, scoring, coaching, or sheet data.
        </p>
      </div>
    </main>
  );
}

function ComplianceFilters({ data }: { data: ComplianceDashboardData }) {
  const hasFilters = data.filters.search || data.filters.minCount > 1;

  return (
    <Card className="magic-card border-white/80 bg-white/95">
      <CardContent className="pt-1">
        <form className="grid gap-3 lg:grid-cols-[minmax(180px,0.75fr)_minmax(150px,0.55fr)_minmax(240px,1fr)_auto] lg:items-end">
          <label className="grid gap-1.5 text-sm">
            <span className="font-semibold text-slate-800">Week</span>
            <select
              name="week"
              defaultValue={data.selectedWeek?.key || ""}
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition-colors focus-visible:border-red-300 focus-visible:ring-3 focus-visible:ring-red-100"
            >
              {data.weeks.map((week) => (
                <option key={week.key} value={week.key}>
                  {week.label} {week.status ? `(${week.status})` : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5 text-sm">
            <span className="font-semibold text-slate-800">Count</span>
            <select
              name="minCount"
              defaultValue={data.filters.minCount}
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition-colors focus-visible:border-red-300 focus-visible:ring-3 focus-visible:ring-red-100"
            >
              {COMPLIANCE_COUNT_FILTERS.map((count) => (
                <option key={count} value={count}>
                  {count === 1 ? "All counts" : `${count}+ flags`}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5 text-sm">
            <span className="font-semibold text-slate-800">Search</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                name="q"
                defaultValue={data.filters.search}
                placeholder="Rep, category, date, notes"
                className="h-9 rounded-xl border-slate-200 bg-white pl-9 focus-visible:border-red-300 focus-visible:ring-red-100"
              />
            </div>
          </label>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" className="h-9 gap-1.5 rounded-full bg-[#DC2626] px-4 text-white hover:bg-[#B91C1C]">
              <Filter className="size-4" />
              Apply
            </Button>
            {hasFilters ? (
              <Link href="/manager/compliance" className={cn(buttonVariants({ variant: "outline" }), "h-9 rounded-full border-slate-200 bg-white px-4 hover:bg-[#FEF2F2] hover:text-[#B91C1C]")}>
                Reset
              </Link>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  valueClassName,
}: {
  title: string;
  value: string;
  description: string;
  icon: LucideIcon;
  valueClassName?: string;
}) {
  return (
    <Card className="magic-card border-white/80 bg-white/95">
      <CardContent className="flex items-start justify-between gap-3 pt-1">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p
            className={cn(
              "mt-2 text-3xl font-semibold tracking-normal text-slate-950",
              valueClassName ? "whitespace-normal" : "truncate",
              valueClassName,
            )}
          >
            {value}
          </p>
          <p className="mt-1 text-xs text-slate-500">{description}</p>
        </div>
        <span className="grid size-9 shrink-0 place-items-center rounded-2xl border border-red-100 bg-[#FEF2F2] text-[#DC2626]">
          <Icon className="size-4" />
        </span>
      </CardContent>
    </Card>
  );
}

function formatNumber(value: number) {
  return numberFormatter.format(value);
}
