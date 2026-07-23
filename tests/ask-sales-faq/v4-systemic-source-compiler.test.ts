import { describe, expect, it } from "vitest";

import type { V3Policy } from "@/lib/ask-sales-faq/v3/types";
import {
  compileV4SystemicOperationalKnowledge,
  v4SystemicSourcePartition,
  type V4SystemicClassifiedDecision,
  type V4SystemicClassifiedThread,
  type V4SystemicClassificationCheckpoint,
  type V4SystemicSourceThread,
} from "@/lib/ask-sales-faq/v4/systemic/source-compiler";

const routeCatalog = {
  sales_policy: { channel: "the sales policy channel", description: "Policy" },
  sales_tech: { channel: "the sales tech channel", description: "Tech" },
  finance: { channel: "the finance channel", description: "Finance" },
  fulfillment: { channel: "the fulfillment hotline", description: "Fulfillment" },
  greenlight: { channel: "the greenlight channel", description: "Greenlight" },
};

function sourceId(label: string, partition: "development" | "holdout") {
  for (let index = 0; index < 10_000; index += 1) {
    const id = `slack:test:${label}:${index}`;
    if (v4SystemicSourcePartition(id) === partition) return id;
  }
  throw new Error(`unable to create ${partition} source ID`);
}

function source(label: string, question: string, reply: string, partition: "development" | "holdout" = "development"): V4SystemicSourceThread {
  return {
    source_id: sourceId(label, partition),
    root_ts: "1777500000.000000",
    root_time: "2026-04-30 00:00:00 PKT",
    question,
    authority_replies: [{ authority: "madeline", message_ts: "1777500001.000000", text: reply }],
  };
}

function decision(overrides: Partial<V4SystemicClassifiedDecision> = {}): V4SystemicClassifiedDecision {
  return {
    decision_key: "virtual-studio-walkthrough",
    title: "Virtual studio walkthrough",
    question_families: ["Can prospects receive the virtual studio walkthrough?"],
    decision: "Prospects may receive the approved virtual studio walkthrough.",
    conditions: [],
    exclusions: [],
    product_scopes: ["main_istv"],
    domains: ["studio"],
    actions: ["share"],
    entities: ["virtual studio walkthrough"],
    route_key: "sales_policy",
    answerability: "answer",
    temporal_risk: "stable",
    scope_risk: "general",
    authority_assessment: "direct_authority",
    owner_review_required: false,
    confidence: 0.96,
    reason: "Direct answer.",
    ...overrides,
  };
}

function classified(item: V4SystemicSourceThread, decisions: V4SystemicClassifiedDecision[], threadClassification: V4SystemicClassifiedThread["thread_classification"] = "reusable_answer"): V4SystemicClassifiedThread {
  return { source_id: item.source_id, thread_classification: threadClassification, decisions };
}

function checkpoint(items: V4SystemicClassifiedThread[]): V4SystemicClassificationCheckpoint {
  return {
    schema_version: "test",
    input_sha256: "test",
    model: "test",
    completed: Object.fromEntries(items.map((item) => [item.source_id, item])),
    failures: {},
  };
}

describe("V4 systemic operational knowledge compiler", () => {
  it("publishes only stable direct evidence while sealing evaluation questions rather than withholding knowledge", () => {
    const stable = source("stable", "Can prospects receive the approved virtual studio walkthrough?", "Yes, prospects may receive the approved virtual studio walkthrough.");
    const timeSensitive = source("time", "What is the current event schedule?", "The current event schedule is next month.");
    const tentative = source("tentative", "Can prospects use a studio walkthrough?", "I think they should be able to use the studio walkthrough, but let me confirm.");
    const heldOut = source("holdout", "Can prospects receive the approved virtual studio walkthrough?", "Yes, prospects may receive the approved virtual studio walkthrough.", "holdout");
    const result = compileV4SystemicOperationalKnowledge({
      sources: [stable, timeSensitive, tentative, heldOut],
      checkpoint: checkpoint([
        classified(stable, [decision()]),
        classified(timeSensitive, [decision({
          decision_key: "current-event-schedule",
          title: "Current event schedule",
          question_families: ["What is the current event schedule?"],
          decision: "The current event schedule is next month.",
          temporal_risk: "stable",
          route_key: "sales_policy",
        })]),
        classified(tentative, [decision({ decision_key: "tentative-walkthrough" })]),
        classified(heldOut, [decision()]),
      ]),
      governedPolicies: [],
      routeCatalog,
    });

    expect(result.holdout).toHaveLength(1);
    expect(result.holdout[0]?.sourceId).toBe(heldOut.source_id);
    expect(result.policies.some((policy) => policy.source.ids.includes(heldOut.source_id))).toBe(true);
    expect(result.metrics.runtimeThreads).toBe(4);
    expect(result.policies.find((policy) => policy.decision_key === "virtual-studio-walkthrough")?.answerability).toBe("answer_evidence");
    expect(result.policies.find((policy) => policy.decision_key === "current-event-schedule")).toMatchObject({
      answerability: "route_or_support",
      systemic: { temporalRisk: "time_sensitive" },
    });
    expect(result.policies.find((policy) => policy.decision_key === "tentative-walkthrough")?.answerability).toBe("route_or_support");
  });

  it("merges equivalent source records and withholds materially conflicting decisions", () => {
    const first = source("duplicate-one", "Can prospects receive the approved virtual studio walkthrough?", "Yes, prospects may receive the approved virtual studio walkthrough.");
    const second = source("duplicate-two", "Can prospects receive the approved virtual studio walkthrough?", "Yes, prospects may receive the approved virtual studio walkthrough.");
    const negative = source("conflict-no", "Does freelancing alone qualify someone automatically?", "No, freelancing alone does not qualify someone automatically.");
    const positive = source("conflict-yes", "Does freelancing alone qualify someone automatically?", "Yes, freelancing alone qualifies someone automatically.");
    const result = compileV4SystemicOperationalKnowledge({
      sources: [first, second, negative, positive],
      checkpoint: checkpoint([
        classified(first, [decision()]),
        classified(second, [decision()]),
        classified(negative, [decision({
          decision_key: "freelancing-automatic-qualification",
          title: "Freelancing qualification",
          question_families: ["Does freelancing alone qualify someone automatically?"],
          decision: "Freelancing alone does not qualify someone automatically.",
          domains: ["qualification"],
          actions: ["qualify"],
          entities: ["freelancers"],
          route_key: "greenlight",
        })]),
        classified(positive, [decision({
          decision_key: "freelancing-automatic-qualification",
          title: "Freelancing qualification",
          question_families: ["Does freelancing alone qualify someone automatically?"],
          decision: "Freelancing alone qualifies someone automatically.",
          domains: ["qualification"],
          actions: ["qualify"],
          entities: ["freelancers"],
          route_key: "greenlight",
        })]),
      ]),
      governedPolicies: [],
      routeCatalog,
    });

    const duplicate = result.policies.find((policy) => policy.decision_key === "virtual-studio-walkthrough");
    expect(duplicate?.source.ids).toHaveLength(2);
    expect(result.metrics.exactDuplicatesMerged).toBeGreaterThanOrEqual(1);
    expect(result.metrics.conflictingDecisionGroups).toBe(1);
    expect(result.policies.filter((policy) => policy.decision_key === "freelancing-automatic-qualification"))
      .toEqual(expect.arrayContaining([expect.objectContaining({ answerability: "route_or_support" })]));
    expect(result.policies.filter((policy) => policy.decision_key === "freelancing-automatic-qualification").some((policy) => policy.answerability === "answer_evidence")).toBe(false);
  });

  it("keeps Rich's answer and withholds a conflicting Madeline answer for the same decision and scope", () => {
    const richSource = source("rich-reapply", "How long must a main ISTV prospect wait to reapply?", "The minimum wait is three months.");
    richSource.authority_replies = [{ authority: "rich", message_ts: "1777500001.000000", text: "The minimum wait is three months." }];
    const madelineSource = source("madeline-reapply", "How long must a main ISTV prospect wait to reapply?", "The minimum wait is six months.");
    const richDecision = decision({
      decision_key: "main-istv-reapplication-minimum",
      title: "Main ISTV reapplication minimum",
      question_families: ["How long must a main ISTV prospect wait to reapply?"],
      decision: "The minimum wait is three months.",
      product_scopes: ["main_istv"],
      domains: ["reapplication"],
      actions: ["wait", "reapply"],
      entities: ["main ISTV prospect"],
    });
    const madelineDecision = { ...richDecision, decision: "The minimum wait is six months." };
    const result = compileV4SystemicOperationalKnowledge({
      sources: [richSource, madelineSource],
      checkpoint: checkpoint([
        classified(richSource, [richDecision]),
        classified(madelineSource, [madelineDecision]),
      ]),
      governedPolicies: [],
      routeCatalog,
    });

    const reapplyPolicies = result.policies.filter((policy) => policy.decision_key === "main-istv-reapplication-minimum");
    expect(reapplyPolicies.find((policy) => policy.source.approved_by.includes("Rich"))).toMatchObject({
      answerability: "answer_evidence",
      authority: 10,
    });
    expect(reapplyPolicies.find((policy) => policy.source.approved_by.includes("Madeline"))).toMatchObject({
      answerability: "route_or_support",
    });
  });

  it("keeps stable ownership-check procedures answerable without treating an assigned owner as a live owner lookup", () => {
    const item = source(
      "assigned-owner-procedure",
      "A lead has an assigned owner in HubSpot but no appointments in Keap. How do I check prior contact?",
      "I guess you would have to check notes in Keap and if you see anything DM the rep who made the notes, otherwise call the applicant and ask if anyone contacted them.",
    );
    const result = compileV4SystemicOperationalKnowledge({
      sources: [item],
      checkpoint: checkpoint([classified(item, [decision({
        decision_key: "lead-with-hubspot-owner-no-keap-appointments",
        title: "Check Keap notes and contact lead if no appointments",
        question_families: ["How to handle a lead with a HubSpot owner but no Keap appointments?"],
        decision: "Check notes in Keap. If notes exist, DM the rep who made them. Otherwise, call the applicant and ask if anyone from ISTV has contacted them.",
        conditions: ["Lead has an assigned owner in HubSpot but no appointments in Keap"],
        exclusions: ["Does not address leads with appointments"],
        actions: ["investigate lead"],
        entities: ["Keap notes"],
        scope_risk: "scoped",
        confidence: 0.9,
      })])]),
      governedPolicies: [],
      routeCatalog,
    });

    expect(result.policies).toEqual([
      expect.objectContaining({
        decision_key: "lead-with-hubspot-owner-no-keap-appointments",
        answerability: "answer_evidence",
        systemic: expect.objectContaining({ temporalRisk: "stable" }),
      }),
    ]);
  });

  it("still withholds genuinely live owner guidance and materially tentative replies", () => {
    const liveOwner = source("live-owner", "Who owns escalations?", "DM Madeline because she is the current owner.");
    const tentative = source("materially-tentative", "Can this lead proceed?", "I guess this is probably allowed, but let me confirm.");
    const result = compileV4SystemicOperationalKnowledge({
      sources: [liveOwner, tentative],
      checkpoint: checkpoint([
        classified(liveOwner, [decision({
          decision_key: "current-escalation-owner",
          title: "Current escalation owner",
          question_families: ["Who is the current escalation owner?"],
          decision: "Madeline is the current escalation owner.",
        })]),
        classified(tentative, [decision({ decision_key: "tentative-proceeding" })]),
      ]),
      governedPolicies: [],
      routeCatalog,
    });

    expect(result.policies.find((policy) => policy.decision_key === "current-escalation-owner")).toMatchObject({
      answerability: "route_or_support",
      systemic: { temporalRisk: "time_sensitive" },
    });
    expect(result.policies.find((policy) => policy.decision_key === "tentative-proceeding")?.answerability).toBe("route_or_support");
  });

  it("restates an explicitly endorsed participant proposal as standalone evidence", () => {
    const item = source(
      "endorsed-workaround",
      "Can I take payment and onboard by phone if the client has no internet?",
      "Yes, try to keep everything on Zoom video if possible; the participant's suggestion is great.",
    );
    item.thread_messages = [
      { role: "participant", message_ts: item.root_ts, text: item.question },
      { role: "participant", message_ts: "1777500000.500000", text: "Use Zoom on the computer while calling the client on the phone so Zoom captures the recording." },
      { role: "authority", authority: "madeline", message_ts: "1777500001.000000", text: item.authority_replies[0].text },
    ];
    const result = compileV4SystemicOperationalKnowledge({
      sources: [item],
      checkpoint: checkpoint([classified(item, [decision({
        decision_key: "phone-onboarding-zoom-recording-workaround",
        title: "Phone onboarding Zoom recording workaround",
        question_families: ["How should a phone onboarding call be recorded when internet is unavailable?"],
        decision: "Try to keep everything on Zoom video if possible. A participant's suggestion to use Zoom on the computer while calling the client on the phone so Zoom captures the recording is great.",
        conditions: ["The client cannot join Zoom video because internet is unavailable"],
        actions: ["record phone onboarding"],
        entities: ["Zoom recording"],
        confidence: 0.95,
      })])]),
      governedPolicies: [],
      routeCatalog,
    });

    expect(result.policies[0]).toMatchObject({ answerability: "answer_evidence" });
    expect(result.policies[0]?.decision).toContain("One approved workaround is to use Zoom on the computer while calling the client on the phone");
    expect(result.policies[0]?.decision).not.toContain("participant");
  });

  it("keeps a stable discovery path answerable while routing the unavailable current artifact", () => {
    const item = source(
      "stable-navigation-live-artifact",
      "Where can I find the current upgrade form?",
      "Search upgrade in Slack; identify the exact form from the attached photo.",
    );
    const result = compileV4SystemicOperationalKnowledge({
      sources: [item],
      checkpoint: checkpoint([classified(item, [
        decision({
          decision_key: "upgrade-form-discovery-path",
          title: "Upgrade form discovery path",
          question_families: ["How do I find the upgrade form in Slack?"],
          decision: "Search the word 'upgrade' in Slack.",
          actions: ["search Slack"],
          entities: ["upgrade form"],
          temporal_risk: "stable",
          answerability: "answer",
        }),
        decision({
          decision_key: "current-upgrade-form-artifact",
          title: "Current upgrade form artifact",
          question_families: ["Which exact upgrade form is current?"],
          decision: "Identify the exact current form from the attached photo.",
          actions: ["identify artifact"],
          entities: ["upgrade form photo"],
          temporal_risk: "live_only",
          answerability: "artifact",
        }),
      ], "scoped_answer")]),
      governedPolicies: [],
      routeCatalog,
    });

    expect(result.policies.find((policy) => policy.decision_key === "upgrade-form-discovery-path")).toMatchObject({
      answerability: "answer_evidence",
      systemic: { temporalRisk: "stable" },
    });
    expect(result.policies.find((policy) => policy.decision_key === "current-upgrade-form-artifact")).toMatchObject({
      answerability: "route_or_support",
      systemic: { temporalRisk: "live_only" },
    });
  });

  it("never lets an operational overlay replace a divergent governed decision", () => {
    const item = source("governed-conflict", "Can every freelancer qualify automatically?", "Yes, every freelancer qualifies automatically.");
    const governed = {
      id: "governed-one",
      decision_key: "freelancer-qualification-rule",
      decision: "Freelancing alone does not establish qualification.",
    } as V3Policy;
    const result = compileV4SystemicOperationalKnowledge({
      sources: [item],
      checkpoint: checkpoint([classified(item, [decision({
        decision_key: "freelancer-qualification-rule",
        title: "Freelancer qualification rule",
        question_families: ["Can every freelancer qualify automatically?"],
        decision: "Every freelancer qualifies automatically.",
        domains: ["qualification"],
        actions: ["qualify"],
        entities: ["freelancers"],
        route_key: "greenlight",
      })])]),
      governedPolicies: [governed],
      routeCatalog,
    });

    expect(result.policies).toHaveLength(0);
    expect(result.metrics.governedConflictsOmitted).toBe(1);
  });
});
