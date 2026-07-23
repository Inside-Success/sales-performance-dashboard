import { createHash } from "node:crypto";

import authorityResolutionsJson from "@/lib/ask-sales-faq/v4/systemic/authority-resolutions.json";
import {
  v4SystemicRelationCompatibility,
  type V4SystemicRelation,
} from "@/lib/ask-sales-faq/v4/systemic/relations";
import type { V4SystemicNeed, V4SystemicPolicy } from "@/lib/ask-sales-faq/v4/systemic/types";

export type V4SystemicAuthorityResolution = {
  id: string;
  title: string;
  status: "source_resolved";
  effective_at: string;
  product_scopes: string[];
  relations: V4SystemicRelation[];
  match_groups: string[][];
  controlling_policy_ids: string[];
  excluded_policy_ids: string[];
  globally_retired_policy_ids?: string[];
  resolved_blocked_topic_ids: string[];
  authority_basis: string;
  source_ids: string[];
};

type ResolutionBundle = {
  schema_version: string;
  generated_at: string;
  resolutions: V4SystemicAuthorityResolution[];
};

const bundle = authorityResolutionsJson as ResolutionBundle;
const resolutions = bundle.resolutions.filter((resolution) => resolution.status === "source_resolved");
const globallyRetiredPolicyIds = new Set(resolutions.flatMap((resolution) => resolution.globally_retired_policy_ids || []));
const authorityResolutionVersion = `${bundle.schema_version}:${createHash("sha256")
  .update(JSON.stringify(resolutions))
  .digest("hex")
  .slice(0, 16)}`;

function normalize(value: string) {
  return value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9$%]+/g, " ").replace(/\s+/g, " ").trim();
}

function resolutionText(need: V4SystemicNeed) {
  // Authority decisions bind to the atomic need and its structured facets,
  // never to model-generated retrieval expansions. An expansion may improve
  // recall, but it cannot broaden a claim-scoped resolution or make one branch
  // of a compound question inherit another branch's authority decision.
  return normalize([need.authorityText || need.text, ...need.domains, ...need.actions, ...need.entities].join(" "));
}

function containsNormalizedPhrase(text: string, phrase: string) {
  const normalizedPhrase = normalize(phrase);
  if (!normalizedPhrase) return false;
  const textTokens = text.split(" ").filter(Boolean);
  const phraseTokens = normalizedPhrase.split(" ").filter(Boolean);
  if (!phraseTokens.length || phraseTokens.length > textTokens.length) return false;
  const tokenMatches = (candidate: string, expected: string) => {
    if (candidate === expected) return true;
    // Claim-scope matching remains lexical and directional, but accepts the
    // ordinary plural form of a singular register term (for example,
    // "freelancer" -> "freelancers"). This closes a recall hole without
    // introducing stemming, synonyms, or broad semantic matching.
    if (expected.length < 3) return false;
    if (candidate === `${expected}s` || candidate === `${expected}es`) return true;
    return expected.endsWith("y") && candidate === `${expected.slice(0, -1)}ies`;
  };
  const optionalScopeTokens = new Set(["main", "istv", "inside", "success", "tv"]);
  return textTokens.some((_, start) => {
    let textIndex = start;
    let phraseIndex = 0;
    let skippedScopeTokens = 0;
    while (textIndex < textTokens.length && phraseIndex < phraseTokens.length) {
      if (tokenMatches(textTokens[textIndex], phraseTokens[phraseIndex])) {
        textIndex += 1;
        phraseIndex += 1;
        continue;
      }
      // Product qualifiers may appear inside an otherwise exact registered
      // phrase ("different ISTV show" vs "different show"). Permit only a
      // small bounded set after matching has begun; never skip ordinary words
      // or use this as general fuzzy matching.
      if (
        phraseIndex > 0 &&
        phraseIndex < phraseTokens.length &&
        skippedScopeTokens < 3 &&
        optionalScopeTokens.has(textTokens[textIndex])
      ) {
        textIndex += 1;
        skippedScopeTokens += 1;
        continue;
      }
      return false;
    }
    return phraseIndex === phraseTokens.length;
  });
}

function scopeMatches(resolution: V4SystemicAuthorityResolution, need: V4SystemicNeed) {
  if (need.productScope === "unknown" || need.productScope === "comparison") return true;
  return resolution.product_scopes.some((scope) => scope === need.productScope || scope === "unknown" || scope === "product_agnostic");
}

export function getV4SystemicAuthorityResolutionVersion() {
  return authorityResolutionVersion;
}

export function getV4SystemicAuthorityResolutions() {
  return resolutions;
}

export function matchingV4SystemicAuthorityResolutions(need: V4SystemicNeed) {
  const text = resolutionText(need);
  return resolutions.filter((resolution) => {
    if (!scopeMatches(resolution, need)) return false;
    const relation = v4SystemicRelationCompatibility(need.relation, resolution.relations);
    // Claim-scoped authority is powerful enough to retire or promote sources,
    // so an unknown relationship is not safe evidence of a match. Require the
    // requested relationship to be exact or explicitly compatible before any
    // phrase groups can activate a resolution.
    if (relation !== "exact" && relation !== "compatible") return false;
    return resolution.match_groups.every((group) => group.some((term) => containsNormalizedPhrase(text, term)));
  });
}

export function v4SystemicResolutionPolicyDisposition(need: V4SystemicNeed, policyId: string) {
  if (globallyRetiredPolicyIds.has(policyId)) return "excluded" as const;
  const matching = matchingV4SystemicAuthorityResolutions(need);
  if (matching.some((resolution) => resolution.excluded_policy_ids.includes(policyId))) return "excluded" as const;
  if (matching.some((resolution) => resolution.controlling_policy_ids.includes(policyId))) return "controlling" as const;
  return "unresolved" as const;
}

export function v4SystemicResolvedBlockedTopicIds(need: V4SystemicNeed) {
  return new Set(matchingV4SystemicAuthorityResolutions(need).flatMap((resolution) => resolution.resolved_blocked_topic_ids));
}

export function validateV4SystemicAuthorityResolutions(policies: V4SystemicPolicy[], blockedTopicIds?: Iterable<string>) {
  const ids = new Set(policies.map((policy) => policy.id));
  const blockerIds = blockedTopicIds ? new Set(blockedTopicIds) : null;
  const errors: string[] = [];
  const seenResolutionIds = new Set<string>();
  for (const resolution of resolutions) {
    if (seenResolutionIds.has(resolution.id)) errors.push(`${resolution.id} is duplicated`);
    seenResolutionIds.add(resolution.id);
    if (!resolution.match_groups.length || resolution.match_groups.some((group) => !group.length)) {
      errors.push(`${resolution.id} has an empty claim-scope match group`);
    }
    if (!resolution.product_scopes.length) errors.push(`${resolution.id} has no product scope`);
    if (!resolution.relations.length || resolution.relations.includes("other")) errors.push(`${resolution.id} has no bounded relationship facet`);
    if (!resolution.controlling_policy_ids.length) errors.push(`${resolution.id} has no controlling policy`);
    const controlling = new Set(resolution.controlling_policy_ids);
    for (const id of [...resolution.excluded_policy_ids, ...(resolution.globally_retired_policy_ids || [])]) {
      if (controlling.has(id)) errors.push(`${resolution.id} both controls and excludes policy ${id}`);
    }
    for (const id of [...resolution.controlling_policy_ids, ...resolution.excluded_policy_ids, ...(resolution.globally_retired_policy_ids || [])]) {
      if (!ids.has(id)) errors.push(`${resolution.id} references missing policy ${id}`);
    }
    if (blockerIds) {
      for (const id of resolution.resolved_blocked_topic_ids) {
        if (!blockerIds.has(id)) errors.push(`${resolution.id} references missing blocked topic ${id}`);
      }
    }
    if (!resolution.authority_basis.trim()) errors.push(`${resolution.id} has no authority basis`);
    if (!resolution.source_ids.length) errors.push(`${resolution.id} has no source lineage`);
    const effective = Date.parse(resolution.effective_at);
    if (!Number.isFinite(effective)) errors.push(`${resolution.id} has an invalid effective_at`);
  }
  return [...new Set(errors)];
}
