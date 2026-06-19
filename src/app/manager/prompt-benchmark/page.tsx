import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, Clock3, Columns3, DollarSign, ExternalLink, FlaskConical, Layers3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getPromptBenchmarkData } from "@/lib/db";
import { formatMiamiDateTime, truncate } from "@/lib/format";
import type {
  PromptBenchmarkCost,
  PromptBenchmarkDecisionRow,
  PromptBenchmarkOutput,
  PromptBenchmarkRun,
} from "@/lib/types";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Prompt Benchmark | Magic Mike Bot",
  robots: {
    index: false,
    follow: false,
  },
};

const numberFormatter = new Intl.NumberFormat("en-US");
const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 4,
});

export default async function PromptBenchmarkPage() {
  const data = await getPromptBenchmarkData();
  const latestSheet = data.runs.find((run) => run.sheet_url)?.sheet_url;

  return (
    <main className="dashboard-page min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
        <header className="dashboard-card dashboard-hero rounded-2xl border bg-card/95 p-5 md:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="gap-1">
                  <FlaskConical className="size-3.5" />
                  Hidden benchmark view
                </Badge>
                {!data.configured ? <Badge variant="destructive">Database not connected</Badge> : null}
              </div>
              <h1 className="text-3xl font-semibold tracking-normal md:text-4xl">
                Magic Mike Prompt Benchmark
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Isolated test results for prompt/model/config comparisons. Production reports and workflows are not mixed into this view.
              </p>
            </div>

            <div className="flex flex-col gap-2 text-sm text-muted-foreground lg:items-end">
              <div className="inline-flex items-center gap-2 rounded-lg border bg-background/75 px-3 py-2">
                <Clock3 className="size-4 text-foreground" />
                Updated {formatMiamiDateTime(data.generatedAt)}
              </div>
              <div className="flex flex-wrap gap-2 lg:justify-end">
                <Link
                  href="/manager/prompt-benchmark/submit"
                  className={cn(buttonVariants({ variant: "outline" }), "w-fit")}
                >
                  Run manual test
                </Link>
                {latestSheet ? (
                  <a
                    href={latestSheet}
                    className={cn(buttonVariants({ variant: "default" }), "w-fit")}
                  >
                    <ExternalLink className="size-4" />
                    Open latest sheet
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        {data.error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {data.error}
          </div>
        ) : null}

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard title="Runs" value={data.totals.runs} description="Benchmark runs stored" icon={Layers3} />
          <MetricCard title="Outputs" value={data.totals.outputs} description="Model/config outputs" icon={BarChart3} />
          <MetricCard title="Provider calls" value={data.totals.provider_calls} description="Tracked cost rows" icon={FlaskConical} />
          <MetricCard
            title="Total cost"
            value={currencyFormatter.format(data.totals.total_cost_usd)}
            description="Real provider cost tracked"
            icon={DollarSign}
          />
        </section>

        <DecisionCard rows={data.decisionRows} />

        <section className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <RunsCard runs={data.runs} />
          <OutputsCard outputs={data.outputs} />
        </section>

        <CostsCard costs={data.costs} />
      </div>
    </main>
  );
}

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: number | string;
  description: string;
  icon: typeof BarChart3;
}) {
  return (
    <Card className="dashboard-card border bg-card/95">
      <CardContent className="flex items-start justify-between gap-3 pt-1">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-semibold tracking-normal">
            {typeof value === "number" ? formatNumber(value) : value}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <span className="grid size-9 shrink-0 place-items-center rounded-lg border bg-background text-primary">
          <Icon className="size-4" />
        </span>
      </CardContent>
    </Card>
  );
}

function DecisionCard({ rows }: { rows: PromptBenchmarkDecisionRow[] }) {
  return (
    <Card className="dashboard-card border bg-card/95">
      <CardHeader className="border-b">
        <CardTitle>Decision View</CardTitle>
        <CardDescription>One row per model/config. This is the fastest place to compare quality, gate agreement, latency, and cost.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Model</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead className="text-right">Outputs</TableHead>
              <TableHead className="text-right">Quality</TableHead>
              <TableHead className="text-right">Gate agree</TableHead>
              <TableHead className="text-right">Core pass</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-right">Latency</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length ? (
              rows.map((row) => (
                <TableRow key={`${row.model}-${row.call_mode}-${row.coaching_mode}`}>
                  <TableCell className="font-medium">{row.model}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline">{row.call_mode}</Badge>
                      <Badge variant="secondary">{row.coaching_mode}</Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{row.output_count}</TableCell>
                  <TableCell className="text-right">{formatRating(row.avg_overall_quality)}</TableCell>
                  <TableCell className="text-right">{formatPercent(row.classification_agreement_rate)}</TableCell>
                  <TableCell className="text-right">{formatPercent(row.pass_rate_core_criteria)}</TableCell>
                  <TableCell className="text-right">{currencyFormatter.format(row.total_cost_usd)}</TableCell>
                  <TableCell className="text-right">{formatMs(row.avg_latency_ms)}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                  No benchmark outputs have been ingested yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function RunsCard({ runs }: { runs: PromptBenchmarkRun[] }) {
  return (
    <Card className="dashboard-card border bg-card/95">
      <CardHeader className="border-b">
        <CardTitle>Recent Runs</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Run</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead>Finished</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.length ? runs.map((run) => (
              <TableRow key={run.run_id}>
                <TableCell>
                  <div className="max-w-72">
                    <div className="font-medium">{run.title || run.run_id}</div>
                    <div className="truncate text-xs text-muted-foreground">{run.run_id}</div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <Link
                        className="inline-flex items-center gap-1 text-xs text-primary underline-offset-4 hover:underline"
                        href={`/manager/prompt-benchmark/review/${encodeURIComponent(run.run_id)}`}
                      >
                        <Columns3 className="size-3" />
                        Review
                      </Link>
                      {run.sheet_url ? (
                        <a className="text-xs text-primary underline-offset-4 hover:underline" href={run.sheet_url}>
                          Google Sheet
                        </a>
                      ) : null}
                    </div>
                  </div>
                </TableCell>
                <TableCell><Badge variant="outline">{run.status}</Badge></TableCell>
                <TableCell className="text-right">{currencyFormatter.format(run.total_cost_usd)}</TableCell>
                <TableCell>{formatMiamiDateTime(run.finished_at || run.updated_at)}</TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                  No runs yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function OutputsCard({ outputs }: { outputs: PromptBenchmarkOutput[] }) {
  return (
    <Card className="dashboard-card border bg-card/95">
      <CardHeader className="border-b">
        <CardTitle>Output Library</CardTitle>
        <CardDescription>Latest 250 outputs. Open a run review for side-by-side model comparison.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Case</TableHead>
              <TableHead>Config</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Quality</TableHead>
              <TableHead className="text-right">Cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {outputs.length ? outputs.map((output) => (
              <TableRow key={output.result_id}>
                <TableCell>
                  <div className="max-w-72">
                    <div className="font-medium">{truncate(output.case_label || output.case_id, 64)}</div>
                    <div className="truncate text-xs text-muted-foreground">{output.case_id}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="grid gap-1">
                    <span className="font-medium">{output.model}</span>
                    <span className="text-xs text-muted-foreground">{output.call_mode} / {output.coaching_mode}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="grid gap-1">
                    <Badge variant={output.call_status === output.expected_call_status ? "secondary" : "outline"}>
                      {output.call_status || "unknown"}
                    </Badge>
                    {output.classification_agreed === false ? (
                      <span className="text-xs text-destructive">classification mismatch</span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="text-right">{formatRating(output.overall_quality)}</TableCell>
                <TableCell className="text-right">{currencyFormatter.format(output.total_cost_usd)}</TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  No outputs yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function CostsCard({ costs }: { costs: PromptBenchmarkCost[] }) {
  return (
    <Card className="dashboard-card border bg-card/95">
      <CardHeader className="border-b">
        <CardTitle>Provider Cost Log</CardTitle>
        <CardDescription>One row per AI call, including eval and analysis calls.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Provider</TableHead>
              <TableHead>Purpose</TableHead>
              <TableHead className="text-right">Input</TableHead>
              <TableHead className="text-right">Output</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-right">Latency</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {costs.length ? costs.map((cost) => (
              <TableRow key={cost.cost_id}>
                <TableCell>
                  <div className="grid gap-1">
                    <span className="font-medium">{cost.model}</span>
                    <span className="text-xs text-muted-foreground">{cost.provider}</span>
                  </div>
                </TableCell>
                <TableCell>{cost.call_purpose}</TableCell>
                <TableCell className="text-right">{formatNumber(cost.input_tokens + cost.cache_creation_input_tokens + cost.cache_read_input_tokens)}</TableCell>
                <TableCell className="text-right">{formatNumber(cost.output_tokens)}</TableCell>
                <TableCell className="text-right">{currencyFormatter.format(cost.total_cost_usd)}</TableCell>
                <TableCell className="text-right">{formatMs(cost.latency_ms)}</TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  No cost rows yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function formatNumber(value: number) {
  return numberFormatter.format(Math.round(value || 0));
}

function formatRating(value: number | null) {
  if (value === null || value === undefined) return "n/a";
  return value.toFixed(2);
}

function formatPercent(value: number | null) {
  if (value === null || value === undefined) return "n/a";
  return `${Math.round(value * 100)}%`;
}

function formatMs(value: number) {
  if (!value) return "n/a";
  return `${numberFormatter.format(Math.round(value))} ms`;
}
