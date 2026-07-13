"use client";

import Link from "next/link";
import { MessageCircleQuestion, Target } from "lucide-react";
import { cn } from "@/lib/utils";

export function ToolSwitcher({ active }: { active: "coaching" | "faq" }) {
  const tools = [
    { id: "coaching" as const, href: "/coaching", label: "Coaching", shortLabel: "Coaching", icon: Target },
    { id: "faq" as const, href: "/ask-sales-faq", label: "Ask Sales FAQ", shortLabel: "FAQ", icon: MessageCircleQuestion },
  ];

  return (
    <nav aria-label="Switch tools" className="flex shrink-0 items-center rounded-full bg-slate-100/80 p-1 ring-1 ring-slate-200/70">
      {tools.map((tool) => {
        const Icon = tool.icon;
        const selected = active === tool.id;

        return (
          <Link
            key={tool.id}
            href={tool.href}
            aria-current={selected ? "page" : undefined}
            className={cn(
              "inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-2.5 text-xs font-bold transition-colors sm:px-3",
              selected ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-900",
            )}
          >
            <Icon className={cn("hidden size-3.5 sm:block", selected ? "text-[#DC2626]" : "text-slate-400")} />
            <span className="hidden xl:inline">{tool.label}</span>
            <span className="xl:hidden">{tool.shortLabel}</span>
            {tool.id === "faq" ? (
              <span className="hidden rounded-full bg-red-50 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-red-700 sm:inline">
                Beta
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
