"use client";
import { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";
export function LinkPending() {
  const { pending } = useLinkStatus();
  return <span className="ml-1 inline-flex w-3 items-center" aria-live="polite">{pending ? <><Loader2 className="size-3 animate-spin" aria-hidden="true" /><span className="sr-only">Loading selected period</span></> : null}</span>;
}
