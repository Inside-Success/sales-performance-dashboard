import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ArrowUpRight, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { canAccessAdminDirectory, isMagicMikeAdmin, isSalesFaqAdmin } from "@/lib/admin-access-policy";
import { ADMIN_DIRECTORY_LINKS } from "@/lib/admin-directory";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Magic Mike Admin", robots: { index: false, follow: false } };

export default async function AdminDirectoryPage() {
  const session = await auth();
  const email = session?.user?.email;
  if (!canAccessAdminDirectory(email)) notFound();
  const links = ADMIN_DIRECTORY_LINKS.filter(link =>
    link.scope === "manager" ? isMagicMikeAdmin(email) : isSalesFaqAdmin(email));

  return <main className="magic-page">
    <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-10">
      <Link href="/" className="mb-6 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-slate-600 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-600">
        <ArrowLeft className="size-4" aria-hidden="true" />Magic Mike home
      </Link>
      <header className="mb-7 flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-red-50 text-red-700"><ShieldCheck className="size-5" aria-hidden="true" /></span>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">Magic Mike Admin</h1>
      </header>
      <nav aria-label="Magic Mike admin pages" className="magic-card overflow-hidden">
        <ul className="divide-y divide-slate-100">
          {links.map(link => {
            const external = link.href.startsWith("https://");
            const Arrow = external ? ArrowUpRight : ArrowRight;
            return <li key={link.href}>
              <Link href={link.href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined}
                className="group flex min-h-[72px] items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-red-50/50 focus-visible:bg-red-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-red-600 sm:px-7">
                <span className="text-base font-semibold text-slate-900 sm:text-lg">{link.name}{external ? <span className="sr-only"> (opens in a new tab)</span> : null}</span>
                <span className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-red-700">Open<Arrow className="size-4" aria-hidden="true" /></span>
              </Link>
            </li>;
          })}
        </ul>
      </nav>
    </div>
  </main>;
}
