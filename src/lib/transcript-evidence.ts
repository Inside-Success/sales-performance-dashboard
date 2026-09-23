export type TranscriptLine = {
  text: string;
  time: string | null;
  seconds: number | null;
};

export type TranscriptMatch = {
  index: number;
  kind: "exact" | "nearby" | "missing";
};

const LINE_TIME = /^\s*\\?\[?((?:\d{1,3}:)?\d{1,2}:\d{2}(?:\.\d{1,3})?)\]?/;

export function timestampSeconds(value: string): number | null {
  const parts = value.replace(/\.\d+$/, "").split(":").map(Number);
  if (parts.length !== 2 && parts.length !== 3) return null;
  if (parts.some((part) => !Number.isInteger(part) || part < 0)) return null;
  const [hours, minutes, seconds] = parts.length === 3 ? parts : [0, parts[0], parts[1]];
  if ((parts.length === 3 && minutes > 59) || seconds > 59) return null;
  return hours * 3600 + minutes * 60 + seconds;
}

export function parseTranscriptLines(transcript: string): TranscriptLine[] {
  return transcript.split(/\r?\n/).map((text) => {
    const time = text.match(LINE_TIME)?.[1] || null;
    return { text, time, seconds: time ? timestampSeconds(time) : null };
  });
}

export function findTranscriptMatch(lines: TranscriptLine[], timestamp: string): TranscriptMatch {
  const target = timestampSeconds(timestamp);
  if (target === null) return { index: -1, kind: "missing" };

  const exact = lines.findIndex((line) => line.seconds === target);
  if (exact >= 0) return { index: exact, kind: "exact" };

  let nearest = -1;
  let distance = Infinity;
  for (let index = 0; index < lines.length; index += 1) {
    const seconds = lines[index].seconds;
    if (seconds === null) continue;
    const difference = Math.abs(seconds - target);
    if (difference < distance) {
      nearest = index;
      distance = difference;
    }
  }

  return distance <= 10
    ? { index: nearest, kind: "nearby" }
    : { index: -1, kind: "missing" };
}
