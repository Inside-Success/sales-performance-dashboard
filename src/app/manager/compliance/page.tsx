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
  Tags,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  COMPLIANCE_COUNT_FILTERS,
  getComplianceDashboardData,
  type ComplianceCategoryRow,
  type ComplianceDashboardData,
  type ComplianceRepGroup,
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
    <main className="dashboard-page min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
        <header className="dashboard-card dashboard-hero rounded-2xl border bg-card/95 p-5 md:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="gap-1">
                  <ShieldCheck className="size-3.5" />
                  Hidden manager view
                </Badge>
                <Badge variant="outline" className="gap-1 bg-background/70">
                  <FileSpreadsheet className="size-3.5" />
                  Google Sheet source
                </Badge>
                {data.selectedWeek ? (
                  <Badge variant="outline" className="gap-1 bg-background/70">
                    <CalendarDays className="size-3.5" />
                    {data.selectedWeek.label}
                  </Badge>
                ) : null}
              </div>
              <h1 className="text-3xl font-semibold tracking-normal md:text-4xl">
                Compliance Review
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                A clean manager view of the weekly compliance sheet, grouped by rep and by
                category.
              </p>
            </div>

            <div className="flex flex-col gap-2 text-sm text-muted-foreground lg:items-end">
              <div className="inline-flex items-center gap-2 rounded-lg border bg-background/75 px-3 py-2">
                <Clock3 className="size-4 text-foreground" />
                Loaded {formatMiamiDateTime(data.generatedAt)}
              </div>
              <div className="flex flex-wrap gap-2 lg:justify-end">
                <Link href="/" className={cn(buttonVariants({ variant: "outline" }), "w-fit")}>
                  Open dashboard
                </Link>
                <Link
                  href={data.sheetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(buttonVariants({ variant: "outline" }), "w-fit")}
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
            description={data.selectedWeek ? data.selectedWeek.label : "No week selected"}
          />
          <MetricCard
            icon={Users}
            title="Reps involved"
            value={formatNumber(data.summary.repsInvolved)}
            description="At least one compliance flag"
          />
          <MetricCard
            icon={Tags}
            title="Categories"
            value={formatNumber(data.summary.categories)}
            description="Grouped from the summary sheet"
          />
          <MetricCard
            icon={AlertTriangle}
            title="Highest severity"
            value={data.summary.highestSeverity}
            description={`${formatNumber(data.summary.highSeverityRows)} high-severity rows`}
          />
        </section>

        <ComplianceFilters data={data} />

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(420px,0.85fr)]">
          <RepSummaryCard data={data} />
          <CategorySummaryCard data={data} />
        </section>

        <p className="max-w-4xl text-xs leading-5 text-muted-foreground">
          This page reloads the weekly summary tabs directly from Google Sheets. The Google Sheet
          remains the source of truth while this manager view stays additive.
        </p>
      </div>
    </main>
  );
}

function ComplianceFilters({ data }: { data: ComplianceDashboardData }) {
  const hasFilters = data.filters.search || data.filters.minCount > 1;

  return (
    <Card className="dashboard-card border bg-card/95">
      <CardContent className="pt-1">
        <form className="grid gap-3 lg:grid-cols-[minmax(180px,0.75fr)_minmax(150px,0.55fr)_minmax(240px,1fr)_auto] lg:items-end">
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium text-foreground">Week</span>
            <select
              name="week"
              defaultValue={data.selectedWeek?.key || ""}
              className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {data.weeks.map((week) => (
                <option key={week.key} value={week.key}>
                  {week.label} {week.status ? `(${week.status})` : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5 text-sm">
            <span className="font-medium text-foreground">Count</span>
            <select
              name="minCount"
              defaultValue={data.filters.minCount}
              className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {COMPLIANCE_COUNT_FILTERS.map((count) => (
                <option key={count} value={count}>
                  {count === 1 ? "All counts" : `${count}+ flags`}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5 text-sm">
            <span className="font-medium text-foreground">Search</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                name="q"
                defaultValue={data.filters.search}
                placeholder="Rep, category, date, notes"
                className="pl-8"
              />
            </div>
          </label>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" className="gap-1.5">
              <Filter className="size-4" />
              Apply
            </Button>
            {hasFilters ? (
              <Link href="/manager/compliance" className={buttonVariants({ variant: "outline" })}>
                Reset
              </Link>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function RepSummaryCard({ data }: { data: ComplianceDashboardData }) {
  return (
    <Card className="dashboard-card border bg-card/95">
      <CardHeader className="border-b">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-4" />
              Weekly Rep Summary
            </CardTitle>
            <CardDescription>
              One row per rep, with their categories grouped together.
            </CardDescription>
          </div>
          <Badge variant="outline" className="w-fit">
            {formatNumber(data.repGroups.length)} of {formatNumber(data.unfilteredRepCount)} reps
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {data.repGroups.length ? (
          <div className="dashboard-scroll max-h-[620px] overflow-auto">
            <Table className="min-w-[760px]">
              <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
                <TableRow>
                  <TableHead className="w-[210px] px-4">Rep</TableHead>
                  <TableHead className="w-[88px] text-right">Count</TableHead>
                  <TableHead className="w-[120px]">Severity</TableHead>
                  <TableHead className="min-w-[300px]">Categories</TableHead>
                  <TableHead className="w-[180px]">Last seen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.repGroups.map((row) => (
                  <RepSummaryRow key={row.rep} row={row} />
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <EmptyState message="No reps match the selected filters." />
        )}
      </CardContent>
    </Card>
  );
}

function RepSummaryRow({ row }: { row: ComplianceRepGroup }) {
  return (
    <TableRow>
      <TableCell className="px-4 font-medium">{row.rep}</TableCell>
      <TableCell className="text-right text-base font-semibold">
        {formatNumber(row.totalCount)}
      </TableCell>
      <TableCell>
        <SeverityBadge severity={row.severity} />
      </TableCell>
      <TableCell className="whitespace-normal">
        <CategoryList categories={row.categories} />
        {row.managerNotes.length ? (
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Notes: {row.managerNotes.join(" | ")}
          </p>
        ) : null}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{row.lastSeen || "Not listed"}</TableCell>
    </TableRow>
  );
}

function CategorySummaryCard({ data }: { data: ComplianceDashboardData }) {
  return (
    <Card className="dashboard-card border bg-card/95">
      <CardHeader className="border-b">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Tags className="size-4" />
              Weekly Category Summary
            </CardTitle>
            <CardDescription>Category totals for the selected week.</CardDescription>
          </div>
          <Badge variant="outline" className="w-fit">
            {formatNumber(data.categoryRows.length)} of {formatNumber(data.unfilteredCategoryCount)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {data.categoryRows.length ? (
          <div className="dashboard-scroll max-h-[620px] overflow-auto">
            <Table className="min-w-[560px]">
              <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
                <TableRow>
                  <TableHead className="min-w-[230px] px-4">Category</TableHead>
                  <TableHead className="w-[90px] text-right">Flags</TableHead>
                  <TableHead className="w-[90px] text-right">Reps</TableHead>
                  <TableHead className="w-[120px]">Severity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.categoryRows.map((row) => (
                  <CategorySummaryRow key={row.key} row={row} />
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <EmptyState message="No categories match the selected filters." />
        )}
      </CardContent>
    </Card>
  );
}

function CategorySummaryRow({ row }: { row: ComplianceCategoryRow }) {
  return (
    <TableRow>
      <TableCell className="whitespace-normal px-4">
        <div className="font-medium">{row.category}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          Last seen {row.lastSeen || "not listed"}
        </div>
        {row.managerNotes ? (
          <div className="mt-1 text-xs leading-5 text-muted-foreground">
            Notes: {row.managerNotes}
          </div>
        ) : null}
      </TableCell>
      <TableCell className="text-right text-base font-semibold">
        {formatNumber(row.totalCount)}
      </TableCell>
      <TableCell className="text-right">{formatNumber(row.repsInvolved)}</TableCell>
      <TableCell>
        <SeverityBadge severity={row.severity} />
      </TableCell>
    </TableRow>
  );
}

function CategoryList({ categories }: { categories: ComplianceRepGroup["categories"] }) {
  const visibleCategories = categories.slice(0, 4);
  const hiddenCount = categories.length - visibleCategories.length;

  return (
    <div className="flex flex-wrap gap-1.5">
      {visibleCategories.map((category) => (
        <Badge key={category.name} variant="outline" className="bg-background/70">
          {category.name} ({formatNumber(category.count)})
        </Badge>
      ))}
      {hiddenCount > 0 ? (
        <Badge variant="secondary">+{formatNumber(hiddenCount)} more</Badge>
      ) : null}
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const normalized = severity.toLowerCase();

  if (normalized === "high") {
    return <Badge variant="destructive">High</Badge>;
  }

  if (normalized === "medium") {
    return <Badge variant="secondary">Medium</Badge>;
  }

  if (normalized === "low") {
    return <Badge variant="outline">Low</Badge>;
  }

  if (normalized === "none") {
    return <Badge variant="outline">None</Badge>;
  }

  return <Badge variant="outline">{severity || "Review"}</Badge>;
}

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <Card className="dashboard-card border bg-card/95">
      <CardContent className="flex items-start justify-between gap-3 pt-1">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-2 truncate text-3xl font-semibold tracking-normal">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <span className="grid size-9 shrink-0 place-items-center rounded-lg border bg-background text-primary">
          <Icon className="size-4" />
        </span>
      </CardContent>
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="p-8 text-center text-sm leading-6 text-muted-foreground">
      {message}
    </div>
  );
}

function formatNumber(value: number) {
  return numberFormatter.format(value);
}
