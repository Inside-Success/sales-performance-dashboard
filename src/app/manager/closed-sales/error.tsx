"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto max-w-6xl p-8">
      <h1 className="text-2xl font-bold">The sales library could not load</h1>
      <p className="mt-3 text-slate-600">
        Please try again. No sales data has been changed.
      </p>
      <button
        onClick={reset}
        className="mt-5 min-h-11 rounded-xl bg-red-600 px-5 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
      >
        Try again
      </button>
    </div>
  );
}
