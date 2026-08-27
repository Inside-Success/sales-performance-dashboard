"use client";

import Link from "next/link";
import { RotateCw } from "lucide-react";

export default function RepScoringError({ reset }: { reset: () => void }) {
  return <main className="magic-page"><div className="mx-auto flex min-h-[60vh] max-w-2xl items-center px-5"><div className="magic-card w-full p-7"><div className="text-sm font-bold uppercase tracking-wide text-red-700">Private manager view</div><h1 className="mt-2 text-3xl font-extrabold text-slate-950">This review took too long to load</h1><p className="mt-3 leading-7 text-slate-600">No score or production data was changed. Try the review again, or return to the scorecard.</p><div className="mt-5 flex flex-wrap gap-3"><button type="button" onClick={reset} className="inline-flex items-center gap-2 rounded-full bg-[#DC2626] px-4 py-2 text-sm font-semibold text-white"><RotateCw className="size-4" />Try again</button><Link href="/manager/rep-scoring" className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-red-200 hover:text-red-700">Back to scorecard</Link></div></div></div></main>;
}
