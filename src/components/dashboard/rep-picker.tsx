"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { UserRound } from "lucide-react";
import type { RepSummary } from "@/lib/types";
import { trackUsageEvent } from "@/components/dashboard/usage-tracker";

type RepPickerProps = {
  reps: RepSummary[];
  selectedRepSlug?: string;
  basePath?: string;
};

export function RepPicker({ reps, selectedRepSlug, basePath = "/" }: RepPickerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleRepChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const repSlug = event.target.value;
    const rep = reps.find((item) => item.rep_slug === repSlug);
    if (repSlug) {
      trackUsageEvent("rep_selected", {
        source: basePath === "/manual-reports" ? "manual_reports" : "official_dashboard",
        target_rep_slug: repSlug,
        target_rep_name: rep?.rep_name || null,
      });
    }
    startTransition(() => {
      router.push(repSlug ? `${basePath}?rep=${encodeURIComponent(repSlug)}` : basePath);
    });
  }

  return (
    <div className="grid gap-1.5">
      <label htmlFor="rep" className="text-xs font-semibold uppercase text-muted-foreground">
        Select your name
      </label>
      <div className="relative">
        <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <select
          id="rep"
          name="rep"
          defaultValue={selectedRepSlug || ""}
          onChange={handleRepChange}
          aria-busy={isPending}
          className="h-11 w-full rounded-lg border border-input bg-card py-2 pl-9 pr-8 text-sm shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <option value="">Select a rep</option>
          {reps.map((rep) => (
            <option key={rep.rep_slug} value={rep.rep_slug}>
              {rep.rep_name}
            </option>
          ))}
        </select>
      </div>
      {isPending ? <p className="text-xs text-muted-foreground">Loading reports...</p> : null}
    </div>
  );
}
