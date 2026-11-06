// Versioned pure coaching contract. No I/O; legacy readers remain separate.
const VERSION = "coaching-foundations-v3";
const categories = [
  "cost",
  "value",
  "confidence",
  "terms",
  "fit",
  "practical",
  "portrayal",
  "approval",
  "commitment",
  "unclassified",
];
const schema = {
  version: VERSION,
  status: "completed|excluded",
  exclusion_reason: "Only for insufficient or out-of-scope evidence",
  offer_family: "main_istv|next_level_ceo|reality|mixed|unknown",
  show: "Actual show or Unknown",
  outcome: {
    payment: "confirmed|not_confirmed|unclear",
    text: "Observed outcome only",
    evidence_ids: ["T0001"],
  },
  objections: [
    {
      id: "O1",
      category: categories.join("|"),
      title: "Specific concern",
      concern: "Actual resistance",
      response: "Actual response, including later recovery",
      handling: "sound|needs_work|uncertain",
      resolution: "resolved|partly_resolved|unresolved|unclear",
      assessment:
        "Why the actual handling fits or misses, based on what was knowable then and the reply",
      teaching:
        "A useful conditional principle and how to apply it here; not a repeat of assessment",
      example: "Optional clearly hypothetical language; empty if unnecessary",
      evidence_ids: ["T0001"],
      counterevidence_ids: [],
    },
  ],
  lessons: [
    {
      id: "L1",
      purpose: "repeat|refine|explore",
      title: "A distinct transferable lesson",
      observation: "Specific exchange",
      teaching:
        "Why it is worth repeating/changing, what conditions favor the move, and how to carry it out",
      example: "Optional illustrative language",
      evidence_ids: ["T0001"],
      counterevidence_ids: [],
    },
  ],
  focus_id: "O1 or L1 or empty when none",
  next_steps: [
    {
      kind: "agreed|promised|recommended",
      text: "Action; agreed means mutual, promised means one party committed, recommended means new coaching advice",
      evidence_ids: ["T0001"],
    },
  ],
};
function validate(r, blocks) {
  const fail = (m) => {
    throw Error(m);
  };
  const text = (s) => typeof s === "string" && s.trim();
  if (!r || r.version !== VERSION) fail("version");
  const shape = (value, keys, label) => {
    if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(k => !keys.includes(k))) fail(label + " fields");
  };
  if (!Array.isArray(blocks) || !blocks.length || new Set(blocks.map(b => b.id)).size !== blocks.length) fail("evidence index");
  shape(r, Object.keys(schema), "report");
  if (!text(r.show) || typeof r.exclusion_reason !== "string") fail("identity");
  shape(r.outcome, Object.keys(schema.outcome), "outcome");

  if (!["completed", "excluded"].includes(r.status)) fail("status");
  const ids = new Set(blocks.map((b) => b.id));
  const refs = (a, required = true) => {
    if (
      !Array.isArray(a) ||
      (required && !a.length) ||
      a.some((i) => !ids.has(i))
    )
      fail("evidence");
  };
  if (
    !["main_istv", "next_level_ceo", "reality", "mixed", "unknown"].includes(
      r.offer_family,
    )
  )
    fail("family");
  if (
    !r.outcome ||
    !["confirmed", "not_confirmed", "unclear"].includes(r.outcome.payment) ||
    !text(r.outcome.text)
  )
    fail("outcome");
  refs(r.outcome.evidence_ids);
  if (
    !["objections", "lessons", "next_steps"].every((k) => Array.isArray(r[k]))
  )
    fail("arrays");
  if (
    r.status === "excluded" &&
    (!text(r.exclusion_reason) ||
      r.objections.length ||
      r.lessons.length ||
      r.next_steps.length ||
      r.focus_id)
  )
    fail("exclusion");
  const seen = new Set();
  for (const o of [...r.objections, ...r.lessons]) {
    if (!text(o.id) || seen.has(o.id)) fail("entry identity");
    seen.add(o.id);
    if (!text(o.title)) fail("title");
    for (const k of ["teaching", "example"])
      if (typeof o[k] !== "string") fail(k);
    refs(o.evidence_ids);
    refs(o.counterevidence_ids, false);
  }
  for (const o of r.objections) {
    shape(o, Object.keys(schema.objections[0]), "objection");
    if (o.handling !== "needs_work" && o.example.trim())
      fail("Corrective example requires supported weak handling");
    if (o.handling === "needs_work" && !text(o.teaching))
      fail("Weak handling requires a usable explanation and better move");
    if (
      !categories.includes(o.category) ||
      !["sound", "needs_work", "uncertain"].includes(o.handling) ||
      !["resolved", "partly_resolved", "unresolved", "unclear"].includes(
        o.resolution,
      )
    )
      fail("objection enum");
    for (const k of ["concern", "response", "assessment"])
      if (!text(o[k])) fail(k);
  }
  for (const l of r.lessons) {
    shape(l, Object.keys(schema.lessons[0]), "lesson");
    if (
      !["repeat", "refine", "explore"].includes(l.purpose) ||
      !text(l.observation) ||
      !text(l.teaching)
    )
      fail("lesson");
  }
  if (typeof r.focus_id !== "string" || (r.focus_id && !seen.has(r.focus_id)))
    fail("focus");
  for (const n of r.next_steps) {
    shape(n, Object.keys(schema.next_steps[0]), "next step");
    if (!["agreed", "promised", "recommended"].includes(n.kind) || !text(n.text))
      fail("next step");
    refs(n.evidence_ids);
  }
  return r;
}
function render(r, blocks) {
  validate(r, blocks);
  if (r.status === "excluded")
    return "Not enough applicable selling evidence: " + r.exclusion_reason;
  const parts = ["# Call coaching", "**Outcome:** " + r.outcome.text];
  if (r.objections.length) {
    parts.push("## Objections and how you handled them");
    for (const o of r.objections) {
      parts.push(
        "### " + o.title + (o.id === r.focus_id ? " — main takeaway" : ""),
        "**Concern:** " + o.concern,
        "**Your response:** " + o.response,
        o.assessment,
      );
      if (o.teaching) parts.push(o.teaching);
      if (o.example) parts.push("**For example:** " + o.example);
    }
  }
  if (r.next_steps.length)
    parts.push(
      "## Next steps",
      ...r.next_steps.map(
        (n) =>
          "- " +
          (n.kind === "recommended" ? "Suggested: " : n.kind === "promised" ? "Promised: " : "Agreed: ") +
          n.text,
      ),
    );
  if (r.lessons.length) {
    parts.push("## What to carry into your next call");
    const orderedLessons = [
      ...r.lessons.filter((l) => l.purpose !== "repeat"),
      ...r.lessons.filter((l) => l.purpose === "repeat"),
    ];
    for (const l of orderedLessons) {
      parts.push(
        "### " + l.title + (l.id === r.focus_id ? " — main takeaway" : ""),
        l.observation,
        l.teaching,
      );
      if (l.example) parts.push("**For example:** " + l.example);
    }
  }
  const byId = new Map(blocks.map((b) => [b.id, b]));
  const entries = new Map(
    [...r.objections, ...r.lessons].map((e) => [e.id, e.title]),
  );
  return parts
    .join("\n\n")
    .replace(/\b[OL]\d+\b/g, (id) => {
      if (!entries.has(id)) throw Error("Unknown inline entry reference");
      return "“" + entries.get(id) + "”";
    })
    .replace(/\bT\d{4}\b/g, (id) => {
      const b = byId.get(id);
      if (!b) throw Error("Unknown inline reference");
      return b.timestamp
        ? "the exchange at " + b.timestamp
        : "the cited exchange";
    });
}
function acceptReview(draft, audit, blocks) {
  const known = new Set(blocks.map((b) => b.id));
  if (
    !audit ||
    typeof audit.pass !== "boolean" ||
    !Array.isArray(audit.findings)
  )
    throw Error("Invalid reviewer contract");
  if (
    audit.findings.some(
      (f) =>
        !f ||
        typeof f.issue !== "string" ||
        !f.issue.trim() ||
        !Array.isArray(f.evidence_ids) ||
        f.evidence_ids.some((id) => !known.has(id)),
    )
  )
    throw Error("Invalid review evidence");
  if (audit.pass && (audit.findings.length || audit.corrected_report !== null))
    throw Error("Conflicting review verdict");
  if (!audit.pass && (!audit.findings.length || !audit.corrected_report))
    throw Error("Correction needs findings");
  const result = validate(audit.pass ? draft : audit.corrected_report, blocks);
  if (result.status !== draft.status)
    throw Error("Eligibility disagreement requires adjudication");
  return result;
}
module.exports = { VERSION, schema, validate, render, acceptReview };

// Provider checkpoint validation is structural only. Real source references are
// checked again by acceptReview with the exact transcript before publication.
function providerErrors(stage,value){
 if(!providerStage(stage))return [];
 try{
  const structural=r=>{
   const refs=[...(r?.outcome?.evidence_ids||[]),...[...(r?.objections||[]),...(r?.lessons||[]),...(r?.next_steps||[])].flatMap(x=>[...(x.evidence_ids||[]),...(x.counterevidence_ids||[])])];
   if(!refs.length||refs.some(id=>typeof id!=='string'||!/^T\d{4,}$/.test(id)))throw Error('Invalid evidence identifiers');
   validate(r,[...new Set(refs)].map(id=>({id})));
  };
  if(stage!=='foundations_reviewer_v3')structural(value);
  else{
   if(typeof value?.pass!=='boolean'||!Array.isArray(value.findings))throw Error('Invalid audit');
   if(value.findings.some(f=>!f||typeof f.issue!=='string'||!f.issue.trim()||!Array.isArray(f.evidence_ids)||f.evidence_ids.some(id=>typeof id!=='string'||!/^T\d{4,}$/.test(id))))throw Error('Invalid audit findings');
   if(value.pass){if(value.findings.length||value.corrected_report!==null)throw Error('Contradictory audit');}
   else{if(!value.findings.length)throw Error('Missing correction rationale');structural(value.corrected_report);}
  }
  return [];
 }catch(e){return [e.message];}
}
module.exports.providerErrors=providerErrors;

function providerStage(stage){return ["foundations_writer_v3","foundations_writer_repair_v3","foundations_reviewer_v3"].includes(stage);}
module.exports.providerStage=providerStage;
