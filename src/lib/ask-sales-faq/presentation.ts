export type AnswerDisplayList = {
  intro: string;
  items: string[];
};

export type AnswerDisplaySegment = {
  text: string;
  strong: boolean;
};

const INLINE_LIST_MARKER =
  /(?:^|\s+)[-–—]\s+(?=(?:\*\*[^*\n]{1,48}\*\*|[A-Z0-9][A-Za-z0-9/&()+'.\s-]{0,40})\s*:)/g;

export function parseAnswerDisplayList(value: string): AnswerDisplayList | null {
  const parts = value
    .replace(/\r/g, "")
    .trim()
    .split(INLINE_LIST_MARKER)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 3) return null;

  const intro = parts[0].endsWith(":") ? parts[0] : "";
  const items = intro ? parts.slice(1) : parts;
  if (items.length < 2 || items.some((item) => item.length < 3)) return null;

  return { intro, items };
}

export function parseAnswerDisplaySegments(value: string): AnswerDisplaySegment[] {
  const segments: AnswerDisplaySegment[] = [];
  const pattern = /\*\*([^*\n]+)\*\*/g;
  let cursor = 0;

  for (const match of value.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) segments.push({ text: value.slice(cursor, index), strong: false });
    segments.push({ text: match[1], strong: true });
    cursor = index + match[0].length;
  }

  if (cursor < value.length) segments.push({ text: value.slice(cursor), strong: false });
  return segments.length ? segments : [{ text: value, strong: false }];
}
