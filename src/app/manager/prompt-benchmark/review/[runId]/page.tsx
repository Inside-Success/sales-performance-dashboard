import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  BarChart3,
  BookOpenText,
  CheckCircle2,
  Clock3,
  Columns3,
  DollarSign,
  ExternalLink,
  FlaskConical,
  History,
  Lightbulb,
  MessageSquareText,
  PencilLine,
  Target,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BulletList, JsonSection } from "@/components/dashboard/json-section";
import { getPromptBenchmarkRunReview } from "@/lib/db";
import { formatMiamiDateTime } from "@/lib/format";
import type { JsonObject, PromptBenchmarkCost, PromptBenchmarkOutput } from "@/lib/types";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Prompt Benchmark Review | Magic Mike Bot",
  robots: {
    index: false,
    follow: false,
  },
};

const modelOrder = ["Sonnet 4.6", "Opus 4.8", "DeepSeek V4 Pro"];
const evalKeys = [
  ["classification_correct", "Classification"],
  ["caught_real_objection", "Real Objection"],
  ["fair_to_rep", "Fair To Rep"],
  ["accurate_facts", "Facts"],
  ["coaching_quality", "Coaching"],
  ["compliance_caught_real_flags", "Caught Flags"],
  ["compliance_no_false_flags", "No False Flags"],
  ["separation_maintained", "Separation"],
] as const;

const numberFormatter = new Intl.NumberFormat("en-US");
const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 4,
});

type CaseGroup = {
  caseId: string;
  caseLabel: string;
  caseType: string;
  expectedCallStatus: string | null;
  productionOutput: JsonObject | null;
  outputs: PromptBenchmarkOutput[];
  configs: ConfigGroup[];
};

type ConfigGroup = {
  key: string;
  callMode: string;
  coachingMode: string;
  outputs: PromptBenchmarkOutput[];
  models: string[];
};

export default async function PromptBenchmarkReviewPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  const decodedRunId = decodeURIComponent(runId);
  const data = await getPromptBenchmarkRunReview(decodedRunId);
  const productionOutputs = getProductionOutputs(data.run?.source_payload);
  const cases = buildCaseGroups(data.outputs, productionOutputs);
  const models = getOrderedModels(data.outputs);

  return (
    <main className="dashboard-page min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
        <header className="dashboard-card dashboard-hero rounded-2xl border bg-card/95 p-5 md:p-6">
          <Link href="/manager/prompt-benchmark" className={cn(buttonVariants({ variant: "ghost" }), "mb-4 px-0")}>
            <ArrowLeft className="size-4" />
            Benchmark
          </Link>

          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-4xl">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="gap-1">
                  <Columns3 className="size-3.5" />
                  Hidden side-by-side review
                </Badge>
                {!data.configured ? <Badge variant="destructive">Database not connected</Badge> : null}
                {data.run?.status ? <Badge variant="outline">{data.run.status}</Badge> : null}
              </div>

              <h1 className="text-3xl font-semibold tracking-normal md:text-4xl">
                {data.run?.title || "Prompt Benchmark Review"}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                {decodedRunId}
              </p>
            </div>

            <div className="flex flex-col gap-2 text-sm text-muted-foreground xl:items-end">
              <div className="inline-flex items-center gap-2 rounded-lg border bg-background/75 px-3 py-2">
                <Clock3 className="size-4 text-foreground" />
                Updated {formatMiamiDateTime(data.generatedAt)}
              </div>
              <div className="flex flex-wrap gap-2 xl:justify-end">
                {data.run?.sheet_url ? (
                  <a
                    href={data.run.sheet_url}
                    className={cn(buttonVariants({ variant: "outline" }), "w-fit")}
                  >
                    <ExternalLink className="size-4" />
                    Google Sheet
                  </a>
                ) : null}
                {data.run?.dashboard_url ? (
                  <a
                    href={data.run.dashboard_url}
                    className={cn(buttonVariants({ variant: "outline" }), "w-fit")}
                  >
                    <ExternalLink className="size-4" />
                    Summary page
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        {data.error ? <AlertPanel tone="destructive">{data.error}</AlertPanel> : null}
        {data.configured && !data.run ? (
          <AlertPanel tone="destructive">No benchmark run was found for this run ID.</AlertPanel>
        ) : null}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard title="Cases" value={cases.length} icon={<Target className="size-4" />} />
          <MetricCard title="Outputs" value={data.outputs.length} icon={<BarChart3 className="size-4" />} />
          <MetricCard title="Models" value={models.length} icon={<FlaskConical className="size-4" />} />
          <MetricCard
            title="Provider Calls"
            value={data.run?.total_provider_calls || data.costs.length}
            icon={<CheckCircle2 className="size-4" />}
          />
          <MetricCard
            title="Real Cost"
            value={currencyFormatter.format(data.run?.total_cost_usd || sumCosts(data.costs))}
            icon={<DollarSign className="size-4" />}
          />
        </section>

        {cases.length ? (
          <section className="space-y-4">
            {cases.map((caseGroup, index) => (
              <CaseReview
                key={caseGroup.caseId}
              caseGroup={caseGroup}
              costs={data.costs}
              models={models}
              productionOutput={caseGroup.productionOutput}
              defaultOpen={index === 0}
            />
          ))}
          </section>
        ) : (
          <AlertPanel>No benchmark outputs are available for this run yet.</AlertPanel>
        )}
      </div>
    </main>
  );
}

function CaseReview({
  caseGroup,
  costs,
  models,
  productionOutput,
  defaultOpen,
}: {
  caseGroup: CaseGroup;
  costs: PromptBenchmarkCost[];
  models: string[];
  productionOutput: JsonObject | null;
  defaultOpen: boolean;
}) {
  return (
    <details
      className="group rounded-xl border bg-card/95 shadow-xs"
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer list-none flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{caseGroup.caseType}</Badge>
            {caseGroup.expectedCallStatus ? (
              <Badge variant="outline">Expected {caseGroup.expectedCallStatus}</Badge>
            ) : null}
            <Badge variant="outline">{caseGroup.outputs.length} outputs</Badge>
          </div>
          <h2 className="mt-2 text-xl font-semibold tracking-normal">
            {caseGroup.caseLabel}
          </h2>
          <p className="mt-1 truncate text-xs text-muted-foreground">{caseGroup.caseId}</p>
        </div>
        <span className="text-sm font-medium text-primary group-open:hidden">Open transcript</span>
        <span className="hidden text-sm font-medium text-primary group-open:inline">Close transcript</span>
      </summary>

      <div className="border-t p-4">
        <div className="space-y-5">
          {caseGroup.configs.map((config, index) => (
            <ConfigReview
              key={config.key}
              config={config}
              costs={costs}
              models={models}
              productionOutput={productionOutput}
              defaultOpen={index === 0}
            />
          ))}
        </div>
      </div>
    </details>
  );
}

function ConfigReview({
  config,
  costs,
  models,
  productionOutput,
  defaultOpen,
}: {
  config: ConfigGroup;
  costs: PromptBenchmarkCost[];
  models: string[];
  productionOutput: JsonObject | null;
  defaultOpen: boolean;
}) {
  const outputByModel = new Map(config.outputs.map((output) => [output.model, output]));

  return (
    <details className="group rounded-lg border bg-background/70" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{config.callMode}</Badge>
          <Badge variant="secondary">{config.coachingMode}</Badge>
          <span className="text-sm text-muted-foreground">
            {config.outputs.length} model outputs
          </span>
        </div>
        <span className="text-sm font-medium text-primary group-open:hidden">Open config</span>
        <span className="hidden text-sm font-medium text-primary group-open:inline">Close config</span>
      </summary>

      <div className="border-t p-3">
        <div className={cn("grid gap-4", productionOutput ? "xl:grid-cols-4" : "xl:grid-cols-3")}>
          {productionOutput ? <ProductionReport output={productionOutput} /> : null}
          {models.map((model) => {
            const output = outputByModel.get(model);

            return output ? (
              <ModelReport key={model} output={output} costs={costsForOutput(output, costs)} />
            ) : (
              <MissingModelReport key={model} model={model} />
            );
          })}
        </div>
      </div>
    </details>
  );
}

function ModelReport({
  output,
  costs,
}: {
  output: PromptBenchmarkOutput;
  costs: PromptBenchmarkCost[];
}) {
  const report = extractReport(output.output);
  const evalObj = asObject(output.ai_eval);
  const hasError = costs.some((cost) => cost.error);
  const closeTitle = report.what_made_this_close_work ? "What Made This Close Work" : "Why No Close";
  const closeValue = report.what_made_this_close_work || report.why_no_close;

  return (
    <Card className="dashboard-card border bg-card/95">
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="truncate">{output.model}</CardTitle>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="outline">{output.provider}</Badge>
              <StatusBadge output={output} />
              {hasError ? <Badge variant="destructive">provider error</Badge> : null}
            </div>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <div className="font-medium text-foreground">{formatRating(output.overall_quality)}</div>
            <div>{currencyFormatter.format(output.total_cost_usd)}</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
          <MiniMetric label="Latency" value={formatMs(output.total_latency_ms)} />
          <MiniMetric label="Input" value={formatNumber(output.total_input_tokens)} />
          <MiniMetric label="Output" value={formatNumber(output.total_output_tokens)} />
        </div>

        <ReportSection title="Verdict" icon={<Lightbulb className="size-4" />} featured>
          <ReportValue value={report.one_line_verdict} />
        </ReportSection>
        <ReportSection title="Biggest Strength" icon={<Award className="size-4" />}>
          <ReportValue value={report.biggest_strength} />
        </ReportSection>
        <ReportSection title="What I'd Polish" icon={<PencilLine className="size-4" />}>
          <ReportValue value={report.what_id_polish} />
        </ReportSection>
        <ReportSection title="Coaching Tip" icon={<Target className="size-4" />}>
          <ReportValue value={report.coaching_tip} />
        </ReportSection>
        <ReportSection title="Rudy's Note" icon={<BookOpenText className="size-4" />}>
          <ReportValue value={report.rudys_note} />
        </ReportSection>
        <ReportSection title="What Went Well" icon={<Award className="size-4" />}>
          <ReportValue value={report.what_went_well} />
        </ReportSection>
        <ReportSection title="What To Improve" icon={<Wrench className="size-4" />}>
          <ReportValue value={report.what_to_improve} />
        </ReportSection>
        <ReportSection title={closeTitle} icon={<Target className="size-4" />}>
          <ReportValue value={closeValue} />
        </ReportSection>
        <ReportSection title="Winnability" icon={<CheckCircle2 className="size-4" />}>
          <ReportValue value={report.winnability} />
        </ReportSection>
        <ReportSection title="Objections Surfaced" icon={<MessageSquareText className="size-4" />}>
          <ReportValue value={report.objections_surfaced} />
        </ReportSection>

        <ComplianceSection compliance={report.compliance} />
        <EvalSection evalObj={evalObj} />
        <CostSection costs={costs} />
      </CardContent>
    </Card>
  );
}

function ProductionReport({ output }: { output: JsonObject }) {
  const report = extractReport(output);
  const closeTitle = report.what_made_this_close_work ? "What Made This Close Work" : "Why No Close";
  const closeValue = report.what_made_this_close_work || report.why_no_close;
  const reportLink = typeof output.report_doc_link === "string" ? output.report_doc_link : "";

  return (
    <Card className="dashboard-card border bg-card/95">
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="truncate">Current Production</CardTitle>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="outline">production</Badge>
              {output.call_status ? <Badge variant="secondary">{String(output.call_status)}</Badge> : null}
            </div>
          </div>
          {reportLink ? (
            <a href={reportLink} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}>
              <ExternalLink className="size-4" />
              Report
            </a>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ReportSection title="Verdict" icon={<History className="size-4" />} featured>
          <ReportValue value={report.one_line_verdict} />
        </ReportSection>
        <ReportSection title="Biggest Strength" icon={<Award className="size-4" />}>
          <ReportValue value={report.biggest_strength} />
        </ReportSection>
        <ReportSection title="What I'd Polish" icon={<PencilLine className="size-4" />}>
          <ReportValue value={report.what_id_polish} />
        </ReportSection>
        <ReportSection title="Coaching Tip" icon={<Target className="size-4" />}>
          <ReportValue value={report.coaching_tip} />
        </ReportSection>
        <ReportSection title="Rudy's Note" icon={<BookOpenText className="size-4" />}>
          <ReportValue value={report.rudys_note} />
        </ReportSection>
        <ReportSection title="What Went Well" icon={<Award className="size-4" />}>
          <ReportValue value={report.what_went_well} />
        </ReportSection>
        <ReportSection title="What To Improve" icon={<Wrench className="size-4" />}>
          <ReportValue value={report.what_to_improve} />
        </ReportSection>
        <ReportSection title={closeTitle} icon={<Target className="size-4" />}>
          <ReportValue value={closeValue} />
        </ReportSection>
        <ReportSection title="Objections Surfaced" icon={<MessageSquareText className="size-4" />}>
          <ReportValue value={report.objections_surfaced} />
        </ReportSection>
      </CardContent>
    </Card>
  );
}

function MissingModelReport({ model }: { model: string }) {
  return (
    <Card className="dashboard-card border border-dashed bg-card/80">
      <CardHeader className="border-b">
        <CardTitle>{model}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          No output was stored for this model/config pair.
        </div>
      </CardContent>
    </Card>
  );
}

function ComplianceSection({ compliance }: { compliance: JsonObject }) {
  const score = compliance.compliance_risk_score;

  return (
    <section className="rounded-lg border bg-background/70 p-4">
      <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-normal text-muted-foreground">
        <span className="grid size-7 place-items-center rounded-md border bg-card text-foreground">
          <AlertTriangle className="size-4" />
        </span>
        Compliance
      </h3>
      <div className="space-y-3 text-sm leading-7">
        <div className="flex flex-wrap gap-2">
          <Badge variant={Number(score || 0) > 0 ? "destructive" : "secondary"}>
            Risk {String(score ?? 0)}
          </Badge>
          <Badge variant="outline">
            {String(compliance.compliance_severity || "None")}
          </Badge>
          {compliance.compliance_category ? (
            <Badge variant="outline">{String(compliance.compliance_category)}</Badge>
          ) : null}
        </div>
        <LabeledValue label="Reason" value={compliance.compliance_reason} />
        <LabeledValue label="Red Flags" value={compliance.red_flags} />
        <LabeledValue label="Evidence" value={compliance.compliance_evidence} />
        <LabeledValue label="Related Sales Risk Notes" value={compliance.related_sales_risk_notes} />
      </div>
    </section>
  );
}

function EvalSection({ evalObj }: { evalObj: JsonObject }) {
  return (
    <section className="rounded-lg border bg-background/70 p-4">
      <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-normal text-muted-foreground">
        <span className="grid size-7 place-items-center rounded-md border bg-card text-foreground">
          <BarChart3 className="size-4" />
        </span>
        AI Eval
      </h3>
      <div className="space-y-3">
        <div className="grid gap-2">
          {evalKeys.map(([key, label]) => {
            const item = asObject(evalObj[key]);
            const rating = String(item.rating || "n/a");
            const note = String(item.note || "");

            return (
              <div key={key} className="rounded-md border bg-card/50 p-3">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium">{label}</span>
                  <RatingBadge rating={rating} />
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  {note || "No note provided."}
                </p>
              </div>
            );
          })}
        </div>
        <LabeledValue label="Eval Summary" value={evalObj.eval_summary} />
      </div>
    </section>
  );
}

function CostSection({ costs }: { costs: PromptBenchmarkCost[] }) {
  return (
    <section className="rounded-lg border bg-background/70 p-4">
      <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-normal text-muted-foreground">
        <span className="grid size-7 place-items-center rounded-md border bg-card text-foreground">
          <DollarSign className="size-4" />
        </span>
        Cost Log
      </h3>
      {costs.length ? (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Purpose</TableHead>
                <TableHead className="text-right">Input</TableHead>
                <TableHead className="text-right">Output</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Latency</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {costs.map((cost) => (
                <TableRow key={cost.cost_id}>
                  <TableCell>
                    <div className="grid gap-1">
                      <span>{cost.call_purpose}</span>
                      {cost.error ? <span className="text-xs text-destructive">{cost.error}</span> : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(cost.input_tokens + cost.cache_creation_input_tokens + cost.cache_read_input_tokens)}
                  </TableCell>
                  <TableCell className="text-right">{formatNumber(cost.output_tokens)}</TableCell>
                  <TableCell className="text-right">{currencyFormatter.format(cost.total_cost_usd)}</TableCell>
                  <TableCell className="text-right">{formatMs(cost.latency_ms)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No provider cost rows were stored for this output.</p>
      )}
    </section>
  );
}

function ReportSection({
  title,
  icon,
  children,
  featured = false,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  featured?: boolean;
}) {
  return (
    <section
      className={cn(
        "rounded-lg border bg-background/70 p-4",
        featured && "border-primary/20 bg-primary/5",
      )}
    >
      <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-normal text-muted-foreground">
        <span className="grid size-7 place-items-center rounded-md border bg-card text-foreground">
          {icon}
        </span>
        {title}
      </h3>
      <div className="text-sm leading-7 text-foreground">{children}</div>
    </section>
  );
}

function LabeledValue({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="border-l-2 border-primary/25 pl-3">
      <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">{label}</div>
      <ReportValue value={value} />
    </div>
  );
}

function ReportValue({ value }: { value: unknown }) {
  if (isEmptyValue(value)) {
    return <p className="text-sm text-muted-foreground">Not provided</p>;
  }

  if (Array.isArray(value)) {
    if (!value.length) return <p className="text-sm text-muted-foreground">Not provided</p>;
    if (value.every((item) => typeof item !== "object" || item === null)) {
      return <BulletList items={value.map((item) => String(item))} />;
    }

    return (
      <div className="space-y-3">
        {value.map((item, index) => (
          <div key={index} className="rounded-md border bg-card/50 p-3">
            <ReportValue value={item} />
          </div>
        ))}
      </div>
    );
  }

  if (isRecord(value)) return <JsonSection value={value} />;

  if (typeof value === "string") {
    return <JsonSection value={value} />;
  }

  return <p className="leading-7">{String(value)}</p>;
}

function StatusBadge({ output }: { output: PromptBenchmarkOutput }) {
  const agreed = output.expected_call_status
    ? output.call_status === output.expected_call_status
    : output.classification_agreed !== false;

  return (
    <Badge variant={agreed ? "secondary" : "destructive"}>
      {output.call_status || "unknown"}
    </Badge>
  );
}

function RatingBadge({ rating }: { rating: string }) {
  const normalized = rating.toLowerCase();
  const variant = normalized === "pass" ? "secondary" : normalized === "fail" ? "destructive" : "outline";

  return <Badge variant={variant}>{rating}</Badge>;
}

function MetricCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: number | string;
  icon: ReactNode;
}) {
  return (
    <Card className="dashboard-card border bg-card/95">
      <CardContent className="flex items-start justify-between gap-3 pt-1">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-2 text-2xl font-semibold tracking-normal">
            {typeof value === "number" ? formatNumber(value) : value}
          </p>
        </div>
        <span className="grid size-9 shrink-0 place-items-center rounded-lg border bg-background text-primary">
          {icon}
        </span>
      </CardContent>
    </Card>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background/70 p-2">
      <div className="text-[0.7rem] uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium text-foreground">{value}</div>
    </div>
  );
}

function AlertPanel({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "destructive" }) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card/95 p-4 text-sm",
        tone === "destructive" && "border-destructive/30 bg-destructive/10 text-destructive",
      )}
    >
      {children}
    </div>
  );
}

function buildCaseGroups(
  outputs: PromptBenchmarkOutput[],
  productionOutputs: Map<string, JsonObject>,
): CaseGroup[] {
  const caseMap = new Map<string, PromptBenchmarkOutput[]>();

  for (const output of outputs) {
    const existing = caseMap.get(output.case_id) || [];
    existing.push(output);
    caseMap.set(output.case_id, existing);
  }

  return Array.from(caseMap.entries())
    .map(([caseId, caseOutputs]) => {
      const sortedOutputs = [...caseOutputs].sort(sortOutputs);
      const first = sortedOutputs[0];
      const configMap = new Map<string, PromptBenchmarkOutput[]>();

      for (const output of sortedOutputs) {
        const key = `${output.call_mode} / ${output.coaching_mode}`;
        const existing = configMap.get(key) || [];
        existing.push(output);
        configMap.set(key, existing);
      }

      return {
        caseId,
        caseLabel: first?.case_label || caseId,
        caseType: first?.case_type || "scored",
        expectedCallStatus: first?.expected_call_status || null,
        productionOutput: productionOutputs.get(caseId) || null,
        outputs: sortedOutputs,
        configs: Array.from(configMap.entries())
          .map(([key, configOutputs]) => ({
            key,
            callMode: configOutputs[0]?.call_mode || "",
            coachingMode: configOutputs[0]?.coaching_mode || "",
            outputs: configOutputs.sort(sortOutputs),
            models: getOrderedModels(configOutputs),
          }))
          .sort(sortConfigs),
      };
    })
    .sort((a, b) => a.caseLabel.localeCompare(b.caseLabel));
}

function sortOutputs(a: PromptBenchmarkOutput, b: PromptBenchmarkOutput) {
  return (
    compareConfig(a.call_mode, b.call_mode, "one-call", "two-call") ||
    compareConfig(a.coaching_mode, b.coaching_mode, "single-stage", "two-stage") ||
    modelIndex(a.model) - modelIndex(b.model) ||
    a.model.localeCompare(b.model)
  );
}

function sortConfigs(a: ConfigGroup, b: ConfigGroup) {
  return (
    compareConfig(a.callMode, b.callMode, "one-call", "two-call") ||
    compareConfig(a.coachingMode, b.coachingMode, "single-stage", "two-stage")
  );
}

function compareConfig(valueA: string, valueB: string, first: string, second: string) {
  const order = new Map([
    [first, 0],
    [second, 1],
  ]);

  return (order.get(valueA) ?? 99) - (order.get(valueB) ?? 99);
}

function getOrderedModels(outputs: PromptBenchmarkOutput[]) {
  const seen = new Set(outputs.map((output) => output.model));
  const ordered = modelOrder.filter((model) => seen.has(model));
  const extras = Array.from(seen)
    .filter((model) => !modelOrder.includes(model))
    .sort((a, b) => a.localeCompare(b));

  return [...ordered, ...extras];
}

function modelIndex(model: string) {
  const index = modelOrder.indexOf(model);
  return index === -1 ? 99 : index;
}

function costsForOutput(output: PromptBenchmarkOutput, costs: PromptBenchmarkCost[]) {
  const byResultId = costs.filter((cost) => cost.result_id === output.result_id);
  if (byResultId.length) return byResultId;

  return costs.filter(
    (cost) =>
      cost.case_id === output.case_id &&
      cost.model === output.model &&
      cost.provider === output.provider,
  );
}

function extractReport(output: JsonObject) {
  const coaching = asObject(output.coaching);
  const slack = asObject(coaching.slack);
  const top = asObject(slack.top_level_post);
  const thread = asObject(slack.thread_reply);
  const scorecard = asObject(asObject(output.airtable).scorecard_record);
  const compliance = asObject(output.compliance);

  return {
    one_line_verdict: top.one_line_verdict ?? scorecard.one_line_verdict ?? output.one_line_verdict,
    biggest_strength: top.biggest_strength ?? scorecard.biggest_strength ?? output.biggest_strength,
    what_id_polish:
      top.what_id_polish ??
      scorecard.what_id_polish ??
      scorecard.biggest_fix ??
      output.what_id_polish ??
      output.biggest_fix,
    coaching_tip: top.coaching_tip ?? scorecard.coaching_tip ?? output.coaching_tip,
    what_went_well: thread.what_went_well ?? scorecard.what_went_well ?? output.what_went_well,
    what_to_improve: thread.what_to_improve ?? scorecard.what_to_improve ?? output.what_to_improve,
    why_no_close: thread.why_no_close ?? scorecard.why_no_close ?? output.why_no_close,
    what_made_this_close_work:
      thread.what_made_this_close_work ??
      scorecard.what_made_this_close_work ??
      output.what_made_this_close_work,
    objections_surfaced:
      thread.objections_surfaced ?? scorecard.objections_surfaced ?? output.objections_surfaced,
    winnability: thread.winnability ?? scorecard.winnability,
    rudys_note: thread.rudys_note ?? scorecard.rudys_note ?? output.rudys_note,
    compliance,
  };
}

function getProductionOutputs(sourcePayload: JsonObject | null | undefined) {
  const source = asObject(sourcePayload);
  const rawOutputs = asObject(source.production_outputs);
  const outputMap = new Map<string, JsonObject>();

  for (const [caseId, value] of Object.entries(rawOutputs)) {
    if (isRecord(value)) outputMap.set(caseId, value);
  }

  return outputMap;
}

function asObject(value: unknown): JsonObject {
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isEmptyValue(value: unknown) {
  if (value === null || value === undefined) return true;
  if (typeof value === "string" && !value.trim()) return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (isRecord(value) && Object.keys(value).length === 0) return true;
  return false;
}

function sumCosts(costs: PromptBenchmarkCost[]) {
  return costs.reduce((sum, cost) => sum + cost.total_cost_usd, 0);
}

function formatNumber(value: number) {
  return numberFormatter.format(Math.round(value || 0));
}

function formatRating(value: number | null) {
  if (value === null || value === undefined) return "n/a";
  return `${value.toFixed(1)}/5`;
}

function formatMs(value: number) {
  if (!value) return "n/a";
  return `${numberFormatter.format(Math.round(value))} ms`;
}
