"use client";

import Link from "next/link";
import { Menu } from "@base-ui/react/menu";
import { ArrowUpRight, Check, ChevronDown, ShieldCheck } from "lucide-react";
import { ADMIN_NAV_GROUPS, activeAdminLink, type AdminNavigationLink } from "@/lib/admin-directory";
import { cn } from "@/lib/utils";

const control = "inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold outline-offset-2 transition-colors focus-visible:outline-2 focus-visible:outline-red-600";

function NavigationItem({ link, active }: { link: AdminNavigationLink; active: boolean }) {
  const external = link.href.startsWith("https:");
  return <Menu.LinkItem closeOnClick render={<Link href={link.href} prefetch={false} />}
    target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined}
    aria-current={active ? "page" : undefined}
    className={cn("flex min-h-11 items-center justify-between gap-4 rounded-lg px-3 py-2 text-sm outline-none data-highlighted:bg-slate-100", active ? "bg-red-50 font-semibold text-red-700" : "text-slate-700")}>
    <span>{link.navLabel}{external ? <span className="sr-only"> (opens in a new tab)</span> : null}</span>
    {external ? <ArrowUpRight className="size-4" aria-hidden="true" /> : active ? <Check className="size-4" aria-hidden="true" /> : null}
  </Menu.LinkItem>;
}

function NavigationMenu({ label, children, selected = false }: { label: string; children: React.ReactNode; selected?: boolean }) {
  return <Menu.Root modal={false}>
    <Menu.Trigger className={cn(control, "justify-between", selected ? "bg-red-50 text-red-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950")}>
      {label}<ChevronDown className="size-3.5" aria-hidden="true" />
    </Menu.Trigger>
    <Menu.Portal>
      <Menu.Positioner sideOffset={8} align="start" className="z-50 outline-none">
        <Menu.Popup className="max-h-[var(--available-height)] w-64 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/10 outline-none">
          {children}
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  </Menu.Root>;
}

export function AdminNavbar({ links, pathname }: { links: readonly AdminNavigationLink[]; pathname: string }) {
  if (!links.length) return null;
  const active = activeAdminLink(pathname, links);
  return <nav aria-label="Admin pages" className="border-t border-slate-200/70 bg-white/95">
    <div className="mx-auto flex min-h-14 max-w-[84rem] items-center justify-between gap-2 px-5 py-1 sm:px-8">
      <Link href="/admin" prefetch={false} aria-current={pathname === "/admin" ? "page" : undefined}
        className={cn(control, "shrink-0 pl-0", pathname === "/admin" ? "text-red-700" : "text-slate-700 hover:text-red-700")}>
        <ShieldCheck className="size-4 text-red-600" aria-hidden="true" />Admin Insights
      </Link>
      <div className="hidden items-center gap-1 md:flex">
        {ADMIN_NAV_GROUPS.map(group => {
          const items = links.filter(link => link.group === group.id);
          return items.length ? <NavigationMenu key={group.id} label={group.label} selected={active?.group === group.id}>
            {items.map(link => <NavigationItem key={link.href} link={link} active={active?.href === link.href} />)}
          </NavigationMenu> : null;
        })}
        {links.filter(link => link.group === "external").map(link => <Link key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" className={cn(control, "text-slate-600 hover:bg-slate-100 hover:text-slate-950")}>
          {link.navLabel}<ArrowUpRight className="size-3.5" aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span>
        </Link>)}
      </div>
      <div className="min-w-0 md:hidden">
        <NavigationMenu label="Admin pages" selected={Boolean(active)}>
          {ADMIN_NAV_GROUPS.map(group => {
            const items = links.filter(link => link.group === group.id);
            return items.length ? <Menu.Group key={group.id}>
              <Menu.GroupLabel className="px-3 pb-1 pt-3 text-xs font-semibold text-slate-500">{group.label}</Menu.GroupLabel>
              {items.map(link => <NavigationItem key={link.href} link={link} active={active?.href === link.href} />)}
            </Menu.Group> : null;
          })}
          {links.filter(link => link.group === "external").map(link => <NavigationItem key={link.href} link={link} active={false} />)}
        </NavigationMenu>
      </div>
    </div>
  </nav>;
}
