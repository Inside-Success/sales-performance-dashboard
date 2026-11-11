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
const categoryLabels = require('./objection-coaching.cjs').OBJECTION_CATEGORIES;
const schema = {
  version: VERSION,
  presentation: "tyler-review-v1",
  summary: "Two-sentence coaching snapshot; empty for excluded calls",
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
      exchange: "Concise third-person account of concern, response and relevant later recovery; at most six sentences",
      concern: "Actual resistance (internal analytical detail)",
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
      layer: "foundations|interpretation|strategy",
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
  const issues = [];
  let location = 'report';
  const fail = message => issues.push({path: location, message});
  const finish = () => {
    if (issues.length) {
      const error = new Error(issues[0].message);
      error.issues = issues;
      throw error;
    }
    return r;
  };
  const text = value => typeof value === 'string' && value.trim().length > 0;
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const shape = (value, keys, label) => {
    if (!object(value) || Object.keys(value).some(key => !keys.includes(key))) fail(label + ' fields');
    return object(value);
  };
  if (!object(r)) { fail('version'); return finish(); }
  if (r.version !== VERSION) fail('version');
  shape(r, Object.keys(schema), 'report');
  if (!Array.isArray(blocks) || !blocks.length || blocks.some(b => !b || typeof b.id !== 'string') || new Set(blocks.map(b => b.id)).size !== blocks.length) {
    fail('evidence index'); return finish();
  }
  const ids = new Set(blocks.map(b => b.id));
  const refs = (value, required = true) => {
    if (!Array.isArray(value) || (required && !value.length) || value.some(id => !ids.has(id))) fail('evidence');
  };
  if (!text(r.show) || typeof r.exclusion_reason !== 'string') fail('identity');
  if (!['completed', 'excluded'].includes(r.status)) fail('status');
  if (!['main_istv', 'next_level_ceo', 'reality', 'mixed', 'unknown'].includes(r.offer_family)) fail('family');
  location = 'outcome';
  if (shape(r.outcome, Object.keys(schema.outcome), 'outcome')) {
    if (!['confirmed', 'not_confirmed', 'unclear'].includes(r.outcome.payment) || !text(r.outcome.text)) fail('outcome');
    refs(r.outcome.evidence_ids);
  }
  location = 'report';
  const compact = ['tyler-review-v1','tyler-review-v2'].includes(r.presentation);
  if (r.presentation !== undefined && !compact) fail('Unknown presentation revision');
  if (compact && (typeof r.summary !== 'string' || (r.status === 'completed' && !text(r.summary)))) fail('Missing coaching summary');
  if (!compact && r.summary !== undefined) fail('Summary requires presentation revision');
  const arrays = ['objections', 'lessons', 'next_steps'].every(key => Array.isArray(r[key]));
  if (!arrays) fail('arrays');
  if (r.status === 'excluded' && (!text(r.exclusion_reason) || !arrays || r.objections.length || r.lessons.length || r.next_steps.length || r.focus_id)) fail('exclusion');
  if (r.presentation === 'tyler-review-v2' && r.status === 'completed' && (typeof r.summary !== 'string' || r.summary.split('\n').filter(x=>x.trim()).length !== 2)) fail('Hook and subheadline require two nonempty lines');
  const seen = new Set();
  for (const group of ['objections', 'lessons']) {
    for (const [index, entry] of (Array.isArray(r[group]) ? r[group] : []).entries()) {
      location = group + '.' + index;
      if (!shape(entry, Object.keys(schema[group][0]), group === 'objections' ? 'objection' : 'lesson')) continue;
      if (!text(entry.id) || seen.has(entry.id)) fail('entry identity');
      seen.add(entry.id);
      if (!text(entry.title)) fail('title');
      for (const key of ['teaching', 'example']) if (typeof entry[key] !== 'string') fail(key);
      refs(entry.evidence_ids); refs(entry.counterevidence_ids, false);
      if (group === 'objections') {
        if (compact && !text(entry.exchange)) fail('Missing concise exchange');
        if (!compact && entry.exchange !== undefined) fail('Exchange requires presentation revision');
        if (compact && entry.handling === 'sound' && (text(entry.teaching) || text(entry.example))) fail('Sound handling must not carry extra feedback');
        if (entry.handling !== 'needs_work' && text(entry.example)) fail('Corrective example requires supported weak handling');
        if (entry.handling === 'needs_work' && !text(entry.teaching)) fail('Weak handling requires a usable explanation and better move: objection ' + entry.id + ' has empty teaching. Put the supported practical better move in teaching; assessment or example does not substitute for this required field.');
        if (!categories.includes(entry.category) || !['sound', 'needs_work', 'uncertain'].includes(entry.handling) || !['resolved', 'partly_resolved', 'unresolved', 'unclear'].includes(entry.resolution)) fail('objection enum');
        for (const key of ['concern', 'response', 'assessment']) if (!text(entry[key])) fail(key);
      } else {
        if (entry.layer !== undefined && !['foundations', 'interpretation', 'strategy'].includes(entry.layer)) fail('lesson layer');
        if (!['repeat', 'refine', 'explore'].includes(entry.purpose) || !text(entry.observation) || !text(entry.teaching)) fail('lesson');
      }
    }
  }
  location = 'focus_id';
  if (typeof r.focus_id !== 'string' || (r.focus_id && !seen.has(r.focus_id))) fail('focus');
  for (const [index, step] of (Array.isArray(r.next_steps) ? r.next_steps : []).entries()) {
    location = 'next_steps.' + index;
    if (!shape(step, Object.keys(schema.next_steps[0]), 'next step')) continue;
    if (!['agreed', 'promised', 'recommended'].includes(step.kind) || !text(step.text)) fail('next step');
    refs(step.evidence_ids);
  }
  return finish();
}

function render(r, blocks) {
  validate(r, blocks);
  if (r.status === "excluded")
    return "Not enough applicable selling evidence: " + r.exclusion_reason;
  const compact = ['tyler-review-v1','tyler-review-v2'].includes(r.presentation);
  const parts = compact ? ["# Call coaching", "## Coaching snapshot", r.summary] : ["# Call coaching", "**Outcome:** " + r.outcome.text];
  if (r.objections.length) {
    parts.push("## Objections and how you handled them");
    for (const [index,o] of orderedObjections(r, blocks).entries()) {
      if (compact) {
        const label = categoryLabels[o.category];
        parts.push('### ' + (r.presentation === 'tyler-review-v2' ? (index+1)+'. ' : '') + o.title + ' [' + label + ']', o.exchange);
        if (o.handling === 'sound') parts.push('Handled well—no further feedback.');
        else if (r.presentation === 'tyler-review-v2') {
          parts.push('**' + (o.handling === 'needs_work' ? 'Improvement' : 'Assessment') + ':** ' + o.assessment, o.teaching);
          if (o.example) parts.push('**For example:** ' + o.example);
        } else parts.push('**' + (o.handling === 'needs_work' ? 'Improvement' : 'Assessment') + ':** ' + [o.assessment, o.teaching, o.example ? 'For example: ' + o.example : ''].filter(Boolean).join(' '));
        continue;
      }
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
  if (r.next_steps.length && !compact)
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
    // Older isolated receipts retain their original layout. Never infer a layer from prose.
    const layered = r.lessons.every(l => l.layer);
    // Reasoning layers are analytical metadata, not the reader's navigation.
    // Only the isolated v2 presentation changes; historical layouts stay intact.
    const groups = r.presentation === 'tyler-review-v2' ? [
      ['improve', 'What to improve'], ['repeat', 'What worked'],
    ] : layered ? [
      ['interpretation', 'Reading the buyer'],
      ['strategy', 'Choosing your approach'],
      ['foundations', 'Principles to use again'],
    ] : [[null, 'What to carry into your next call']];
    for (const [layer, title] of groups) {
      const selected = r.lessons.filter(l => r.presentation === 'tyler-review-v2'
        ? (layer === 'repeat' ? l.purpose === 'repeat' : l.purpose !== 'repeat')
        : !layer || l.layer === layer);
      if (!selected.length) continue;
      parts.push('## ' + title);
      const ordered = [...selected.filter(l => l.purpose !== 'repeat'), ...selected.filter(l => l.purpose === 'repeat')];
      for (const l of ordered) {
        parts.push('### ' + l.title + (l.id === r.focus_id ? ' — main takeaway' : ''), l.observation, l.teaching);
        if (l.example) parts.push('**For example:** ' + l.example);
      }
    }
  }
  if (compact && r.next_steps.length) parts.push('## Next steps', ...r.next_steps.map(n=>'- '+(n.kind==='recommended'?'Suggested: ':n.kind==='promised'?'Promised: ':'Agreed: ')+n.text));
  if (compact) parts.push("## Call outcome", r.outcome.text);
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
  if (result.presentation !== draft.presentation) throw Error("Reviewer changed presentation revision");
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
   if(Object.hasOwn(value,'edits')){
    // This is a transport envelope, not a corrected report. The core applies
    // justified edits and verifies exact source quotations before acceptance.
    const text=x=>typeof x==='string'&&Boolean(x.trim());
    const quote=q=>q&&/^T\d{4,}$/.test(q.id)&&text(q.text);
    if(!Array.isArray(value.edits)||value.edits.length>40||value.corrected_report!=null||value.change_ledger!=null||!Array.isArray(value.observation_dispositions))throw Error('Invalid edit review envelope');
    if(value.pass?(value.findings.length||value.edits.length):(!value.findings.length||!value.edits.length))throw Error('Contradictory edit audit');
    const seen=new Set();
    for(const e of value.edits){
     if(!e||!text(e.target)||seen.has(e.target)||!text(e.reason)||!quote(e.source_quote)||!Object.hasOwn(e,'value'))throw Error('Invalid review edit');seen.add(e.target);
     if(!/^(summary|exclusion_reason|offer_family|show|outcome|focus_id|next_steps|(?:objections|lessons):[^:]+)$/.test(e.target))throw Error('Forbidden review edit target');
     if(Object.hasOwn(e,'after_id')&&e.after_id!==null&&!text(e.after_id))throw Error('Invalid review placement');
    }
    const ids=new Set();for(const d of value.observation_dispositions){if(!d||!text(d.id)||ids.has(d.id)||!['retained','refined','dismissed'].includes(d.decision)||!text(d.reason)||!quote(d.source_quote))throw Error('Invalid observation disposition');ids.add(d.id);}
    return [];
   }
   if(value.pass){if(value.findings.length||value.corrected_report!==null)throw Error('Contradictory audit');}
   else{if(!value.findings.length)throw Error('Missing correction rationale');structural(value.corrected_report);}
  }
  return [];
 }catch(e){return e.issues?.map(issue=>issue.path+": "+issue.message)||[e.message];}
}
module.exports.providerErrors=providerErrors;

function providerStage(stage){return ["foundations_writer_v3","foundations_writer_repair_v3","foundations_reviewer_v3"].includes(stage);}
module.exports.providerStage=providerStage;

// Earliest supporting source position, never the array order generated by the model.
function orderedObjections(report, blocks) {
 if (!['tyler-review-v1','tyler-review-v2'].includes(report.presentation)) return report.objections;
 const index = new Map(blocks.map((b,i)=>[b.id,i]));
 const first = o => Math.min(...o.evidence_ids.map(id=>index.get(id) ?? Infinity));
 return [...report.objections].sort((a,b)=>first(a)-first(b));
}
module.exports.orderedObjections=orderedObjections;
