"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Home, MessageSquareText } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Home", mobileLabel: "Home", icon: Home },
  {
    href: "/manual-reports",
    label: "Self-submitted reports",
    mobileLabel: "Reports",
    icon: ClipboardList,
  },
  { href: "/submit", label: "Get feedback", mobileLabel: "Feedback", icon: MessageSquareText },
];

export function MainNav() {
  const pathname = usePathname();

  return (
    <nav className="flex min-w-0 items-center gap-1 rounded-full bg-slate-100/70 p-1 ring-1 ring-slate-200/60">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "group inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full px-3 text-[14.5px] font-semibold transition-colors sm:px-4",
              active ? "bg-[#DC2626] text-white shadow-sm" : "text-slate-500 hover:text-slate-900",
            )}
          >
            <Icon className={cn("size-4", active ? "opacity-100" : "opacity-70 group-hover:opacity-100")} />
            <span className="hidden sm:inline">{item.label}</span>
            <span className="sm:hidden">{item.mobileLabel}</span>
          </Link>
        );
      })}
    </nav>
  );
}
