// Splits a Green Light V2 draft (plain text built by the n8n workflow) into the fixed template
// wording and the sections written from the call, so the rep page can show the whole letter and
// let reps edit only the personalised parts in place. The Google Doc design is built from the exact
// lines of this text, so the fixed lines must reach the save step unchanged.
//
// If a draft does not look like a known template, `splitLetter` returns mode "full" and the page
// falls back to one plain text box, so a template change can never block a rep.

export type LetterSegment =
  | { kind: "fixed"; text: string }
  | { kind: "edit"; key: string; label: string; text: string; prefix: string; multiline: boolean };

export type SplitLetter = { mode: "sections" | "full"; segments: LetterSegment[] };

type SlotSpec = {
  key: string;
  label: string;
  multiline: boolean;
  optional?: boolean;
  start: (line: string) => boolean;
  end: (line: string) => boolean;
};

const is = (text: string) => (line: string) => line.trim() === text;
const startsWith = (text: string) => (line: string) => line.trim().startsWith(text);

const PROFILE_HEADINGS = ["BUSINESS EXPERIENCE", "COMPETITIVE EDGE", "PERSONALITY", "THE WILDCARD"];
const PROFILE_END = "These are some of the qualities our production team will explore";

const PROFILE_SLOTS: SlotSpec[] = PROFILE_HEADINGS.map((heading, index) => ({
  key: heading.toLowerCase().replace(/[^a-z]+/g, "_"),
  label: heading
    .toLowerCase()
    .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase()),
  multiline: true,
  start: is(heading),
  end: index < PROFILE_HEADINGS.length - 1 ? is(PROFILE_HEADINGS[index + 1]) : startsWith(PROFILE_END),
}));

const STORY_ACT_ENDS = [
  "Before the business existed...",
  "This was the turning point.",
  "This is where your expertise was earned.",
  "This is the proof.",
  "This is where your story becomes bigger than you.",
];
const STORY_ACT_LABELS = ["The ordinary world", "The challenge", "The journey", "The breakthrough", "The legacy"];

const STORY_SLOTS: SlotSpec[] = [
  ...STORY_ACT_ENDS.map((end, index) => ({
    key: `act_${index + 1}`,
    label: `Act ${index + 1}: ${STORY_ACT_LABELS[index]}`,
    multiline: true,
    start: startsWith(`ACT ${index + 1}:`),
    end: is(end),
  })),
  {
    key: "your_thing",
    label: "Your thing",
    multiline: true,
    start: startsWith("After reviewing your application, we believe the territory your brand"),
    end: is("This becomes the foundation of authority."),
  },
  {
    key: "mission",
    label: "Mission points",
    multiline: true,
    start: is("Based on our review, we believe your mission includes:"),
    end: is("This is bigger than marketing."),
  },
  {
    key: "why_now",
    label: "Why this story matters for them",
    multiline: true,
    optional: true,
    start: is("For you, specifically, that can look like:"),
    end: (line) => line.trim().startsWith("We do not guarantee exact outcomes") || line.trim() === "YOUR AUTHORITY ASSET",
  },
];

function normalizeDraft(value: string) {
  return String(value || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function splitLetter(draft: string): SplitLetter {
  const text = normalizeDraft(draft);
  const lines = text.split("\n");
  const fullMode: SplitLetter = { mode: "full", segments: [{ kind: "edit", key: "full_letter", label: "Letter", text, prefix: "", multiline: true }] };

  const titleIndex = lines.findIndex((line) => line.trim() === "CONDITIONAL CASTING APPROVAL");
  if (titleIndex === -1 || titleIndex > 3) return fullMode;

  const castIndex = lines.findIndex((line, index) => index <= titleIndex + 2 && /^\s*Cast Name\s*:/i.test(line));
  const isProfileLetter = castIndex !== -1;
  const slots = isProfileLetter ? PROFILE_SLOTS : STORY_SLOTS;

  // [startLine, endLineExclusive, slot] ranges of editable lines, in document order.
  const ranges: Array<{ from: number; to: number; key: string; label: string; prefix: string; multiline: boolean }> = [];

  if (isProfileLetter) {
    const prefix = lines[castIndex].match(/^\s*Cast Name\s*:\s*/i)?.[0] || "Cast Name: ";
    ranges.push({ from: castIndex, to: castIndex + 1, key: "prospect_name", label: "Prospect name", prefix, multiline: false });
  } else {
    const nameIndex = titleIndex + 1;
    const nameLine = lines[nameIndex] || "";
    if (!nameLine.trim() || /^Potential Feature/i.test(nameLine.trim())) return fullMode;
    ranges.push({ from: nameIndex, to: nameIndex + 1, key: "prospect_name", label: "Prospect name", prefix: "", multiline: false });
  }

  let cursor = ranges[0].to;
  let missingRequired = false;
  for (const slot of slots) {
    const startIndex = lines.findIndex((line, index) => index >= cursor && slot.start(line));
    const endIndex = startIndex === -1 ? -1 : lines.findIndex((line, index) => index > startIndex && slot.end(line));
    if (endIndex === -1) {
      missingRequired ||= !slot.optional;
      continue;
    }
    let from = startIndex + 1;
    let to = endIndex;
    while (from < to && !lines[from].trim()) from += 1;
    while (to > from && !lines[to - 1].trim()) to -= 1;
    if (from >= to) {
      missingRequired ||= !slot.optional;
      continue;
    }
    ranges.push({ from, to, key: slot.key, label: slot.label, prefix: "", multiline: slot.multiline });
    cursor = endIndex;
  }

  // A real letter always has its personalised sections; anything else is an unknown layout.
  if (missingRequired) return fullMode;

  const segments: LetterSegment[] = [];
  let position = 0;
  for (const range of ranges) {
    if (range.from > position) segments.push({ kind: "fixed", text: lines.slice(position, range.from).join("\n") });
    const raw = lines.slice(range.from, range.to).join("\n");
    segments.push({
      kind: "edit",
      key: range.key,
      label: range.label,
      prefix: range.prefix,
      multiline: range.multiline,
      text: range.prefix ? raw.slice(range.prefix.length) : raw,
    });
    position = range.to;
  }
  if (position < lines.length) segments.push({ kind: "fixed", text: lines.slice(position).join("\n") });

  return joinLetter(segments) === text ? { mode: "sections", segments } : fullMode;
}

function cleanEdited(value: string, multiline: boolean) {
  const text = normalizeDraft(value).replace(/[​-‍﻿]/g, "");
  if (!multiline) return text.replace(/\s+/g, " ").trim();
  return text
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function joinLetter(segments: LetterSegment[]) {
  return segments.map((segment) => (segment.kind === "fixed" ? segment.text : `${segment.prefix}${segment.text}`)).join("\n");
}

/** Final text sent to the workflow: edited sections tidied, fixed wording untouched. */
export function assembleLetter(segments: LetterSegment[]) {
  return joinLetter(
    segments.map((segment) =>
      segment.kind === "edit" && segment.key !== "full_letter"
        ? { ...segment, text: cleanEdited(segment.text, segment.multiline) }
        : segment,
    ),
  ).trim();
}

export function emptySections(segments: LetterSegment[]) {
  return segments
    .filter((segment): segment is Extract<LetterSegment, { kind: "edit" }> => segment.kind === "edit")
    .filter((segment) => !cleanEdited(segment.text, segment.multiline))
    .map((segment) => segment.label);
}

const OTHER_SHOW_PATTERNS: Record<string, Array<[string, RegExp]>> = {
  mansion: [["Entrepreneurs Island", /\bentrepreneur(?:'|’)?s?\s+island\b/i]],
  island: [["Mansion of Money", /\bmansion\s+of\s+money\b/i]],
  normal: [
    ["Mansion of Money", /\bmansion\s+of\s+money\b/i],
    ["Entrepreneurs Island", /\bentrepreneur(?:'|’)?s?\s+island\b/i],
    ["Next Level CEO", /\bnext\s+level\s+ceo\b/i],
  ],
  nlceo: [
    ["Mansion of Money", /\bmansion\s+of\s+money\b/i],
    ["Entrepreneurs Island", /\bentrepreneur(?:'|’)?s?\s+island\b/i],
  ],
};

/** Names of other shows mentioned in the sections written from the call (never the fixed wording). */
export function otherShowMentions(show: string, segments: LetterSegment[]) {
  const patterns = OTHER_SHOW_PATTERNS[show] || [];
  const written = segments
    .filter((segment) => segment.kind === "edit" && segment.key !== "prospect_name" && segment.key !== "full_letter")
    .map((segment) => segment.text)
    .join("\n");
  return patterns.filter(([, pattern]) => pattern.test(written)).map(([name]) => name);
}
