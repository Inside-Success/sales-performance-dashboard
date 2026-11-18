import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { GreenLightGenerator } from "@/components/green-light/green-light-generator";
import { canUseGreenLight } from "@/lib/green-light/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Green Light Letter Generator | Magic Mike Bot",
  robots: { index: false, follow: false },
};

export default async function GreenLightPage() {
  const session = await auth();
  if (!canUseGreenLight(session?.user?.email)) notFound();

  return (
    <main className="magic-page">
      <div className="magic-container flex max-w-4xl flex-col gap-5">
        <header className="px-1">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition-colors hover:text-[#B91C1C]"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Home
          </Link>
          <h1 className="mt-3 text-[32px] font-extrabold leading-[1.1] text-slate-950 md:text-[40px]">
            Green Light Letter Generator
          </h1>
          <p className="mt-2 text-[16px] font-medium leading-7 text-slate-500">
            Create a prospect&apos;s approval letter from their casting call.
          </p>
        </header>
        <GreenLightGenerator />
      </div>
    </main>
  );
}
