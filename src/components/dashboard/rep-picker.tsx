"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Check, ChevronDown, Loader2, Search } from "lucide-react";
import type { RepSummary } from "@/lib/types";
import { trackUsageEvent } from "@/components/dashboard/usage-tracker";
import { cn } from "@/lib/utils";

type RepPickerProps = {
  reps: RepSummary[];
  selectedRepSlug?: string;
  basePath?: string;
  selectedSubline?: string;
};

export function RepPicker({
  reps,
  selectedRepSlug,
  basePath = "/",
  selectedSubline = "Viewing newest feedback reports",
}: RepPickerProps) {
  const router = useRouter();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  const selectedRep = reps.find((item) => item.rep_slug === selectedRepSlug);
  const filteredReps = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return reps.slice(0, 80);

    return reps
      .filter((rep) => rep.rep_name.toLowerCase().includes(normalizedQuery))
      .slice(0, 80);
  }, [query, reps]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  function selectRep(repSlug: string) {
    const rep = reps.find((item) => item.rep_slug === repSlug);
    if (repSlug) {
      trackUsageEvent("rep_selected", {
        source: basePath === "/manual-reports" ? "manual_reports" : "official_dashboard",
        target_rep_slug: repSlug,
        target_rep_name: rep?.rep_name || null,
      });
    }
    setOpen(false);
    startTransition(() => {
      router.push(repSlug ? `${basePath}?rep=${encodeURIComponent(repSlug)}` : basePath);
    });
  }

  function toggleOpen() {
    if (open) setQuery("");
    setOpen((value) => !value);
  }

  return (
    <div ref={wrapperRef} className="relative grid gap-2">
      <label className="text-[13px] font-bold uppercase tracking-[0.12em] text-slate-400">
        Select your name
      </label>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-busy={isPending}
        onClick={toggleOpen}
        className="magic-selector-button flex min-h-[68px] w-full items-center gap-3 rounded-2xl border bg-white px-4 py-4 text-left outline-none transition-all hover:border-slate-300 focus-visible:border-[#DC2626] focus-visible:ring-4 focus-visible:ring-[#FEF2F2]"
        style={open ? { borderColor: "#DC2626", boxShadow: "0 0 0 4px #FEF2F2, 0 18px 48px -16px rgba(17,17,26,.24)" } : undefined}
      >
        <span
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-xl text-[15px] font-extrabold text-white",
            selectedRep ? "bg-[#DC2626]" : "bg-[#CBD0D8]",
          )}
        >
          {selectedRep ? getInitials(selectedRep.rep_name) : <Search className="size-5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[17px] font-bold text-slate-900">
            {selectedRep?.rep_name || "Select a rep"}
          </span>
          <span className="block text-[13px] font-medium text-slate-400">
            {selectedRep ? selectedSubline : `Search ${reps.length} sales reps by name`}
          </span>
        </span>
        <span
          className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-400 transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "none" }}
        >
          {isPending ? <Loader2 className="size-4 animate-spin" /> : <ChevronDown className="size-5" />}
        </span>
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+10px)] z-50 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_2px_6px_rgba(17,17,26,.05),0_18px_48px_-16px_rgba(17,17,26,.24)]">
          <div className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-3">
            <Search className="size-4 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search reps..."
              className="w-full bg-transparent text-[15px] font-medium text-slate-900 outline-none placeholder:text-slate-400"
              autoFocus
            />
          </div>
          <div className="rep-scroll max-h-[316px] overflow-y-auto py-1.5" role="listbox">
            <button
              type="button"
              role="option"
              aria-selected={!selectedRepSlug}
              onClick={() => selectRep("")}
              className="flex w-full items-center justify-between px-3 py-2.5 text-left text-[15px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              All reps
              {!selectedRepSlug ? <Check className="size-4 text-[#DC2626]" /> : null}
            </button>
            {filteredReps.map((rep) => (
              <button
                key={rep.rep_slug}
                type="button"
                role="option"
                aria-selected={selectedRepSlug === rep.rep_slug}
                onClick={() => selectRep(rep.rep_slug)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-slate-50"
                style={selectedRepSlug === rep.rep_slug ? { background: "#FEF2F2" } : undefined}
              >
                <span
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-lg text-[13px] font-bold",
                    selectedRepSlug === rep.rep_slug ? "bg-[#DC2626] text-white" : "bg-[#F1F2F5] text-[#5A616E]",
                  )}
                >
                  {getInitials(rep.rep_name)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-semibold text-slate-700">{rep.rep_name}</span>
                  <span className="text-[12px] font-medium text-slate-400">{rep.call_count} reports</span>
                </span>
                {selectedRepSlug === rep.rep_slug ? <Check className="ml-auto size-4 shrink-0 text-[#DC2626]" /> : null}
              </button>
            ))}
            {!filteredReps.length ? (
              <div className="px-4 py-10 text-center text-[14px] font-medium text-slate-400">
                No rep matches {query}.
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function getInitials(name: string) {
  const clean = name.replace(/\s*-\s*.*$/, "").trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] || "" : "";
  return `${first}${last}`.toUpperCase() || "?";
}
