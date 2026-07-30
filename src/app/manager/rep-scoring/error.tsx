"use client";

import Link from "next/link";

export default function RepScoringError() {
  return <main className="magic-page"><div className="mx-auto flex min-h-[60vh] max-w-2xl items-center px-5"><div className="magic-card w-full p-7"><div className="text-sm font-bold uppercase tracking-wide text-red-700">Private manager view</div><h1 className="mt-2 text-3xl font-extrabold text-slate-950">Rep scoring is safely unavailable</h1><p className="mt-3 leading-7 text-slate-600">The page stopped without changing production data. Try again after the isolated scoring connection is checked.</p><Link href="/coaching" className="mt-5 inline-flex rounded-full bg-[#DC2626] px-4 py-2 text-sm font-semibold text-white">Back to coaching</Link></div></div></main>;
}
