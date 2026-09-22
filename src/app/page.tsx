import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";
import { TrackUsageEvent } from "@/components/dashboard/usage-tracker";

export const dynamic = "force-dynamic";

const tools = [
  { href: "/coaching", title: "Casting Manager", subtitle: "AI Coach" },
  { href: "/ask-sales-faq", title: "Sales FAQ", subtitle: "chatbot" },
];
const steps = ["Review", "Reflect", "Adjust", "Sell More"];

export default function HomeHub() {
  return (
    <main className="magic-page flex flex-1 flex-col" style={{ minHeight: 0 }}>
      <TrackUsageEvent eventName="dashboard_home_viewed" eventData={{ source: "product_hub" }} />
      <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-12 lg:py-14">
        <section className="magic-card magic-hero isolate px-4 py-10 text-center sm:px-10 sm:py-14" aria-labelledby="welcome-heading">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_0%,rgba(220,38,38,0.06),transparent_65%)]" />
          <h1 id="welcome-heading" className="font-extrabold tracking-tight text-slate-900">
            <span className="block text-[23px] leading-snug sm:text-[34px]">Elite Closers/Athletes</span>
            <span className="mt-2 block text-[38px] leading-[1.1] tracking-[-0.045em] sm:mt-3 sm:text-[64px]">Study The Film<span className="text-[#DC2626]">.</span></span>
          </h1>
          <ol className="mx-auto mt-8 flex max-w-xl items-center justify-between gap-1 rounded-2xl border border-slate-200/80 bg-white/80 px-3 py-3 text-[12px] font-semibold text-slate-600 sm:mt-10 sm:px-6 sm:py-4 sm:text-[16px]" aria-label="Your daily practice">
            {steps.map((step, index) => (
              <li key={step} className="flex items-center gap-1 sm:gap-5">
                <span className={index === steps.length - 1 ? "whitespace-nowrap text-[#B91C1C]" : "whitespace-nowrap"}>{step}</span>
                {index < steps.length - 1 ? <ChevronRight aria-hidden="true" className="size-3 shrink-0 text-slate-300 sm:size-4" /> : null}
              </li>
            ))}
          </ol>
        </section>

        <nav className="mt-5 grid gap-4 sm:mt-6 sm:gap-6 md:grid-cols-2" aria-label="Magic Mike tools">
          {tools.map((tool) => (
            <Link key={tool.href} href={tool.href} className="magic-card group relative flex min-h-36 items-center justify-between gap-4 overflow-hidden px-6 py-7 transition-[border-color,box-shadow,transform] duration-200 hover:border-red-200 hover:shadow-[0_16px_40px_-16px_rgba(185,28,28,.18)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#DC2626] motion-safe:hover:-translate-y-1 motion-reduce:transition-none sm:min-h-48 sm:px-9 sm:py-9">
              <span aria-hidden="true" className="absolute inset-y-8 left-0 w-1 rounded-r-full bg-[#DC2626]" />
              <span className="text-[23px] font-bold leading-[1.3] tracking-tight text-slate-900 sm:text-[28px]">
                <span className="block">{tool.title}</span>{" "}
                <span className="block text-[#B91C1C]">{tool.subtitle}</span>
              </span>
              <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full border border-red-100 bg-red-50 text-[#B91C1C] transition-colors duration-200 group-hover:border-[#DC2626] group-hover:bg-[#DC2626] group-hover:text-white sm:size-12">
                <ArrowRight className="size-5 transition-transform duration-200 motion-safe:group-hover:translate-x-0.5 motion-reduce:transition-none" />
              </span>
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}
