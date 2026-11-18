// Show variants offered on the rep green light page. The values are the `show_type` strings the
// Green Light V2 n8n workflow already understands; only the labels are rep-facing.
export const GREEN_LIGHT_SHOWS = [
  { value: "normal", label: "Feature Documentary" },
  { value: "nlceo", label: "Next Level CEO" },
  { value: "reality", label: "Reality Show" },
  { value: "mansion", label: "Mansion of Money" },
  { value: "island", label: "Entrepreneurs Island" },
] as const;

export type GreenLightShow = (typeof GREEN_LIGHT_SHOWS)[number]["value"];

export const GREEN_LIGHT_SHOW_VALUES = GREEN_LIGHT_SHOWS.map((show) => show.value) as [
  GreenLightShow,
  ...GreenLightShow[],
];

// These letters carry no editor-entered deadline line (same rule as the editors' dashboard).
const SHOWS_WITHOUT_DEADLINE: GreenLightShow[] = ["nlceo", "mansion", "island"];
export const GREEN_LIGHT_DEFAULT_DEADLINE = "Sunday 11.59pm EST";

export function greenLightDeadlineText(show: GreenLightShow) {
  return SHOWS_WITHOUT_DEADLINE.includes(show) ? "" : GREEN_LIGHT_DEFAULT_DEADLINE;
}

export function greenLightShowLabel(show: string) {
  return GREEN_LIGHT_SHOWS.find((item) => item.value === show)?.label || "Feature Documentary";
}

export const GREEN_LIGHT_MIN_TRANSCRIPT_LENGTH = 120;
// The focus points box has no limit a rep would meet; this only stops a runaway paste.
export const GREEN_LIGHT_MAX_FOCUS_TEXT_LENGTH = 200000;

/** The lines of the focus points box as typed: blank lines dropped, nothing cut. */
export function focusPointLines(value: string) {
  return String(value || "")
    .slice(0, GREEN_LIGHT_MAX_FOCUS_TEXT_LENGTH)
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/** Words that carry something (a lone dash or slash is not one). Same count the workflow makes. */
export function countContextWords(value: string | string[]) {
  return (Array.isArray(value) ? value.join("\n") : String(value || ""))
    .split(/\s+/)
    .filter((word) => /[A-Za-z0-9]/.test(word)).length;
}

// Without a call transcript the letter is written from the focus points alone, so they have to
// say something. The four-paragraph letters need less than the five-act story letters; the
// numbers come from test letters at each length and match the workflow's own check.
const STORY_LETTER_SHOWS: GreenLightShow[] = ["normal", "nlceo"];
export function greenLightMinContextWords(show: GreenLightShow) {
  return STORY_LETTER_SHOWS.includes(show) ? 15 : 8;
}

export function isZoomRecordingLink(value: string) {
  try {
    const url = new URL(String(value || "").trim());
    return (
      url.protocol === "https:" &&
      /(^|\.)zoom\.us$/i.test(url.hostname) &&
      /^\/(?:rec\/(?:share|play)|recording\/play)\/[^/]+\/?$/.test(url.pathname)
    );
  } catch {
    return false;
  }
}

export function googleDocPdfUrl(documentUrl: string) {
  const id = String(documentUrl || "").match(/\/document\/d\/([A-Za-z0-9_-]+)/)?.[1];
  return id ? `https://docs.google.com/document/d/${id}/export?format=pdf` : "";
}
