"use client";

import Link from "next/link";
import { Bot } from "lucide-react";
import { usePathname } from "next/navigation";
import { MainNav } from "@/components/dashboard/main-nav";
import { ProfileMenu } from "@/components/dashboard/profile-menu";
import { ToolSwitcher } from "@/components/dashboard/tool-switcher";

export function HeaderVisibility({ userName, userEmail }: { userName: string; userEmail: string }) {
  const pathname = usePathname();

  if (pathname === "/sign-in" || pathname.startsWith("/sign-in/")) return null;

  const isHub = pathname === "/";
  const isFaq = pathname === "/ask-sales-faq" || pathname.startsWith("/ask-sales-faq/");
  const isFaqAdmin = pathname.startsWith("/ask-sales-faq/admin");

  return (
    <header className="magic-app-header sticky top-0 z-40 border-b backdrop-blur supports-[backdrop-filter]:bg-white/85">
      <div className="mx-auto flex min-h-[72px] w-full max-w-[84rem] flex-col items-stretch justify-center gap-3 px-5 py-3 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:py-0">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <BrandLink compact={!isHub} />
          {!isHub && !isFaqAdmin ? <ToolSwitcher active={isFaq ? "faq" : "coaching"} /> : null}
          <div className="lg:hidden">
            <ProfileMenu userName={userName} userEmail={userEmail} compact />
          </div>
        </div>

        {!isHub && !isFaq ? (
          <div className="flex min-w-0 items-center justify-between gap-3 lg:justify-end">
            <MainNav />
            <div className="hidden lg:block"><ProfileMenu userName={userName} userEmail={userEmail} /></div>
          </div>
        ) : (
          <div className="hidden items-center gap-4 lg:flex">
            {isFaqAdmin ? <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Admin only</span> : null}
            <ProfileMenu userName={userName} userEmail={userEmail} compact />
          </div>
        )}
      </div>
    </header>
  );
}

function BrandLink({ compact }: { compact: boolean }) {
  return (
    <Link href="/" aria-label="Magic Mike home" className="flex min-w-0 shrink-0 items-center gap-3 font-semibold">
      <span className="magic-brand-mark grid size-11 shrink-0 place-items-center rounded-2xl text-white">
        <Bot className="size-6" />
      </span>
      <span className={compact ? "hidden leading-tight xl:block" : "leading-tight"}>
        <span className="block text-[19px] font-extrabold tracking-normal text-slate-900">
          Magic Mike <span className="text-[#DC2626]">Bot</span>
        </span>
        <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          Inside Success TV
        </span>
      </span>
    </Link>
  );
}
