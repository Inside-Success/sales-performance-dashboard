"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronRight,
  ExternalLink,
  Tags,
  Users,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  ComplianceCategoryDrilldown,
  ComplianceCategoryRow,
  ComplianceDashboardData,
  ComplianceFlagDetail,
  ComplianceRepGroup,
} from "@/lib/compliance-dashboard";

type ModalState =
  | { type: "rep"; repSlug: string; categoryKey?: string }
  | { type: "category"; categoryKey: string }
  | null;

const numberFormatter = new Intl.NumberFormat("en-US");

export function ComplianceDrilldownBoard({ data }: { data: ComplianceDashboardData }) {
  const [modal, setModal] = useState<ModalState>(null);

  useEffect(() => {
    if (!modal) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setModal(null);
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [modal]);

  const selectedRep =
    modal?.type === "rep"
      ? data.repGroups.find((rep) => rep.repSlug === modal.repSlug) ||
        findRepFromDetails(data.flagDetails, modal.repSlug)
      : null;
  const selectedCategory =
    modal?.type === "category"
      ? data.categoryDrilldowns.find((category) => category.categoryKey === modal.categoryKey) ||
        null
      : modal?.type === "rep" && modal.categoryKey
        ? data.categoryDrilldowns.find((category) => category.categoryKey === modal.categoryKey) ||
          null
        : null;
  const selectedRepDetails = useMemo(() => {
    if (modal?.type !== "rep") return [];
    return data.flagDetails
      .filter((detail) => detail.repSlug === modal.repSlug)
      .filter(
        (detail) =>
          !modal.categoryKey ||
          detail.categoryKey === modal.categoryKey ||
          detail.categoryKeys.includes(modal.categoryKey),
      )
      .sort((a, b) => b.dateTime - a.dateTime || a.client.localeCompare(b.client));
  }, [data.flagDetails, modal]);

  return (
    <>
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(420px,0.85fr)]">
        <RepSummaryCard data={data} onOpenRep={(repSlug) => setModal({ type: "rep", repSlug })} />
        <CategorySummaryCard
          data={data}
          onOpenCategory={(categoryKey) => setModal({ type: "category", categoryKey })}
        />
      </section>

      {modal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-3 backdrop-blur-sm sm:p-6"
          role="presentation"
          onMouseDown={() => setModal(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Compliance drill-down"
            className="max-h-[88vh] w-full max-w-5xl overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.25)]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            {modal.type === "category" && selectedCategory ? (
              <CategoryModal
                category={selectedCategory}
                onClose={() => setModal(null)}
                onOpenRep={(repSlug) =>
                  setModal({ type: "rep", repSlug, categoryKey: selectedCategory.categoryKey })
                }
              />
            ) : selectedRep ? (
              <RepModal
                rep={selectedRep}
                category={selectedCategory}
                details={selectedRepDetails}
                onBack={
                  selectedCategory
                    ? () => setModal({ type: "category", categoryKey: selectedCategory.categoryKey })
                    : undefined
                }
                onClose={() => setModal(null)}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

function RepSummaryCard({
  data,
  onOpenRep,
}: {
  data: ComplianceDashboardData;
  onOpenRep: (repSlug: string) => void;
}) {
  return (
    <Card className="magic-card border-white/80 bg-white/95">
      <CardHeader className="border-b border-slate-100">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-slate-950">
              <span className="magic-icon-bubble">
                <Users className="size-4" />
              </span>
              Weekly Rep Summary
            </CardTitle>
            <CardDescription>Click a rep to see every flagged call for this week.</CardDescription>
          </div>
          <Badge variant="outline" className="w-fit rounded-full border-red-100 bg-[#FEF2F2] text-[#B91C1C]">
            {formatNumber(data.repGroups.length)} of {formatNumber(data.unfilteredRepCount)} reps
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {data.repGroups.length ? (
          <div className="dashboard-scroll max-h-[620px] overflow-auto">
            <Table className="table-fixed">
              <TableHeader className="sticky top-0 z-10 bg-white shadow-sm">
                <TableRow>
                  <TableHead className="w-[24%] px-4">Rep</TableHead>
                  <TableHead className="w-16 text-right">Flags</TableHead>
                  <TableHead className="w-24">Risk</TableHead>
                  <TableHead>Categories</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.repGroups.map((row) => (
                  <RepSummaryRow key={row.repSlug} row={row} onOpen={() => onOpenRep(row.repSlug)} />
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

function RepSummaryRow({ row, onOpen }: { row: ComplianceRepGroup; onOpen: () => void }) {
  return (
    <TableRow
      role="button"
      tabIndex={0}
      className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200"
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onOpen();
      }}
    >
      <TableCell className="whitespace-normal px-4 font-semibold leading-5 text-slate-950">
        <span className="inline-flex items-center gap-2">
          {row.rep}
          <ChevronRight className="size-4 text-slate-400" />
        </span>
      </TableCell>
      <TableCell className="text-right text-base font-semibold text-slate-950">
        {formatNumber(row.totalCount)}
      </TableCell>
      <TableCell>
        <SeverityBadge severity={row.severity} />
      </TableCell>
      <TableCell className="whitespace-normal">
        <CategoryList categories={row.categories} />
        {row.managerNotes.length ? (
          <p className="mt-2 text-xs leading-5 text-slate-500">Notes: {row.managerNotes.join(" | ")}</p>
        ) : null}
      </TableCell>
    </TableRow>
  );
}

function CategorySummaryCard({
  data,
  onOpenCategory,
}: {
  data: ComplianceDashboardData;
  onOpenCategory: (categoryKey: string) => void;
}) {
  return (
    <Card className="magic-card border-white/80 bg-white/95">
      <CardHeader className="border-b border-slate-100">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-slate-950">
              <span className="magic-icon-bubble">
                <Tags className="size-4" />
              </span>
              Weekly Category Summary
            </CardTitle>
            <CardDescription>Click a category to see which reps triggered it most.</CardDescription>
          </div>
          <Badge variant="outline" className="w-fit rounded-full border-red-100 bg-[#FEF2F2] text-[#B91C1C]">
            {formatNumber(data.categoryRows.length)} of {formatNumber(data.unfilteredCategoryCount)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {data.categoryRows.length ? (
          <div className="dashboard-scroll max-h-[620px] overflow-auto">
            <Table className="min-w-[560px]">
              <TableHeader className="sticky top-0 z-10 bg-white shadow-sm">
                <TableRow>
                  <TableHead className="min-w-[230px] px-4">Category</TableHead>
                  <TableHead className="w-[90px] text-right">Flags</TableHead>
                  <TableHead className="w-[90px] text-right">Reps</TableHead>
                  <TableHead className="w-[120px]">Risk</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.categoryRows.map((row) => (
                  <CategorySummaryRow
                    key={row.key}
                    row={row}
                    onOpen={() => onOpenCategory(row.categoryKey)}
                  />
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

function CategorySummaryRow({ row, onOpen }: { row: ComplianceCategoryRow; onOpen: () => void }) {
  return (
    <TableRow
      role="button"
      tabIndex={0}
      className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200"
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onOpen();
      }}
    >
      <TableCell className="whitespace-normal px-4">
        <div className="flex items-start gap-2 font-semibold text-slate-950">
          <span>{row.category}</span>
          <ChevronRight className="mt-0.5 size-4 shrink-0 text-slate-400" />
        </div>
        <div className="mt-1 text-xs text-slate-500">Last seen {row.lastSeen || "not listed"}</div>
        {row.managerNotes ? <div className="mt-1 text-xs leading-5 text-slate-500">Notes: {row.managerNotes}</div> : null}
      </TableCell>
      <TableCell className="text-right text-base font-semibold text-slate-950">
        {formatNumber(row.totalCount)}
      </TableCell>
      <TableCell className="text-right">{formatNumber(row.repsInvolved)}</TableCell>
      <TableCell>
        <SeverityBadge severity={row.severity} />
      </TableCell>
    </TableRow>
  );
}

function CategoryModal({
  category,
  onClose,
  onOpenRep,
}: {
  category: ComplianceCategoryDrilldown;
  onClose: () => void;
  onOpenRep: (repSlug: string) => void;
}) {
  return (
    <div className="flex max-h-[88vh] flex-col">
      <ModalHeader
        eyebrow="Category drill-down"
        title={category.category}
        subtitle={`${formatNumber(category.totalCount)} flags across ${formatNumber(category.repsInvolved)} reps`}
        onClose={onClose}
      />
      <div className="dashboard-scroll overflow-auto p-4 sm:p-5">
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="px-4">Rep</TableHead>
                <TableHead className="w-24 text-right">Flags</TableHead>
                <TableHead className="w-28">Risk</TableHead>
                <TableHead className="w-40">Last seen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {category.reps.map((rep) => (
                <TableRow
                  key={rep.repSlug}
                  role="button"
                  tabIndex={0}
                  className="cursor-pointer"
                  onClick={() => onOpenRep(rep.repSlug)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") onOpenRep(rep.repSlug);
                  }}
                >
                  <TableCell className="whitespace-normal px-4 font-semibold text-slate-950">
                    <span className="inline-flex items-center gap-2">
                      {rep.rep}
                      <ChevronRight className="size-4 text-slate-400" />
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-base font-semibold">{formatNumber(rep.count)}</TableCell>
                  <TableCell>
                    <SeverityBadge severity={rep.severity} />
                  </TableCell>
                  <TableCell className="text-sm text-slate-500">{rep.lastSeen || "Not listed"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function RepModal({
  rep,
  category,
  details,
  onBack,
  onClose,
}: {
  rep: ComplianceRepGroup;
  category: ComplianceCategoryDrilldown | null;
  details: ComplianceFlagDetail[];
  onBack?: () => void;
  onClose: () => void;
}) {
  const expectedCount = category
    ? category.reps.find((item) => item.repSlug === rep.repSlug)?.count || details.length
    : rep.totalCount;

  return (
    <div className="flex max-h-[88vh] flex-col">
      <ModalHeader
        eyebrow={category ? "Rep evidence by category" : "Rep evidence"}
        title={rep.rep}
        subtitle={`${formatNumber(expectedCount)} flags${category ? ` in ${category.category}` : ""}`}
        onBack={onBack}
        onClose={onClose}
      />
      <div className="dashboard-scroll overflow-auto bg-slate-50/60 p-4 sm:p-5">
        {details.length ? (
          <div className="space-y-3">
            {details.map((detail) => (
              <EvidenceCard key={detail.id} detail={detail} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm leading-6 text-slate-500">
            The weekly summary shows flags here, but the raw evidence log does not include a
            matching quote row for this exact drill-down.
          </div>
        )}
      </div>
    </div>
  );
}

function EvidenceCard({ detail }: { detail: ComplianceFlagDetail }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="rounded-full border-red-100 bg-[#FEF2F2] text-[#B91C1C]">
              {detail.category}
            </Badge>
            <SeverityBadge severity={detail.severity} />
          </div>
          <h3 className="mt-2 text-base font-semibold text-slate-950">
            {detail.client || "Unknown client"}
          </h3>
          <p className="mt-1 text-sm text-slate-500">{detail.date}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {detail.transcriptUrl ? (
            <Link
              href={detail.transcriptUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:border-red-200 hover:bg-[#FEF2F2] hover:text-[#B91C1C]"
            >
              Transcript
              <ExternalLink className="size-4" />
            </Link>
          ) : null}
        </div>
      </div>
      <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
        <p className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">
          {detail.quote || "No quote was recorded for this flag."}
        </p>
      </div>
      {detail.decision ? <p className="mt-3 text-xs leading-5 text-slate-500">Decision: {detail.decision}</p> : null}
    </article>
  );
}

function ModalHeader({
  eyebrow,
  title,
  subtitle,
  onBack,
  onClose,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  onBack?: () => void;
  onClose: () => void;
}) {
  return (
    <div className="border-b border-slate-100 bg-white p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {onBack ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mb-2 h-7 rounded-full px-0 text-slate-500 hover:bg-transparent hover:text-[#B91C1C]"
              onClick={onBack}
            >
              <ArrowLeft className="size-4" />
              Back
            </Button>
          ) : null}
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#B91C1C]">{eyebrow}</p>
          <h2 className="mt-1 text-2xl font-semibold leading-tight text-slate-950">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">{subtitle}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          aria-label="Close"
          className="shrink-0 rounded-full border-slate-200 bg-white hover:bg-[#FEF2F2] hover:text-[#B91C1C]"
          onClick={onClose}
        >
          <X className="size-5" />
        </Button>
      </div>
    </div>
  );
}

function CategoryList({ categories }: { categories: ComplianceRepGroup["categories"] }) {
  const visibleCategories = categories.slice(0, 4);
  const hiddenCount = categories.length - visibleCategories.length;

  return (
    <div className="flex flex-wrap gap-1.5">
      {visibleCategories.map((category) => (
        <span
          key={category.name}
          className="inline-block max-w-full rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs leading-5 text-slate-700"
        >
          {category.name} ({formatNumber(category.count)})
        </span>
      ))}
      {hiddenCount > 0 ? <Badge variant="secondary">+{formatNumber(hiddenCount)} more</Badge> : null}
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

function EmptyState({ message }: { message: string }) {
  return <div className="p-8 text-center text-sm leading-6 text-slate-500">{message}</div>;
}

function findRepFromDetails(details: ComplianceFlagDetail[], repSlug: string): ComplianceRepGroup | null {
  const first = details.find((detail) => detail.repSlug === repSlug);
  if (!first) return null;

  return {
    rep: first.rep,
    repSlug,
    totalCount: details.filter((detail) => detail.repSlug === repSlug).length,
    severity: "Review",
    lastSeen: first.date,
    lastSeenTime: first.dateTime,
    categories: [],
    managerNotes: [],
  };
}

function formatNumber(value: number) {
  return numberFormatter.format(value);
}
