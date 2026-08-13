const doc = $input.first()?.json || {};
const source = $('Capture Ledger Lease').item.json;
const parts = [];
for (const block of (doc.body?.content || [])) {
  if (!block.paragraph) continue;
  for (const element of (block.paragraph.elements || [])) {
    const value = element.textRun?.content;
    if (value) parts.push(value);
  }
}

const fullDocument = parts.join('').replace(/\n{3,}/g, '\n\n').trim();
const transcriptMarker = /(?:^|\n)\s*Full Transcript\s*(?:\n|$)/i;
const markerMatch = transcriptMarker.exec(fullDocument);
const transcript = (markerMatch ? fullDocument.slice(markerMatch.index + markerMatch[0].length) : fullDocument)
  .replace(/\n{3,}/g, '\n\n')
  .trim()
  .slice(0, 180000);

const quarantine = (reason, diagnostic) => [{ json: { ...source, ready: false, quarantineFields: {
  'Quarantine ID': 'quarantine-' + source.idempotencyKey,
  'Idempotency Key': source.idempotencyKey,
  'Source Record ID': source.sourceRecordId,
  'Automation Key': source.automationKey,
  'Call Type': source.callType,
  'Assigned Rep Email': source.repEmail,
  'Resolved Rep Label': source.resolvedRepName || '',
  'Reason': reason,
  'Diagnostic JSON': JSON.stringify({ meetingStartAt: source.meetingStartAt, sourceRecordId: source.sourceRecordId, ...(diagnostic || {}) }),
  'Scorer Version': source.scorerVersion,
  'Quarantined At': new Date().toISOString(),
  'Resolved': 'false',
} } }];

if (!transcript) return quarantine('empty_transcript', { docId: source.docId });
if (transcript.length < 900) return quarantine('v7_transcript_below_gradeable_threshold', { characters: transcript.length });

const normalizeIdentity = (value) => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/[^a-z0-9@.]+/g, ' ').replace(/\s+/g, ' ').trim();
const cleanName = (value) => normalizeIdentity(value).replace(/@.*$/, '').replace(/\b(casting manager|sales manager|sales rep|sales closer|closer|manager|host|speaker)\b/g, ' ').replace(/\s+/g, ' ').trim();
const isGeneric = (value) => /^(casting|sales|closer|booking|appointment|inside success|team|admin|host|speaker|unknown)( team| rep| closer| sales)?$/i.test(cleanName(value));
const rosterByEmail = new Map();
for (const raw of (Array.isArray(source.repRoster) ? source.repRoster : [])) {
  const email = String(raw?.email || '').trim().toLowerCase();
  const name = String(raw?.name || '').trim();
  if (email && name && !isGeneric(name) && !rosterByEmail.has(email)) rosterByEmail.set(email, { email, name });
}
if (source.repEmail && source.repName && !rosterByEmail.has(String(source.repEmail).toLowerCase())) {
  rosterByEmail.set(String(source.repEmail).toLowerCase(), { email: String(source.repEmail).toLowerCase(), name: String(source.repName) });
}
const roster = [...rosterByEmail.values()];
const aliasesByEmail = new Map();
const aliasOwners = new Map();
for (const rep of roster) {
  const tokens = cleanName(rep.name).split(' ').filter(Boolean);
  const emailLocal = rep.email.split('@')[0].replace(/[._-]+/g, ' ');
  const aliases = new Set([cleanName(rep.name), cleanName(rep.email), cleanName(emailLocal)]);
  if (tokens.length) aliases.add(tokens[0]);
  if (tokens.length > 1) aliases.add(tokens[tokens.length - 1]);
  aliasesByEmail.set(rep.email, aliases);
  for (const alias of aliases) {
    if (!alias || alias.length < 3) continue;
    const owners = aliasOwners.get(alias) || new Map();
    owners.set(rep.email, rep);
    aliasOwners.set(alias, owners);
  }
}
const uniqueAliases = new Map([...aliasOwners.entries()].filter(([, owners]) => owners.size === 1).map(([alias, owners]) => [alias, [...owners.values()][0]]));
const rawSpeakerStats = new Map();
const allSpeakerLabels = new Set();
for (const line of transcript.split(/\r?\n/)) {
  const match = line.match(/^\s*\[([^\]]+)]\s*([^:\n]{1,100}):\s*(.*)$/);
  if (!match) continue;
  const label = match[2].trim();
  const key = cleanName(label);
  allSpeakerLabels.add(label);
  const entry = rawSpeakerStats.get(key) || { key, labels: new Set(), turns: 0, words: 0 };
  entry.labels.add(label);
  entry.turns += 1;
  entry.words += match[3].trim() ? match[3].trim().split(/\s+/).length : 0;
  rawSpeakerStats.set(key, entry);
}
const matchSpeakerToRep = (speakerKey) => {
  if (!speakerKey) return null;
  if (uniqueAliases.has(speakerKey)) return { rep: uniqueAliases.get(speakerKey), method: 'unique_exact_alias' };
  const possible = new Map();
  for (const [alias, rep] of uniqueAliases) {
    if (alias.length >= 4 && speakerKey.length >= 4 && (alias.startsWith(speakerKey) || speakerKey.startsWith(alias))) possible.set(rep.email, rep);
  }
  return possible.size === 1 ? { rep: [...possible.values()][0], method: 'unique_prefix_alias' } : null;
};
const matchedByEmail = new Map();
for (const stats of rawSpeakerStats.values()) {
  const match = matchSpeakerToRep(stats.key);
  if (!match) continue;
  const entry = matchedByEmail.get(match.rep.email) || { rep: match.rep, labels: new Set(), turns: 0, words: 0, methods: new Set() };
  for (const label of stats.labels) entry.labels.add(label);
  entry.turns += stats.turns;
  entry.words += stats.words;
  entry.methods.add(match.method);
  matchedByEmail.set(match.rep.email, entry);
}
const ranked = [...matchedByEmail.values()].sort((a, b) => b.words - a.words || b.turns - a.turns || a.rep.email.localeCompare(b.rep.email));
const assignedEmail = String(source.repEmail || '').toLowerCase();
const assigned = matchedByEmail.get(assignedEmail) || null;
const totalMatchedWords = ranked.reduce((sum, row) => sum + row.words, 0);
const primary = assigned && assigned.turns >= 2 && assigned.words >= 12 ? assigned : ranked[0];
const second = ranked.find((row) => row.rep.email !== primary?.rep?.email);
const primaryShare = totalMatchedWords && primary ? primary.words / totalMatchedWords : 0;
const secondShare = totalMatchedWords && second ? second.words / totalMatchedWords : 0;
const unmatched = [...rawSpeakerStats.values()].filter((row) => !matchSpeakerToRep(row.key)).sort((a, b) => b.words - a.words);
const resolutionDiagnostic = {
  matchedRepCount: ranked.length,
  matchedTurns: ranked.reduce((sum, row) => sum + row.turns, 0),
  matchedWords: totalMatchedWords,
  primaryShare: Math.round(primaryShare * 1000) / 1000,
  secondShare: Math.round(secondShare * 1000) / 1000,
  assignedMatched: Boolean(assigned),
  speakers: ranked.map((row) => ({ email: row.rep.email, name: row.rep.name, turns: row.turns, words: row.words, labels: [...row.labels], methods: [...row.methods] })),
  unmatched: unmatched.slice(0, 6).map((row) => ({ labels: [...row.labels], turns: row.turns, words: row.words })),
};
if (!primary || primary.turns < 2 || primary.words < 12) return quarantine('speaker_resolution_unmapped_or_insufficient', resolutionDiagnostic);
if (second && !(primaryShare >= 0.60 && secondShare <= 0.30)) return quarantine('speaker_resolution_ambiguous_multiple_reps', resolutionDiagnostic);
source.resolvedRepEmail = primary.rep.email;
source.resolvedRepName = primary.rep.name;
source.attributionSubstituted = primary.rep.email !== assignedEmail;
source.speakerResolutionMethod = source.attributionSubstituted ? 'transcript_unique_alias_substitute_v7' : 'transcript_assigned_alias_v7';
source.speakerResolutionConfidence = assigned === primary || primaryShare >= 0.72 ? 'high' : 'medium';
source.resolvedSpeakerLabels = [...primary.labels].sort();
source.allSpeakerLabels = [...allSpeakerLabels].sort();
source.speakerResolutionDiagnostic = resolutionDiagnostic;


const call1 = [
  {key:'consent_purpose_control',label:'Consent, purpose, and time control',weight:0.10,criteria:[
    ['recording_consent','Recording consent is obtained or already clearly established',0.30],
    ['call_purpose','The rep states the purpose of the Call 1 interview',0.25],
    ['time_permission','The rep checks time or permission to proceed',0.20],
    ['direction_control','The rep keeps the conversation purposeful without unfairly cutting off useful context',0.25],
  ]},
  {key:'story_expertise',label:'Story, expertise, and show-fit discovery',weight:0.20,criteria:[
    ['unique_story','Discovers the prospect’s distinctive story or journey',0.30],
    ['expertise','Discovers credible expertise or experience',0.25],
    ['goals','Discovers the message, audience, or business goal',0.20],
    ['why_now','Explores why this opportunity matters now',0.15],
    ['responsive_listening','Uses the prospect’s answers rather than mechanically reading the script',0.10],
  ]},
  {key:'commercial_need_consequence',label:'Commercial need, desired change, and consequence',weight:0.20,criteria:[
    ['challenges','Identifies meaningful commercial or growth challenges',0.25],
    ['diagnostic_depth','Asks useful follow-up questions instead of accepting surface answers',0.25],
    ['consequence','Clarifies the effect or consequence of the current problem',0.20],
    ['desired_change','Clarifies the desired future result',0.15],
    ['opportunity_link','Connects the show opportunity to the prospect’s stated needs without unsupported promises',0.15],
  ]},
  {key:'fit_authority_readiness',label:'Fit, authority, readiness, and practical capacity',weight:0.15,criteria:[
    ['strategic_fit','Tests whether the prospect and story fit the show',0.25],
    ['decision_authority','Checks who is involved in the decision when relevant',0.20],
    ['readiness','Tests practical readiness and commitment',0.20],
    ['requirements_awareness','Explains relevant travel, licensing, promotion, agreement, or onboarding requirements',0.20],
    ['financial_fairness','Does not knowingly push a prospect into unsuitable financial stress',0.15],
  ]},
  {key:'progression_decision',label:'Correct progression decision',weight:0.20,criteria:[
    ['decision_matches_fit','The advance, decline, or follow-up decision matches the evidence of fit and readiness',0.45],
    ['decision_reason','The rep’s decision has a clear evidence-based rationale',0.25],
    ['ethical_decision','The decision avoids unsafe pressure and respects genuine lack of fit',0.20],
    ['decision_clarity','The prospect can understand the disposition',0.10],
  ]},
  {key:'next_steps_stakeholders_prework',label:'Next step, stakeholders, calendar acceptance, and pre-work',weight:0.15,criteria:[
    ['appropriate_next_step','Sets the next action appropriate to the actual disposition, including respectful closure for a fair decline',0.30],
    ['stakeholders','Identifies or invites relevant stakeholders when the call is advancing',0.20],
    ['calendar_confirmation','Books and confirms the next meeting when the call is advancing',0.20],
    ['prework','Explains appropriate pre-work when the call is advancing',0.15],
    ['receipt_confirmation','Confirms the prospect received or accepted the needed material or invitation',0.15],
  ]},
];
const call2 = [
  {key:'consent_reconnection_agenda',label:'Consent, reconnection, agenda, and prior context',weight:0.08,criteria:[
    ['recording_consent','Recording consent is obtained or already clearly established',0.25],
    ['reconnection','Reconnects to the prior conversation or Green Light decision',0.25],
    ['agenda','Sets a clear Call 2 purpose or agenda',0.25],
    ['prior_context','Uses relevant prior context accurately',0.25],
  ]},
  {key:'personalized_story_value',label:'Personalized story, mission, authority, and business value',weight:0.18,criteria:[
    ['story_relevance','Uses the prospect’s specific story or mission',0.25],
    ['authority_value','Explains the authority or credibility value',0.20],
    ['business_impact','Connects the opportunity to a realistic business objective',0.25],
    ['tailored_value','Tailors the explanation rather than relying only on generic claims',0.20],
    ['proportionate_length','Keeps the explanation proportionate while allowing needed clarification for a difficult prospect',0.10],
  ]},
  {key:'commitment_stakeholders',label:'Soft commitment and stakeholder alignment',weight:0.12,criteria:[
    ['soft_commitment','Checks whether the prospect wants to move forward before transactional steps',0.35],
    ['stakeholder_alignment','Identifies or includes relevant decision stakeholders',0.30],
    ['decision_alignment','Confirms the prospect understands what is being decided',0.20],
    ['concern_check','Invites unresolved concerns before closing',0.15],
  ]},
  {key:'license_price_terms',label:'License, price, terms, and understanding',weight:0.18,criteria:[
    ['best_option','Presents the most suitable offer rather than confusing the prospect with every option',0.20],
    ['accurate_price','States the relevant price accurately',0.20],
    ['terms','Explains material terms, including recurring charges when applicable',0.20],
    ['understanding','Checks the prospect’s understanding',0.20],
    ['value_price_link','Connects price to the prospect’s stated value without unsupported guarantees',0.20],
  ]},
  {key:'objection_diagnosis',label:'Objection diagnosis and proportionate response',weight:0.16,criteria:[
    ['objection_identified','Identifies the prospect’s actual objection',0.25],
    ['diagnostic_questions','Uses useful diagnostic questions before prescribing an answer',0.25],
    ['specific_response','Responds to the actual objection rather than evading it',0.20],
    ['proportionate_persistence','Persistence and repetition remain proportionate to the prospect’s difficulty and signals',0.15],
    ['ethical_response','Avoids arbitrary urgency, unsupported claims, dismissiveness, or ignoring a clear refusal',0.15],
  ]},
  {key:'outcome_execution',label:'Best reasonable outcome execution',weight:0.18,criteria:[
    ['best_reasonable_outcome','Moves toward the best reasonable outcome for this prospect, not a sale at any cost',0.35],
    ['specific_next_step','Secures a specific next step when an immediate transaction is not achieved',0.25],
    ['mutual_confirmation','Confirms both sides understand and agree to the outcome',0.20],
    ['follow_through','Completes the immediate follow-through available in the call',0.20],
  ]},
  {key:'contract_payment_onboarding',label:'Contract, payment, and onboarding completion',weight:0.10,criteria:[
    ['payment','Completes or clearly confirms the agreed payment or deposit step',0.30],
    ['contract','Completes or clearly confirms the agreement or contract step',0.25],
    ['onboarding','Books or clearly confirms onboarding after agreement',0.25],
    ['confirmations','Confirms required invitations, forms, emails, or next instructions',0.20],
  ]},
];
const dimensions = source.callType === 'Call 1' ? call1 : call2;
const system = [
  'You are the evidence-bound primary assessor for Magic Mike V7.1 shadow calibration.',
  'Assess facts and observable criteria first. Never choose an overall or dimension score. Deterministic code calculates every score after validating your evidence.',
  'Judge the resolved sales rep fairly against the real purpose of this specific call and the Inside Success TV Call 1 or Call 2 script.',
  'The scripts are the operating source of truth, but real calls need not follow them word for word. Functional equivalents count.',
  'Return one JSON object only. Do not add prose outside JSON.',
  '',
  'TRANSCRIPT RELIABILITY:',
  '- gradeable is the normal result when the rep and prospect exchange can be followed, even with minor gaps, spelling errors, duplicated lines, imperfect timestamps, or isolated technical disruption.',
  '- partially_gradeable is only for a materially missing or corrupted section when enough reliable evidence remains to assess several dimensions.',
  '- not_gradeable is only when rep identity or the exchange is genuinely unusable. Never turn a technical fault into a rep penalty.',
  '',
  'FAIRNESS:',
  '- Score only controllable rep behavior. Prospect difficulty, lead quality, technical disruption, prerecorded material, and teammate speech are context, not rep penalties.',
  '- Difficult prospects may reasonably require a longer call, repeated explanation, or additional questions. Judge whether the response was useful, ethical, responsive, and proportionate.',
  '- A successful Call 1 is the correct progression decision. Advancing a suitable prospect and intentionally rejecting an unsuitable prospect can both be excellent.',
  '- Score what the rep actually demonstrated, not what the outcome implies. A sale, advancement, or polite ending never proves that discovery, objection handling, value positioning, or next-step execution was strong.',
  '- A missed criterion requires a fair, observable opportunity. An explicit refusal does not by itself erase the opportunity to diagnose the reason, test fit, answer a supported objection, or close respectfully.',
  '- Use not_applicable only when the call path genuinely never reached the criterion after a reasonable diagnostic effort. Use not_observable only for a real transcript limitation; absence of a behavior in an otherwise complete transcript is not a transcript limitation.',
  '- Opportunity classification is context only and never adds or subtracts points. A limited prospect protects the rep from prospect-controlled outcomes, but it does not excuse weak controllable execution before or after the limitation became clear.',
  '- not_currently_closable requires an evidenced blocker outside the rep’s control plus evidence that the rep reasonably diagnosed it. “I do not want to move forward” alone is not enough.',
  '- Do not award exceptional merely because the call reached a sale, advanced, or ended cleanly. Exceptional describes rare, unusually complete rep execution with no material gap.',
  '',
  'CALL 2 OUTCOME ANCHORS:',
  '- sale requires verified agreement plus verified payment completion or a clearly completed transaction.',
  '- deposit requires a verified deposit commitment or completion.',
  '- concrete_follow_up requires either an agreed date/time OR a specific agreed action with an identified owner and deadline. A vague promise to reconnect is not concrete.',
  '- intentional_rejection requires an explicit, fit-based decision not to proceed. Otherwise use lost or unknown as supported.',
  '- Contract/payment/onboarding criteria are applicable only after the prospect reaches an agreement, deposit, or immediate transaction path. Do not penalize them merely because a prospect is not ready or not closable.',
  '',
  'PRESSURE AND CRITICAL-RISK ANCHORS:',
  '- A truthful, relevant deadline or respectful urgency is not harmful by itself.',
  '- Arbitrary scarcity, unsupported claims, dismissing a reasonable request for time, or continuing after a clear refusal are negative only when exact evidence supports them.',
  '- A critical finding requires: a defined risk category, exact rep evidence, and exact evidence of demonstrated material impact or prospect reaction. Potential concern without demonstrated impact belongs in improvements, not critical findings.',
  '',
  'CRITERION STATUS:',
  '- exceptional: rare, unusually complete, context-specific execution with no material gap. Do not use for ordinary script compliance.',
  '- strong: complete, effective execution with specific tailoring and no important controllable omission.',
  '- competent: acceptable execution that achieves the basic purpose but remains ordinary, shallow, generic, or has a noticeable non-material gap.',
  '- partial: some useful behavior occurs, but an important controllable part is incomplete or superficial.',
  '- weak: the rep attempts the behavior but the attempt is ineffective, poorly diagnosed, generic, or substantially incomplete.',
  '- missed: a fair opportunity is visible and the rep does not perform the behavior.',
  '- harmful: the rep’s controllable behavior materially undermines the criterion; use sparingly and only with direct evidence.',
  '- not_applicable: the criterion is not reasonably relevant to this call path.',
  '- not_observable: the transcript cannot support a fair judgment.',
  '- Every exceptional, strong, competent, partial, weak, missed, or harmful criterion needs at least one exact contiguous transcript quote with timestamp and speaker. For missed, cite the exchange or transition that proves the opportunity and omission.',
  '- Judge every required criterion independently. Do not copy one positive exchange across several criteria unless it directly proves each distinct function.',
  '- When evidence supports two adjacent statuses, choose the lower status unless the higher anchor is clearly demonstrated.',
  '- Include counterevidence when present. Do not hide evidence that weakens the classification.',
  '- Ordinary script compliance is competent, not strong. Strong requires complete, specific or tailored execution with no material controllable gap. Exceptional is rare and requires unusually complete execution across more than one exact evidence moment.',
  '- For every scored criterion, separately classify coverage, specificity, and material_gap. These factual fields are used by deterministic code and must agree with the written reason and evidence.',
  '- coverage complete means the full practical purpose was achieved; mostly_complete means the core purpose was achieved with a noticeable but non-material omission; partial means an important part was incomplete; missed means a fair opportunity was not used.',
  '- specificity tailored means the rep clearly adapted to this prospect; specific means concrete and responsive; generic means routine or script-like; absent means no meaningful execution.',
  '- material_gap none means no controllable deficiency is supported; minor means a noticeable coaching improvement that did not undermine the purpose; major means an important controllable deficiency; harmful means materially counterproductive conduct.',
  '',
  'FINDINGS:',
  '- Strengths, improvements, and critical findings may be empty. Never manufacture a fixed number.',
  '- Findings must summarize supported criteria; they cannot create a new penalty.',
].join('\n');
const schema = {
  transcript_reliability:{grade:'gradeable|partially_gradeable|not_gradeable',reason:'brief factual reason',issues:['supported issue'],technical_disruption:false,appears_complete:true},
  opportunity:{classification:'viable|limited|not_currently_closable|unknown',reason:'evidence-based explanation',correct_disposition:'advance|decline|follow_up|close|unknown',evidence:[{timestamp:'exact',speaker:'exact',quote:'exact'}]},
  outcome:{classification:'sale|deposit|concrete_follow_up|intentional_rejection|lost|unknown',reason:'factual outcome',evidence:[{timestamp:'exact',speaker:'exact',quote:'exact'}]},
  decision_facts:{
    follow_up:{agreed_time:false,time_text:'',specific_action:false,action:'',owner:'',deadline:'',evidence:[{timestamp:'exact',speaker:'exact',quote:'exact'}]},
    transaction:{payment_completed:false,deposit_confirmed:false,agreement_confirmed:false,onboarding_confirmed:false,evidence:[{timestamp:'exact',speaker:'exact',quote:'exact'}]},
    pressure:{truthful_deadline:false,arbitrary_urgency:false,ignored_clear_refusal:false,unsupported_claim:false,dismissed_time_request:false,material_negative_reaction:false,evidence:[{timestamp:'exact',speaker:'exact',quote:'exact'}]},
  },
  external_factors:['supported factor outside rep control'],
  dimensions:[{key:'required key',label:'required label',applicability:'applicable|not_applicable|not_observable',reason:'brief dimension summary',criteria:[{id:'required criterion id',status:'exceptional|strong|competent|partial|weak|missed|harmful|not_applicable|not_observable',coverage:'complete|mostly_complete|partial|missed|not_applicable|not_observable',specificity:'tailored|specific|generic|absent|not_applicable|not_observable',material_gap:'none|minor|major|harmful|not_applicable|not_observable',confidence:'high|medium|low',reason:'brief factual reason',evidence:[{timestamp:'exact',speaker:'exact',quote:'exact'}],counterevidence:[{timestamp:'exact',speaker:'exact',quote:'exact'}]}]}],
  findings:{main_finding:'single most useful fair summary',strengths:[{label:'supported strength',reason:'why',evidence:[{timestamp:'exact',speaker:'exact',quote:'exact'}]}],improvements:[{label:'supported improvement',reason:'why',evidence:[{timestamp:'exact',speaker:'exact',quote:'exact'}]}],critical_findings:[{label:'material verified concern',risk_type:'deception|coercion|clear_refusal_ignored|material_terms_misrepresented|other',material_impact:'demonstrated',reason:'why critical',rep_evidence:[{timestamp:'exact',speaker:'exact',quote:'exact'}],prospect_reaction_evidence:[{timestamp:'exact',speaker:'exact',quote:'exact'}]}]},
  call_context:{summary:'brief factual summary'}
};
const user = [
  'CALL TYPE: ' + source.callType,
  'ASSIGNED REP: ' + source.repName + ' <' + source.repEmail + '>',
  'RESOLVED REP TO REVIEW: ' + source.resolvedRepName + ' <' + source.resolvedRepEmail + '>',
  'RESOLVED REP SPEAKER LABELS: ' + source.resolvedSpeakerLabels.join(' | '),
  'ALL TRANSCRIPT SPEAKER LABELS: ' + source.allSpeakerLabels.join(' | '),
  'MEETING DATE: ' + source.meetingStartAt,
  'SHOW: ' + source.showName,
  '',
  'REQUIRED DIMENSIONS AND CRITERIA:',
  dimensions.map(function(d){return '- '+d.key+': '+d.label+' (dimension weight '+d.weight+')\n'+d.criteria.map(function(c){return '  - '+c[0]+': '+c[1]+' (criterion weight '+c[2]+')';}).join('\n');}).join('\n'),
  '',
  'Return exactly this JSON shape:',
  JSON.stringify(schema),
  '',
  'TRANSCRIPT:',
  transcript
].join('\n');
const requestBody={model:'deepseek-v4-pro',messages:[{role:'system',content:system},{role:'user',content:user}],thinking:{type:'disabled'},temperature:0,response_format:{type:'json_object'},stream:false,max_tokens:16000};
return [{json:{...source,ready:true,transcript,dimensionDefinitions:dimensions.map(function(d){return {key:d.key,label:d.label,weight:d.weight,criteria:d.criteria.map(function(c){return {id:c[0],label:c[1],weight:c[2]};})};}),requestBody}}];
