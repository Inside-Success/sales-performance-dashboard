"use client";

export default function V7ValidationError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="magic-page"><div className="mx-auto max-w-3xl px-5 py-12"><div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-950"><h1 className="text-xl font-extrabold">The validation view could not load.</h1><p className="mt-2 text-sm leading-6">The scoring workflow is not changed by this page error. Try loading the latest saved results again.</p><button type="button" onClick={reset} className="mt-4 rounded-full bg-red-600 px-4 py-2 text-sm font-bold text-white">Try again</button></div></div></main>;
}
