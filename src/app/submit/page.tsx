import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { ManualSubmitForm } from "@/components/dashboard/manual-submit-form";
import { TrackUsageEvent } from "@/components/dashboard/usage-tracker";
import { isManualFeedbackEnabled } from "@/lib/manual-reports";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default function SubmitPage() {
  if (!isManualFeedbackEnabled()) notFound();

  return (
    <main className="magic-page">
      <TrackUsageEvent eventName="manual_submit_opened" eventData={{ source: "manual_submit" }} />
      <div className="magic-container flex max-w-5xl flex-col gap-6">
        <header className="magic-card magic-hero p-5 md:p-8">
          <div className="relative">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Link
                href="/"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "rounded-full px-0 text-slate-500 hover:text-[#B91C1C]")}
              >
                <ArrowLeft className="size-4" />
                Home
              </Link>
              <Link
                href="/manual-reports"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9 rounded-full border-slate-200 bg-white px-4")}
              >
                <FileText className="size-4" />
                Self-submitted reports
              </Link>
            </div>
            <span className="magic-kicker">
              <Sparkles className="size-3.5" />
              Self-submitted feedback
            </span>
            <h1 className="mt-4 max-w-3xl text-[38px] font-extrabold leading-[1.05] tracking-normal text-slate-950 md:text-[52px]">
              Get Magic Mike coaching on a sales call.
            </h1>
            <p className="mt-5 max-w-2xl text-[17px] font-medium leading-8 text-slate-500">
              Submit one closing-stage conversation and Magic Mike will turn it into a focused coaching report under your name.
            </p>
            <div className="mt-6 max-w-2xl rounded-[22px] border border-red-100 bg-[#FEF2F2] p-4">
              <p className="text-sm font-semibold leading-6 text-[#991B1B]">
                Best for Call 2 or later, real prospect conversations, and calls where you want sharper closing feedback.
              </p>
            </div>
          </div>
        </header>

        <section className="magic-card p-4 md:p-6">
          <ManualSubmitForm />
        </section>
      </div>
    </main>
  );
}
