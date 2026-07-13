import type { AskSalesFaqStructuredAnswer } from "@/lib/ask-sales-faq/types";

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

const DISPLAY_STOPWORDS = new Set([
  "and", "are", "can", "current", "for", "from", "has", "have", "into", "listed", "offers", "payments",
  "plans", "prices", "that", "the", "these", "this", "with",
]);

function normalizeAnswerDisplayText(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function uniqueMeaningfulDisplayTokens(value: string) {
  return Array.from(new Set(
    value.match(/[a-z0-9$]+/g)?.filter((token) => token.length > 2 && !DISPLAY_STOPWORDS.has(token)) || [],
  ));
}

function uniqueNumericDisplayTokens(value: string) {
  return Array.from(new Set(
    value.match(/\$?\d[\d,]*(?:\.\d+)?/g)?.map((token) => token.replace(/[$,]/g, "")) || [],
  ));
}

export function shouldShowPlainAnswerWithStructured(content: string, answer: AskSalesFaqStructuredAnswer) {
  const normalizedContent = normalizeAnswerDisplayText(content);
  if (!normalizedContent || normalizedContent.length < 80) return false;

  const visibleStructuredText = normalizeAnswerDisplayText(
    [
      answer.summary,
      ...answer.sections.flatMap((section) => [section.title, section.body, ...(section.items || [])]),
    ]
      .filter(Boolean)
      .join(" "),
  );
  if (!visibleStructuredText) return true;
  if (visibleStructuredText.includes(normalizedContent)) return false;

  const contentTokens = uniqueMeaningfulDisplayTokens(normalizedContent);
  if (contentTokens.length < 6) return false;
  const coveredTokens = contentTokens.filter((token) => visibleStructuredText.includes(token)).length;
  const semanticCoverage = coveredTokens / contentTokens.length;
  const numericTokens = uniqueNumericDisplayTokens(normalizedContent);
  const structuredNumericTokens = new Set(uniqueNumericDisplayTokens(visibleStructuredText));
  const numericCoverage = numericTokens.length
    ? numericTokens.filter((token) => structuredNumericTokens.has(token)).length / numericTokens.length
    : 0;
  const structuredItemCount = answer.sections.reduce((total, section) => total + (section.items?.length || 0), 0);

  // Dense answer prose and structured cards often express the same package,
  // price, or step table with different connective words. Suppress the prose
  // only when the card preserves both the material vocabulary and every
  // enumerated value; an extra caveat or boundary therefore remains visible.
  if (structuredItemCount >= 3 && semanticCoverage >= 0.78 && numericTokens.length >= 2 && numericCoverage === 1) {
    return false;
  }
  return semanticCoverage < 0.78;
}

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
