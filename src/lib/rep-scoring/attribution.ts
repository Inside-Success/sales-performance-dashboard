export type RepIdentity = {
  email: string;
  name: string;
};

export type TranscriptTurn = {
  timestamp: string;
  speaker: string;
  text: string;
};

export type SpeakerResolution = {
  status: "resolved" | "quarantine";
  reason: string;
  confidence: "high" | "low";
  method: string;
  assigned: RepIdentity;
  resolved: RepIdentity | null;
  substituted: boolean;
  allowedSpeakerLabels: string[];
  diagnostics: {
    matchedRepCount: number;
    matchedTurns: number;
    matchedWords: number;
    primaryShare: number;
    secondShare: number;
  };
};

const GENERIC_IDENTITY = /^(casting|sales|closer|booking|appointment|inside success|team|admin|host|speaker|unknown)( team| rep| closer| sales)?$/i;
const COVERAGE_LANGUAGE = /\b(covering for|cover for|stepping in|stepped in|jumping in|jumped in|filling in|taking over|running late|meant to meet with|on behalf of)\b/i;

export function parseTranscriptTurns(transcript: string): TranscriptTurn[] {
  const turns: TranscriptTurn[] = [];
  const linePattern = /^\s*\[([^\]]+)]\s*([^:\n]{1,100}):\s*(.*)$/;
  for (const line of transcript.split(/\r?\n/)) {
    const match = line.match(linePattern);
    if (!match) continue;
    turns.push({ timestamp: match[1].trim(), speaker: match[2].trim(), text: match[3].trim() });
  }
  return turns;
}

export function normalizeIdentity(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9@.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isGenericIdentity(value: string) {
  const normalized = normalizeIdentity(value).replace(/@.*$/, "").replace(/[._-]+/g, " ").trim();
  return !normalized || GENERIC_IDENTITY.test(normalized);
}

export function resolveSpeakingRep(
  transcript: string,
  assigned: RepIdentity,
  roster: RepIdentity[],
): SpeakerResolution {
  const uniqueRoster = dedupeRoster(roster);
  const turns = parseTranscriptTurns(transcript);
  const aliases = buildAliasIndex(uniqueRoster);
  const stats = new Map<string, { identity: RepIdentity; labels: Set<string>; turns: number; words: number }>();

  for (const turn of turns) {
    const identity = matchSpeakerIdentity(turn.speaker, aliases);
    if (!identity) continue;
    const key = identity.email.toLowerCase();
    const entry = stats.get(key) || { identity, labels: new Set<string>(), turns: 0, words: 0 };
    entry.labels.add(turn.speaker);
    entry.turns += 1;
    entry.words += wordCount(turn.text);
    stats.set(key, entry);
  }

  const ranked = [...stats.values()].sort((a, b) => b.words - a.words || b.turns - a.turns || a.identity.email.localeCompare(b.identity.email));
  const totalWords = ranked.reduce((sum, entry) => sum + entry.words, 0);
  const primary = ranked[0];
  const second = ranked[1];
  const diagnostics = {
    matchedRepCount: ranked.length,
    matchedTurns: ranked.reduce((sum, entry) => sum + entry.turns, 0),
    matchedWords: totalWords,
    primaryShare: totalWords ? round(primary.words / totalWords) : 0,
    secondShare: totalWords && second ? round(second.words / totalWords) : 0,
  };
  const base = { assigned, diagnostics };

  if (!primary || primary.turns < 2 || primary.words < 12) {
    return quarantine("unmapped_or_insufficient_rep_speech", base);
  }

  const dominant = diagnostics.primaryShare >= 0.65 && diagnostics.secondShare <= 0.25;
  if (ranked.length > 1 && !dominant) {
    return quarantine("multiple_rep_speakers_ambiguous", base);
  }

  const assignedEmail = assigned.email.toLowerCase();
  const substituted = primary.identity.email.toLowerCase() !== assignedEmail;
  if (substituted && !dominant && ranked.length > 1) {
    return quarantine("substitute_not_dominant", base);
  }

  const explicitCoverage = COVERAGE_LANGUAGE.test(transcript);
  if (substituted && ranked.length > 1 && !explicitCoverage) {
    return quarantine("substitute_resolution_low_confidence", base);
  }

  return {
    status: "resolved",
    reason: substituted ? (explicitCoverage ? "known_substitute_explicit_handoff" : "known_substitute_only_rep_speaker") : "assigned_rep_is_primary_speaker",
    confidence: "high",
    method: substituted ? "transcript_roster_substitute_v1" : "transcript_roster_assigned_v1",
    assigned,
    resolved: primary.identity,
    substituted,
    allowedSpeakerLabels: [...primary.labels].sort(),
    diagnostics,
  };
}

function quarantine(reason: string, input: { assigned: RepIdentity; diagnostics: SpeakerResolution["diagnostics"] }): SpeakerResolution {
  return {
    status: "quarantine",
    reason,
    confidence: "low",
    method: "transcript_roster_unresolved_v1",
    assigned: input.assigned,
    resolved: null,
    substituted: false,
    allowedSpeakerLabels: [],
    diagnostics: input.diagnostics,
  };
}

function dedupeRoster(roster: RepIdentity[]) {
  const byEmail = new Map<string, RepIdentity>();
  for (const identity of roster) {
    const email = identity.email.trim().toLowerCase();
    const name = identity.name.trim();
    if (!email || !name || isGenericIdentity(name)) continue;
    if (!byEmail.has(email)) byEmail.set(email, { email, name });
  }
  return [...byEmail.values()];
}

function buildAliasIndex(roster: RepIdentity[]) {
  const candidates = new Map<string, RepIdentity[]>();
  for (const identity of roster) {
    const emailLocal = identity.email.split("@")[0].replace(/[._-]+/g, " ");
    const aliases = new Set([
      normalizeIdentity(identity.name),
      normalizeIdentity(identity.email),
      normalizeIdentity(emailLocal),
      normalizeIdentity(identity.name).split(" ")[0],
    ]);
    for (const alias of aliases) {
      if (!alias || alias.length < 3) continue;
      candidates.set(alias, [...(candidates.get(alias) || []), identity]);
    }
  }
  return new Map([...candidates.entries()].flatMap(([alias, identities]) => identities.length === 1 ? [[alias, identities[0]] as const] : []));
}

function matchSpeakerIdentity(label: string, aliases: Map<string, RepIdentity>) {
  const normalized = normalizeIdentity(label)
    .replace(/\b(casting manager|sales manager|sales rep|sales closer|closer|manager|host)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const exact = aliases.get(normalized);
  if (exact) return exact;
  if (normalized.length < 3 || normalized.includes(" ")) return undefined;
  const prefixMatches = new Map<string, RepIdentity>();
  for (const [alias, identity] of aliases) {
    if (!alias.includes(" ") && alias.length >= 4 && alias.startsWith(normalized)) prefixMatches.set(identity.email, identity);
  }
  return prefixMatches.size === 1 ? [...prefixMatches.values()][0] : undefined;
}

function wordCount(value: string) {
  return value.trim() ? value.trim().split(/\s+/).length : 0;
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}
