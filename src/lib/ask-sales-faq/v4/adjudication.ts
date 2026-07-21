export type V4GoldExpectedDisposition =
  | "answer"
  | "partial"
  | "route"
  | "clarify"
  | "live_lookup"
  | "artifact"
  | "conversation";

export type V4AdjudicationProvenance = {
  schemaVersion: 1;
  adjudicatorId: string;
  adjudicatedAt: string;
  methodology: string;
  sourceRefs: string[];
  independentFromSystems: true;
  knowledgeVersion: string;
};

export type V4GoldNeed = {
  id: string;
  text: string;
  atomic: true;
  expectedDisposition: V4GoldExpectedDisposition;
  expectedRouteKey: string | null;
  policyIds: string[];
  blockedTopicIds: string[];
  goldContext: string[];
  blockedContext: string[];
};

export type V4GoldReferenceCatalog = {
  policies: Array<{ id: string; decisionKey?: string; policyKey?: string }>;
  blockedTopics: Array<{ id: string }>;
};

export class V4AdjudicationParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "V4AdjudicationParseError";
  }
}

function record(value: unknown, label: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new V4AdjudicationParseError(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string, maximum: number) {
  if (typeof value !== "string" || !value.trim()) {
    throw new V4AdjudicationParseError(`${label} must be a non-empty string.`);
  }
  if (value.trim().length > maximum) {
    throw new V4AdjudicationParseError(`${label} must be at most ${maximum} characters.`);
  }
  return value.trim();
}

function stringList(value: unknown, label: string, maximum: number) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new V4AdjudicationParseError(`${label} must be an array of non-empty strings.`);
  }
  if (value.length > maximum) {
    throw new V4AdjudicationParseError(`${label} may contain at most ${maximum} entries.`);
  }
  const normalized = value.map((item) => (item as string).trim());
  if (new Set(normalized).size !== normalized.length) {
    throw new V4AdjudicationParseError(`${label} must not contain duplicate entries.`);
  }
  return normalized;
}

function isoTimestamp(value: unknown, label: string) {
  const normalized = text(value, label, 80);
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== normalized) {
    throw new V4AdjudicationParseError(`${label} must be a canonical ISO-8601 timestamp.`);
  }
  return normalized;
}

export function parseV4AdjudicationProvenance(value: unknown, expectedKnowledgeVersion: string) {
  if (value === undefined || value === null) return null;
  const raw = record(value, "adjudication");
  if (raw.schemaVersion !== 1) throw new V4AdjudicationParseError("adjudication.schemaVersion must be 1.");
  if (raw.independentFromSystems !== true) {
    throw new V4AdjudicationParseError("adjudication.independentFromSystems must be true.");
  }
  const knowledgeVersion = text(raw.knowledgeVersion, "adjudication.knowledgeVersion", 200);
  if (knowledgeVersion !== expectedKnowledgeVersion) {
    throw new V4AdjudicationParseError(
      `adjudication.knowledgeVersion ${knowledgeVersion} does not match current knowledge ${expectedKnowledgeVersion}.`,
    );
  }
  const sourceRefs = stringList(raw.sourceRefs, "adjudication.sourceRefs", 80);
  if (!sourceRefs.length) throw new V4AdjudicationParseError("adjudication.sourceRefs must contain at least one traceable source.");
  return {
    schemaVersion: 1,
    adjudicatorId: text(raw.adjudicatorId, "adjudication.adjudicatorId", 200),
    adjudicatedAt: isoTimestamp(raw.adjudicatedAt, "adjudication.adjudicatedAt"),
    methodology: text(raw.methodology, "adjudication.methodology", 2000),
    sourceRefs,
    independentFromSystems: true,
    knowledgeVersion,
  } satisfies V4AdjudicationProvenance;
}

function resolvePolicyReference(reference: string, catalog: V4GoldReferenceCatalog, label: string) {
  const matches = catalog.policies.filter((policy) =>
    policy.id === reference || policy.decisionKey === reference || policy.policyKey === reference,
  );
  if (!matches.length) throw new V4AdjudicationParseError(`${label} does not resolve to a governed policy: ${reference}`);
  const ids = [...new Set(matches.map((policy) => policy.id))];
  if (ids.length !== 1) {
    throw new V4AdjudicationParseError(`${label} is ambiguous and resolves to ${ids.length} policies: ${reference}`);
  }
  return ids[0];
}

function resolveBlockedReference(reference: string, catalog: V4GoldReferenceCatalog, label: string) {
  if (!catalog.blockedTopics.some((topic) => topic.id === reference)) {
    throw new V4AdjudicationParseError(`${label} does not resolve to a governed blocked topic: ${reference}`);
  }
  return reference;
}

const dispositions = new Set<V4GoldExpectedDisposition>([
  "answer",
  "partial",
  "route",
  "clarify",
  "live_lookup",
  "artifact",
  "conversation",
]);

export function parseV4GoldNeeds(value: unknown, catalog: V4GoldReferenceCatalog, label = "goldNeeds") {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || !value.length || value.length > 20) {
    throw new V4AdjudicationParseError(`${label} must contain from 1 to 20 atomic needs.`);
  }
  const needs = value.map((entry, index): V4GoldNeed => {
    const raw = record(entry, `${label}[${index}]`);
    const id = text(raw.id, `${label}[${index}].id`, 80);
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id)) {
      throw new V4AdjudicationParseError(`${label}[${index}].id contains unsupported characters.`);
    }
    if (raw.atomic !== true) {
      throw new V4AdjudicationParseError(`${label}[${index}].atomic must be true.`);
    }
    if (typeof raw.expectedDisposition !== "string" || !dispositions.has(raw.expectedDisposition as V4GoldExpectedDisposition)) {
      throw new V4AdjudicationParseError(`${label}[${index}].expectedDisposition is invalid.`);
    }
    const expectedDisposition = raw.expectedDisposition as V4GoldExpectedDisposition;
    const policyIds = stringList(raw.policyIds, `${label}[${index}].policyIds`, 20)
      .map((reference) => resolvePolicyReference(reference, catalog, `${label}[${index}].policyIds`));
    const blockedTopicIds = stringList(raw.blockedTopicIds, `${label}[${index}].blockedTopicIds`, 20)
      .map((reference) => resolveBlockedReference(reference, catalog, `${label}[${index}].blockedTopicIds`));
    const goldContext = stringList(raw.goldContext, `${label}[${index}].goldContext`, 20);
    const blockedContext = stringList(raw.blockedContext, `${label}[${index}].blockedContext`, 20);
    const answerEvidence = policyIds.length + goldContext.length;
    const unresolvedEvidence = blockedTopicIds.length + blockedContext.length;
    if (["answer", "partial", "conversation"].includes(expectedDisposition) && answerEvidence === 0) {
      throw new V4AdjudicationParseError(`${label}[${index}] requires answer evidence for ${expectedDisposition}.`);
    }
    if (["route", "clarify", "live_lookup", "artifact"].includes(expectedDisposition) && unresolvedEvidence === 0) {
      throw new V4AdjudicationParseError(`${label}[${index}] requires blocked evidence for ${expectedDisposition}.`);
    }
    const expectedRouteKey = raw.expectedRouteKey === undefined || raw.expectedRouteKey === null
      ? null
      : text(raw.expectedRouteKey, `${label}[${index}].expectedRouteKey`, 100);
    return {
      id,
      text: text(raw.text, `${label}[${index}].text`, 1200),
      atomic: true,
      expectedDisposition,
      expectedRouteKey,
      policyIds: [...new Set(policyIds)],
      blockedTopicIds,
      goldContext,
      blockedContext,
    };
  });
  if (new Set(needs.map((need) => need.id)).size !== needs.length) {
    throw new V4AdjudicationParseError(`${label} must use unique need IDs.`);
  }
  return needs;
}
