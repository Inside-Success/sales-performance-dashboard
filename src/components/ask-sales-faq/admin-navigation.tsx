import Link from "next/link";
import type { ReactNode } from "react";
import { Activity, ArrowLeft, BarChart3, Clock3, RefreshCw, ShieldCheck } from "lucide-react";
import { formatMiamiDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export function AskSalesAdminHeader({
  active,
  title,
  description,
  generatedAt,
}: {
  active: "quality" | "usage" | "refresh";
  title: string;
  description: string;
  generatedAt: string;
}) {
  return (
    <>
      <header className="magic-card magic-hero p-5 md:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <span className="magic-kicker">
              <ShieldCheck className="size-3.5" />
              Ask Sales admin only
            </span>
            <h1 className="mt-3 text-[34px] font-extrabold leading-tight tracking-normal text-slate-950 md:text-[44px]">
              {title}
            </h1>
            <p className="mt-3 max-w-2xl text-[15px] font-medium leading-7 text-slate-500">{description}</p>
          </div>

          <div className="flex flex-col gap-2 text-sm text-slate-500 lg:items-end">
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-2">
              <Clock3 className="size-4 text-[#DC2626]" />
              Updated {formatMiamiDateTime(generatedAt)}
            </span>
            <Link
              href="/ask-sales-faq"
              className="inline-flex h-9 w-fit items-center gap-2 rounded-full border border-slate-200 bg-white px-3 font-semibold text-slate-700 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700"
            >
              <ArrowLeft className="size-4" />
              Back to chat
            </Link>
          </div>
        </div>
      </header>

      <nav className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm sm:grid-cols-3" aria-label="Ask Sales administration">
        <AdminNavLink
          active={active === "quality"}
          href="/ask-sales-faq/admin"
          icon={<Activity className="size-4" />}
          title="Quality & operations"
          description="Answer quality, routes, feedback, and runtime health"
        />
        <AdminNavLink
          active={active === "usage"}
          href="/ask-sales-faq/admin/usage"
          icon={<BarChart3 className="size-4" />}
          title="Rep adoption"
          description="Activation, repeat usage, and rep-level activity"
        />
        <AdminNavLink
          active={active === "refresh"}
          href="/ask-sales-faq/admin/knowledge-refresh"
          icon={<RefreshCw className="size-4" />}
          title="Source updates"
          description="Slack and Google changes awaiting human review"
        />
      </nav>
    </>
  );
}

function AdminNavLink({
  active,
  href,
  icon,
  title,
  description,
}: {
  active: boolean;
  href: string;
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors",
        active
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50",
      )}
    >
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", active ? "bg-white text-red-600" : "bg-slate-100 text-slate-500")}>
        {icon}
      </span>
      <span>
        <span className="block text-sm font-extrabold">{title}</span>
        <span className="mt-0.5 block text-xs font-medium text-slate-500">{description}</span>
      </span>
    </Link>
  );
}
