import type { DashboardFilters } from "@/lib/types";

export type RawSearchParams = Record<string, string | string[] | undefined>;

export function readFilters(searchParams: RawSearchParams, overrides: DashboardFilters = {}) {
  return {
    q: readString(searchParams.q),
    rep: readString(searchParams.rep),
    client: readString(searchParams.client),
    date: readString(searchParams.date),
    from: readString(searchParams.from),
    to: readString(searchParams.to),
    ...overrides,
  };
}

function readString(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] || undefined;
  return value || undefined;
}
