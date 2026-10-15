"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
export function RepNoShowPeriodSelect({ selectedDays }: { selectedDays?: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <div className="min-w-32 flex-1 sm:flex-none"><select aria-label="Choose another date range" aria-busy={pending} disabled={pending} value={selectedDays || ""} onChange={event => { const days = event.target.value; startTransition(() => router.push(`/manager/rep-no-show?days=${days}`)); }} className="min-h-11 w-full rounded-lg border bg-background px-3 text-sm font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-red-600">
    <option value="" disabled>Other periods</option>
    {[7,14,30,90].map(days=><option key={days} value={days}>Last {days} days</option>)}
  </select>{pending && <span role="status" className="sr-only">Loading selected period</span>}</div>;
}
