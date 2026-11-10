"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { ArrowUpRight } from "lucide-react";
import { ADMIN_NAV_GROUPS, activeAdminLink, type AdminNavigationLink } from "@/lib/admin-directory";
import { cn } from "@/lib/utils";

const control = "inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border-b-2 px-3 text-sm font-semibold outline-offset-2 transition-colors focus-visible:outline-2 focus-visible:outline-red-600";

export function AdminNavbar({ links, pathname }: { links: readonly AdminNavigationLink[]; pathname: string }) {
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = strip.current;
    const current = container?.querySelector<HTMLElement>('[aria-current="page"]');
    // Reveal the current destination without scrolling the page vertically.
    if (container && current && container.scrollWidth > container.clientWidth) {
      container.scrollLeft = current.offsetLeft - container.offsetLeft - 12;
    }
  }, [pathname]);
  if (!links.length) return null;
  const active = activeAdminLink(pathname, links);
  const ordered = [...ADMIN_NAV_GROUPS.flatMap(group => links.filter(link => link.group === group.id)), ...links.filter(link => link.group === "external")];
  const items = [{ href: "/admin", label: "Admin Insights", active: pathname === "/admin" }, ...ordered.map(link => ({
    href: link.href,
    label: link.group === "faq" ? `FAQ ${link.navLabel}` : link.navLabel,
    active: active?.href === link.href,
  }))];
  return <nav aria-label="Admin pages" data-admin-layout={links.length > 5 ? "full" : "compact"} className="border-t border-slate-200/70 bg-white/95">
    <div className="relative mx-auto max-w-[84rem]">
      <div ref={strip} tabIndex={0} aria-label="Admin links; scroll horizontally for more pages on smaller screens"
        className="relative flex min-h-14 items-center gap-1 overflow-x-auto px-5 py-1 outline-offset-[-2px] focus-visible:outline-2 focus-visible:outline-red-600 sm:px-8 lg:grid lg:grid-cols-6 lg:gap-x-2 lg:gap-y-1 lg:overflow-visible">
        {items.map(item => {
          const external = item.href.startsWith("https:");
          return <Link key={item.href} href={item.href} prefetch={false}
            target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined}
            aria-current={item.active ? "page" : undefined}
            className={cn(control, item.active ? "border-red-600 bg-red-50 text-red-700" : "border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-950")}>
            {item.label}{external ? <><ArrowUpRight className="size-3.5" aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></> : null}
          </Link>;
        })}
      </div>
      <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-5 bg-gradient-to-l from-white to-transparent lg:hidden" />
    </div>
  </nav>;
}
