"use client";
export default function ReviewError({reset}:{reset:()=>void}) {
 return <main className="magic-page"><div role="alert" className="magic-card mx-auto my-8 max-w-3xl space-y-4 p-6"><h1 className="text-xl font-bold">Reports could not be loaded</h1><p className="text-slate-600">Please try again. This does not affect the coaching reports reps receive.</p><button onClick={reset} className="rounded-xl bg-red-700 px-5 py-3 font-semibold text-white">Try again</button></div></main>;
}
