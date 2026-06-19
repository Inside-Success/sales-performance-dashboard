import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FlaskConical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { PromptBenchmarkSubmitForm } from "@/components/dashboard/prompt-benchmark-submit-form";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Run Prompt Benchmark | Magic Mike Bot",
  robots: {
    index: false,
    follow: false,
  },
};

export default function PromptBenchmarkSubmitPage() {
  return (
    <main className="dashboard-page min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
        <header className="dashboard-card dashboard-hero rounded-2xl border bg-card/95 p-5 md:p-6">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Link href="/manager/prompt-benchmark" className={cn(buttonVariants({ variant: "ghost" }), "px-0")}>
              <ArrowLeft className="size-4" />
              Benchmark results
            </Link>
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <FlaskConical className="size-3.5" />
              Isolated prompt test
            </Badge>
          </div>
          <h1 className="text-3xl font-semibold tracking-normal md:text-4xl">
            Run a manual benchmark
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Paste a transcript or Zoom recording link to run the isolated Magic Mike prompt matrix against one ad-hoc case.
          </p>
        </header>

        <section className="dashboard-card rounded-2xl border bg-card/95 p-4 md:p-5">
          <PromptBenchmarkSubmitForm />
        </section>
      </div>
    </main>
  );
}
