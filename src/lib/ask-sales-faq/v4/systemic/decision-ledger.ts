import "server-only";

import { createHash } from "node:crypto";

import { getV4SystemicCorpus } from "@/lib/ask-sales-faq/v4/systemic/corpus";
import {
  inferV4SystemicPolicyRelations,
  inferV4SystemicRelation,
  type V4SystemicRelation,
} from "@/lib/ask-sales-faq/v4/systemic/relations";
import type { V4SystemicNeed, V4SystemicPolicy } from "@/lib/ask-sales-faq/v4/systemic/types";

export type V4AtomicDecision = {
  id: string;
  parentPolicyId: string;
  decisionKey: string;
  statement: string;
  conditions: string;
  boundaries: string;
  searchText: string;
  relations: V4SystemicRelation[];
  productScopes: string[];
  sourceIds: string[];
  sourceApprovers: string[];
  sourceClass: V4SystemicPolicy["systemic"]["sourceClass"];
  answerability: V4SystemicPolicy["answerability"];
  temporalRisk: V4SystemicPolicy["systemic"]["temporalRisk"];
  effectiveAt: string;
  explicitlyCurrent: boolean;
  explicitlySuperseding: boolean;
};

const STOP_WORDS = new Set([
  "a", "about", "after", "all", "also", "an", "and", "are", "as", "at", "be", "before", "but", "by", "can", "client", "clients", "do", "does", "for", "from", "how", "i", "if", "in", "is", "it", "may", "of", "on", "or", "our", "prospect", "prospects", "rep", "reps", "sales", "should", "that", "the", "their", "they", "this", "to", "use", "we", "what", "when", "where", "which", "who", "will", "with", "would", "you",
]);

const SEMANTIC_EQUIVALENTS: Record<string, string[]> = {
  approve: ["approval", "authorize", "permission", "greenlight"],
  approval: ["approve", "authorize", "permission", "greenlight"],
  book: ["booking", "schedule", "appointment"],
  booking: ["book", "schedule", "appointment"],
  cadence: ["sequence", "steps", "procedure", "sop"],
  call: ["meeting", "appointment"],
  cancel: ["remove", "stop", "void"],
  correct: ["fix", "edit", "update", "repair"],
  duration: ["period", "term", "timeline", "long"],
  guarantee: ["guaranteed", "placement", "hosting", "minimum"],
  note: ["record", "document", "log", "keap"],
  owner: ["ownership", "credit", "responsible", "approver"],
  placement: ["hosting", "network", "guarantee", "duration"],
  record: ["note", "document", "log", "keap"],
  script: ["talktrack", "wording", "template"],
  sequence: ["cadence", "steps", "procedure", "sop"],
};

function normalize(value: string) {
  return value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9$%]+/g, " ").replace(/\s+/g, " ").trim();
}

function stem(value: string) {
  if (value.length <= 4) return value;
  return value
    .replace(/(?:ies)$/i, "y")
    .replace(/(?:ing|ers|er|ed|es|s)$/i, "");
}

export function v4AtomicTerms(value: string) {
  const base = normalize(value).split(" ")
    .map(stem)
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));
  return [...new Set(base.flatMap((token) => [
    token,
    ...(SEMANTIC_EQUIVALENTS[token] || []).map(stem),
  ]))];
}

function extractSection(decision: string, label: "Conditions" | "Boundaries") {
  const match = decision.match(new RegExp(`\\b${label}:\\s*([\\s\\S]*?)(?=\\b(?:Conditions|Boundaries):|$)`, "i"));
  return match?.[1]?.trim() || "";
}

function decisionStatements(decision: string) {
  const main = decision.split(/\b(?:Conditions|Boundaries):/i)[0].trim();
  const statements = main
    .split(/(?<=[.!?])\s+|\s*\n+\s*/)
    .map((value) => value.trim())
    .filter((value) => value.length >= 8);
  return statements.length ? statements : [main || decision.trim()].filter(Boolean);
}

function explicitlyCurrent(value: string) {
  return /\b(?:current(?:ly)?|now|latest|today|as of)\b/i.test(value);
}

function explicitlySuperseding(value: string) {
  return /\b(?:previously|used to|formerly|no longer|has been (?:changed|extended|replaced|updated)|changed (?:from|to)|extended (?:from|to)|now\b.{0,80}\b(?:instead|not)|not\s+[$£€]?\d)\b/i.test(value);
}

function compilePolicy(policy: V4SystemicPolicy): V4AtomicDecision[] {
  const conditions = extractSection(policy.decision, "Conditions");
  const boundaries = extractSection(policy.decision, "Boundaries");
  const statements = decisionStatements(policy.decision);
  return statements.map((statement, index) => {
    const relationSources = {
      title: policy.title,
      question_families: policy.question_families,
      decision: statement,
      actions: policy.actions,
    };
    const relations = inferV4SystemicPolicyRelations(relationSources);
    const statementRelation = inferV4SystemicRelation(statement);
    if (statementRelation !== "other" && !relations.includes(statementRelation)) relations.push(statementRelation);
    const searchText = [
      policy.title,
      ...policy.question_families,
      statement,
      conditions,
      boundaries,
      ...policy.product_scopes,
      ...policy.domains,
      ...policy.actions,
      ...policy.entities,
    ].filter(Boolean).join(" ");
    return {
      id: `${policy.id}::a${index + 1}`,
      parentPolicyId: policy.id,
      decisionKey: policy.decision_key,
      statement,
      conditions,
      boundaries,
      searchText,
      relations,
      productScopes: policy.product_scopes,
      sourceIds: policy.systemic.sourceIds,
      sourceApprovers: policy.source.approved_by,
      sourceClass: policy.systemic.sourceClass,
      answerability: policy.answerability,
      temporalRisk: policy.systemic.temporalRisk,
      effectiveAt: policy.effective_at,
      explicitlyCurrent: explicitlyCurrent(statement),
      explicitlySuperseding: explicitlySuperseding(statement),
    };
  });
}

const ledger = getV4SystemicCorpus().flatMap(compilePolicy);
const atomsByPolicy = new Map<string, V4AtomicDecision[]>();
for (const atom of ledger) atomsByPolicy.set(atom.parentPolicyId, [...(atomsByPolicy.get(atom.parentPolicyId) || []), atom]);

const ledgerVersion = createHash("sha256")
  .update(JSON.stringify(ledger.map((atom) => ({
    id: atom.id,
    statement: atom.statement,
    conditions: atom.conditions,
    boundaries: atom.boundaries,
    sourceIds: atom.sourceIds,
  }))))
  .digest("hex")
  .slice(0, 16);

export function getV4AtomicDecisionLedger() {
  return ledger;
}

export function getV4AtomicDecisionLedgerVersion() {
  return `ask-sales-v4.4-atomic:${ledgerVersion}`;
}

export function getV4AtomicDecisionsForPolicy(policyId: string) {
  return atomsByPolicy.get(policyId) || [];
}

function overlapScore(left: string[], right: string[]) {
  if (!left.length || !right.length) return 0;
  const rightSet = new Set(right);
  const shared = [...new Set(left)].filter((term) => rightSet.has(term)).length;
  return shared / Math.max(1, Math.min(new Set(left).size, new Set(right).size));
}

export function bestV4AtomicDecisionForNeed(policy: V4SystemicPolicy, need: Pick<V4SystemicNeed, "text" | "authorityText" | "originalRequestText" | "retrievalQueries" | "actions" | "entities" | "relation">) {
  const query = [
    need.authorityText || need.originalRequestText || need.text,
    ...need.retrievalQueries,
    ...need.actions,
    ...need.entities,
  ].join(" ");
  const queryTerms = v4AtomicTerms(query);
  return [...getV4AtomicDecisionsForPolicy(policy.id)]
    .map((atom) => ({
      atom,
      score: overlapScore(queryTerms, v4AtomicTerms(atom.searchText)) + (atom.relations.includes(need.relation) ? 0.45 : 0),
    }))
    .sort((left, right) => right.score - left.score || left.atom.id.localeCompare(right.atom.id))[0]?.atom || null;
}

export function v4AtomicDecisionEvidence(atom: V4AtomicDecision) {
  return [
    atom.statement,
    atom.conditions ? `Conditions: ${atom.conditions}` : "",
    atom.boundaries ? `Boundaries: ${atom.boundaries}` : "",
  ].filter(Boolean).join(" ");
}

export function v4AtomicDecisionIsSafeStableSupport(atom: V4AtomicDecision, policy: V4SystemicPolicy) {
  if (policy.answerability === "answer_evidence") return policy.systemic.temporalRisk === "stable" && !policy.systemic.ownerReviewRequired;
  if (policy.answerability !== "route_or_support" || policy.systemic.temporalRisk !== "stable" || policy.systemic.ownerReviewRequired) return false;
  const flags = policy.quality_flags.join(" ");
  if (/unsupported deterministic facts|source reply is tentative|multiple authoritative source|requires current|owner review/i.test(flags)) return false;
  if (/\b(?:probably|likely|might|may need|could be|not fully answerable)\b/i.test(atom.statement)) return false;
  if (/[$£€%]|\b\d+(?:\.\d+)?\s*(?:minutes?|hours?|days?|weeks?|months?|years?|payments?|installments?)\b/i.test(atom.statement)) return false;
  if (/\b(?:current(?:ly)?|latest|today|tomorrow|this week|next week|available now|status)\b/i.test(atom.statement)) return false;
  return atom.sourceIds.length > 0 && atom.sourceApprovers.length > 0;
}
