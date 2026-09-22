import Link from "next/link";
import { TrackUsageEvent } from "@/components/dashboard/usage-tracker";

export const dynamic = "force-dynamic";

const tools = [
  { href: "/coaching", title: "Casting Manager AI Coach" },
  { href: "/ask-sales-faq", title: "Sales FAQ chatbot" },
];

const steps = ["Review", "Reflect", "Adjust", "Sell More"];

export default function HomeHub() {
  return (
    <main className="magic-page flex flex-1 flex-col" style={{ minHeight: 0 }}>
      <TrackUsageEvent eventName="dashboard_home_viewed" eventData={{ source: "product_hub" }} />
      <div className="mx-auto w-full max-w-5xl px-5 py-14 sm:px-8 sm:py-20 lg:py-24">
        <section className="mx-auto text-center" aria-labelledby="welcome-heading">
          <h1
            id="welcome-heading"
            className="text-balance text-[32px] font-extrabold leading-[1.12] tracking-[-0.045em] text-slate-900 sm:text-[52px] lg:text-[64px]"
          >
            <span className="block">Elite Closers/Athletes</span>
            <span className="block">Study The Film<span className="text-[#DC2626]">.</span></span>
          </h1>
          <ol className="mt-7 flex flex-wrap justify-center gap-x-5 gap-y-2 text-[14px] font-medium text-slate-600 sm:mt-8 sm:gap-x-8 sm:text-[17px]" aria-label="Your daily practice">
            {steps.map((step, index) => (
              <li key={step} className="whitespace-nowrap">
                <span className="mr-1.5 text-[#B91C1C]" aria-hidden="true">{index + 1}.</span>
                {step}
              </li>
            ))}
          </ol>
        </section>

        <nav className="mx-auto mt-10 grid w-full max-w-4xl gap-4 sm:mt-14 sm:gap-5 md:grid-cols-2" aria-label="Magic Mike tools">
          {tools.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className="flex min-h-28 items-center justify-center rounded-[22px] border border-black/[0.06] bg-white px-6 py-8 text-center text-[21px] font-bold leading-snug tracking-tight text-slate-900 shadow-[0_2px_6px_rgba(17,17,26,.025),0_16px_40px_-24px_rgba(17,17,26,.16)] transition-[transform,box-shadow,border-color,color] duration-200 hover:border-red-200 hover:text-[#B91C1C] hover:shadow-[0_4px_12px_rgba(17,17,26,.04),0_20px_44px_-22px_rgba(17,17,26,.2)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#DC2626] motion-safe:hover:-translate-y-0.5 motion-reduce:transition-none sm:min-h-40 sm:px-8 sm:text-[24px]"
            >
              {tool.title}
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}
