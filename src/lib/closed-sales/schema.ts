import { z } from "zod";

export const categories = [
  "Documentary",
  "Reality",
  "DJ / NLCEO",
  "Other",
] as const;
const safeLink = z
  .string()
  .url()
  .refine((value) => {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      (url.hostname === "istvoffical.slack.com" ||
        url.hostname === "docs.google.com" ||
        url.hostname === "drive.google.com" ||
        url.hostname === "zoom.us" ||
        url.hostname.endsWith(".zoom.us"))
    );
  }, "Unsupported source link");
export const saleSchema = z.object({
  id: z.string(),
  client: z.string().min(1),
  rep: z.string().min(1),
  show: z.string(),
  category: z.enum(categories),
  package: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sources: z.array(safeLink).min(1),
  recordings: z.array(z.object({ label: z.string(), url: safeLink })),
  reports: z.array(
    z.object({
      id: z.number().int().positive(),
      date: z.string(),
      title: z.string(),
      recording: safeLink.nullable(),
      transcript: safeLink.nullable(),
      outcome: z.string(),
      match: z.enum(["recording", "identity"]),
      closingCandidate: z.boolean(),
    }),
  ),
  reviewNote: z.string(),
});
export type LibrarySale = z.infer<typeof saleSchema>;
export const snapshotSchema = z.object({
  version: z.literal(1),
  capturedAt: z.string().datetime(),
  from: z.string(),
  through: z.string(),
  sourceEntries: z.number().int(),
  reviewedThreads: z.number().int(),
  sales: z.array(saleSchema),
});
export function libraryFilters(
  input: Record<string, string | string[] | undefined>,
) {
  const scalar = (key: string) =>
    typeof input[key] === "string" ? (input[key] as string) : "";
  const category = scalar("category");
  const page = Number(scalar("page"));
  return {
    q: scalar("q").trim().slice(0, 100),
    rep: scalar("rep").slice(0, 150),
    category: categories.includes(category as (typeof categories)[number])
      ? category
      : "",
    reports: scalar("reports") === "available",
    page: Number.isSafeInteger(page) && page > 0 ? Math.min(page, 10000) : 1,
  };
}
