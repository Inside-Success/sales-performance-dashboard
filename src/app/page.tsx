import Link from "next/link";
import { ArrowRight, MessageCircleQuestion, Sparkles, Target } from "lucide-react";
import { TrackUsageEvent } from "@/components/dashboard/usage-tracker";

export const dynamic = "force-dynamic";

const tools = [
  {
    href: "/coaching",
    icon: Target,
    eyebrow: "Coaching",
    title: "Know exactly why you won — or lost.",
    description: "Call-by-call feedback that shows what to fix and how to close more.",
    cta: "Open Coaching",
    beta: false,
  },
  {
    href: "/ask-sales-faq",
    icon: MessageCircleQuestion,
    eyebrow: "Ask Sales FAQ",
    title: "Get the approved answer, mid-call.",
    description: "Fast, approved answers to your sales questions while you're live on a call.",
    cta: "Open Ask Sales FAQ",
    beta: true,
  },
];

export default function HomeHub() {
  return (
    <main className="magic-page flex min-h-[calc(100dvh-72px)] flex-1 flex-col">
      <TrackUsageEvent eventName="dashboard_home_viewed" eventData={{ source: "product_hub" }} />
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-5 pb-16 sm:px-8">
        <section className="mx-auto max-w-3xl pt-14 text-center sm:pt-20">
          <span className="magic-kicker">
            <Sparkles className="size-3.5" />
            Two tools · One job
          </span>
          <h1 className="mt-5 text-[42px] font-extrabold leading-[1.02] tracking-tight text-slate-900 sm:text-[64px]">
            Your edge on every call<span className="text-[#DC2626]">.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-[17px] font-medium leading-[1.8] text-slate-500 sm:text-[18px]">
            Call-by-call coaching after you hang up. Approved answers while you&apos;re live.
          </p>
        </section>

        <section className="mx-auto mt-11 grid w-full max-w-4xl gap-5 sm:mt-14 md:grid-cols-2" aria-label="Magic Mike tools">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link
                key={tool.href}
                href={tool.href}
                className="group flex h-full flex-col rounded-[22px] border border-black/[0.05] bg-white p-8 shadow-[0_1px_2px_rgba(17,17,26,.035),0_5px_18px_-10px_rgba(17,17,26,.09),0_22px_48px_-28px_rgba(17,17,26,.12)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_2px_6px_rgba(17,17,26,.05),0_18px_48px_-16px_rgba(17,17,26,.22)] sm:p-10"
              >
                <span className="magic-brand-mark grid size-14 place-items-center rounded-2xl text-white transition-transform duration-300 group-hover:scale-[1.05]">
                  <Icon className="size-7" strokeWidth={2.2} />
                </span>
                <span className="mt-7 flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{tool.eyebrow}</span>
                  {tool.beta ? <span className="rounded-full bg-[#FEF2F2] px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-[#B91C1C]">Beta</span> : null}
                </span>
                <span className="mt-2.5 block text-[23px] font-extrabold leading-[1.15] tracking-tight text-slate-900 sm:text-[25px]">{tool.title}</span>
                <span className="mt-3 block max-w-sm text-[15px] font-medium leading-[1.7] text-slate-500">{tool.description}</span>
                <span className="mt-8 inline-flex items-center gap-2 pt-1 text-[15px] font-bold text-[#DC2626] sm:mt-auto sm:pt-8">
                  {tool.cta}
                  <ArrowRight className="size-4.5 transition-transform duration-300 group-hover:translate-x-1" strokeWidth={2.6} />
                </span>
              </Link>
            );
          })}
        </section>
      </div>
      <p className="pb-7 text-center text-[13px] font-medium text-slate-400">Inside Success TV · One login, both tools</p>
    </main>
  );
}
