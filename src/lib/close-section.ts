import type { CloseSectionType, JsonObject } from "@/lib/types";

export type CloseSectionValue = JsonObject | string | string[] | null;

export function resolveCloseSection({
  whyNoClose,
  closeWorks,
}: {
  whyNoClose: CloseSectionValue;
  closeWorks: CloseSectionValue;
}): {
  type: CloseSectionType;
  value: JsonObject | string | null;
} {
  if (hasContent(closeWorks) && !isNoCloseFallback(closeWorks)) {
    return {
      type: "what_made_this_close_work",
      value: normalizeDisplayValue(closeWorks),
    };
  }

  if (hasContent(whyNoClose)) {
    return {
      type: "why_no_close",
      value: normalizeDisplayValue(whyNoClose),
    };
  }

  if (hasContent(closeWorks)) {
    return {
      type: "why_no_close",
      value: normalizeDisplayValue(closeWorks),
    };
  }

  return {
    type: null,
    value: null,
  };
}

function isNoCloseFallback(value: CloseSectionValue) {
  const text = stringifyValue(value).toLowerCase();

  return (
    /\bno close occurred\b/.test(text) ||
    /\bno completed payment was confirmed\b/.test(text) ||
    /\bno close happened\b/.test(text) ||
    /\bdeal did not close\b/.test(text) ||
    /\bcall did not close\b/.test(text) ||
    /\bnothing that closed the deal\b/.test(text) ||
    /\bsee why no close\b/.test(text)
  );
}

function hasContent(value: CloseSectionValue) {
  return stringifyValue(value).trim().length > 0;
}

function stringifyValue(value: CloseSectionValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.map((entry) => String(entry || "").trim()).filter(Boolean).join(" ");
  if (typeof value === "object") return Object.values(value).map((entry) => stringifyValue(entry as CloseSectionValue)).join(" ");
  return String(value).trim();
}

function normalizeDisplayValue(value: CloseSectionValue): JsonObject | string | null {
  if (Array.isArray(value)) return value.filter((entry) => String(entry || "").trim()).join("\n");
  if (value === null || value === undefined) return null;
  return value;
}
