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
if (transcript.length < 900) return quarantine('transcript_below_v5_calibration_threshold', { characters: transcript.length });

const normalizeIdentity = (value) => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/[^a-z0-9@.]+/g, ' ').replace(/\s+/g, ' ').trim();
const isGeneric = (value) => /^(casting|sales|closer|booking|appointment|inside success|team|admin|host|speaker|unknown)( team| rep| closer| sales)?$/i.test(normalizeIdentity(value).replace(/@.*$/, '').trim());
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
const aliasCandidates = new Map();
for (const rep of roster) {
  const emailLocal = rep.email.split('@')[0].replace(/[._-]+/g, ' ');
  for (const alias of new Set([normalizeIdentity(rep.name), normalizeIdentity(rep.email), normalizeIdentity(emailLocal), normalizeIdentity(rep.name).split(' ')[0]])) {
    if (!alias || alias.length < 3) continue;
    aliasCandidates.set(alias, [...(aliasCandidates.get(alias) || []), rep]);
  }
}
const aliases = new Map([...aliasCandidates.entries()].filter(([, reps]) => reps.length === 1).map(([alias, reps]) => [alias, reps[0]]));
const speakerStats = new Map();
const allSpeakerLabels = new Set();
for (const line of transcript.split(/\r?\n/)) {
  const match = line.match(/^\s*\[([^\]]+)]\s*([^:\n]{1,100}):\s*(.*)$/);
  if (!match) continue;
  const label = match[2].trim();
  allSpeakerLabels.add(label);
  const normalizedLabel = normalizeIdentity(label).replace(/\b(casting manager|sales manager|sales rep|sales closer|closer|manager|host)\b/g, ' ').replace(/\s+/g, ' ').trim();
  let rep = aliases.get(normalizedLabel);
  if (!rep && normalizedLabel.length >= 3 && !normalizedLabel.includes(' ')) {
    const prefixMatches = new Map();
    for (const [alias, identity] of aliases) if (!alias.includes(' ') && alias.length >= 4 && alias.startsWith(normalizedLabel)) prefixMatches.set(identity.email, identity);
    if (prefixMatches.size === 1) rep = [...prefixMatches.values()][0];
  }
  if (!rep) continue;
  const entry = speakerStats.get(rep.email) || { rep, labels: new Set(), turns: 0, words: 0 };
  entry.labels.add(label);
  entry.turns += 1;
  entry.words += match[3].trim() ? match[3].trim().split(/\s+/).length : 0;
  speakerStats.set(rep.email, entry);
}
const ranked = [...speakerStats.values()].sort((a, b) => b.words - a.words || b.turns - a.turns || a.rep.email.localeCompare(b.rep.email));
const totalWords = ranked.reduce((sum, row) => sum + row.words, 0);
const primary = ranked[0];
const second = ranked[1];
const primaryShare = totalWords && primary ? primary.words / totalWords : 0;
const secondShare = totalWords && second ? second.words / totalWords : 0;
const resolutionDiagnostic = { matchedRepCount: ranked.length, matchedTurns: ranked.reduce((sum, row) => sum + row.turns, 0), matchedWords: totalWords, primaryShare: Math.round(primaryShare * 1000) / 1000, secondShare: Math.round(secondShare * 1000) / 1000, speakers: ranked.map(row => ({ email: row.rep.email, name: row.rep.name, turns: row.turns, words: row.words, labels: [...row.labels] })) };
if (!primary || primary.turns < 2 || primary.words < 12) return quarantine('speaker_resolution_unmapped_or_insufficient', resolutionDiagnostic);
if (ranked.length > 1 && !(primaryShare >= 0.65 && secondShare <= 0.25)) return quarantine('speaker_resolution_ambiguous_multiple_reps', resolutionDiagnostic);

source.resolvedRepEmail = primary.rep.email;
source.resolvedRepName = primary.rep.name;
source.attributionSubstituted = primary.rep.email !== String(source.repEmail || '').toLowerCase();
source.speakerResolutionMethod = source.attributionSubstituted ? 'transcript_roster_substitute_v5' : 'transcript_roster_assigned_v5';
source.speakerResolutionConfidence = 'high';
source.resolvedSpeakerLabels = [...primary.labels].sort();
source.allSpeakerLabels = [...allSpeakerLabels].sort();
source.speakerResolutionDiagnostic = resolutionDiagnostic;

const call1 = [
  ['consent_purpose_control', 'Consent, purpose, and time control', 0.15],
  ['story_expertise', 'Story and expertise discovery', 0.20],
  ['commercial_need', 'Commercial need and consequence discovery', 0.20],
  ['fit_authority_readiness', 'Fit, authority, readiness, and capacity', 0.20],
  ['progression_decision', 'Correct progression decision', 0.15],
  ['next_steps_prework', 'Concrete next step, stakeholders, and pre-work', 0.10],
];
const call2 = [
  ['reconnection_agenda', 'Reconnection, agenda, and prior context', 0.10],
  ['personalized_value', 'Personalized story and value', 0.20],
  ['commitment_stakeholders', 'Soft commitment and stakeholder alignment', 0.15],
  ['license_price_terms', 'License, price, terms, and understanding', 0.20],
  ['objection_diagnosis', 'Objection diagnosis and response', 0.15],
  ['ethical_close_followup', 'Ethical close or concrete follow-up', 0.15],
  ['contract_onboarding', 'Contract, payment, and onboarding', 0.05],
];
const checkpoints = source.callType === 'Call 1' ? call1 : call2;
const system = `You are the primary evidence reviewer for Magic Mike V5 human calibration. Judge the resolved rep fairly against the real purpose of this specific call and the supplied Inside Success TV script-aligned checkpoints. Analyze only the transcript. Return one JSON object only and never add prose outside JSON.

FAIRNESS CONTRACT:
1. First decide transcript reliability. A missing, truncated, corrupted, mislabeled, or technically disrupted transcript must not become a low rep score. Use gradeable, partially_gradeable, or not_gradeable and state the exact issue.
2. Separately decide prospect opportunity: viable, limited, not_currently_closable, or unknown. Lead quality and prospect behavior provide context and checkpoint applicability; they never mathematically raise or lower the rep execution score.
3. Score only the resolved rep's controllable, fairly observable behavior. Do not award the rep credit for prerecorded material, Rudy, another teammate, or the prospect. Do not punish the rep for topics the call never fairly reached.
4. A successful Call 1 means making the correct progression decision. Advancing a suitable prospect and intentionally rejecting an unsuitable prospect can both be excellent outcomes when supported by evidence.
5. A difficult prospect may reasonably require a longer call, repeated clarification, or repeated objection handling. Judge whether repetition was responsive, ethical, useful, and proportionate. Do not punish duration or repetition by itself. Do not reward pressure, evasion, unsupported claims, or ignoring a clear refusal.
6. The scripts are operating guides, not word-for-word compliance checklists. Judge functional completion in context.
7. Do not infer tone, body language, intent, outcomes, or missing facts. Distinguish not_applicable from not_observable. A skipped behavior after a fair opportunity is missed, not not_applicable.
8. Do not force strengths, weaknesses, or critical findings. Any of those arrays may be empty. A critical finding requires direct evidence and material harm, not merely a low-scoring checkpoint.

CHECKPOINT STATUS:
- completed: functionally complete and effective for this call.
- partial: useful behavior occurred but an important controllable part was incomplete.
- missed: the rep had a fair opportunity and materially failed to do it.
- not_applicable: the checkpoint genuinely did not apply.
- not_observable: transcript/call evidence cannot fairly establish it.

Every applicable checkpoint must contain at least one exact contiguous transcript quote with timestamp and speaker. Use evidence from any speaker when it proves context or opportunity, but explain which rep-controlled behavior is being judged. Quotes must be copied character-for-character; never paraphrase or insert ellipses. Keep explanations concise and factual.`;
const user = `CALL TYPE: ${source.callType}
ASSIGNED REP: ${source.repName} <${source.repEmail}>
RESOLVED REP TO REVIEW: ${source.resolvedRepName} <${source.resolvedRepEmail}>
RESOLVED REP SPEAKER LABELS: ${source.resolvedSpeakerLabels.join(' | ')}
ALL TRANSCRIPT SPEAKER LABELS: ${source.allSpeakerLabels.join(' | ')}
MEETING DATE: ${source.meetingStartAt}
SHOW: ${source.showName}

Required checkpoints:
${checkpoints.map(([key, label, weight]) => `- ${key}: ${label} (weight ${weight})`).join('\n')}

Return this schema:
{
  "transcript_reliability":{"grade":"gradeable|partially_gradeable|not_gradeable","reason":"brief factual reason","issues":["supported issue"],"technical_disruption":true|false,"appears_complete":true|false,"prerecorded_segments":[{"speaker":"label","reason":"why this appears prerecorded"}]},
  "opportunity":{"classification":"viable|limited|not_currently_closable|unknown","reason":"evidence-based explanation","correct_disposition":"advance|decline|follow_up|close|unknown","evidence":[{"timestamp":"exact","speaker":"exact","quote":"exact"}]},
  "external_factors":["supported factor outside rep control"],
  "checkpoints":[{"key":"required key","label":"required label","applicability":"applicable|not_applicable|not_observable","status":"completed|partial|missed|not_scored","reason":"brief factual reason","evidence":[{"timestamp":"exact","speaker":"exact","quote":"exact"}]}],
  "findings":{"main_finding":"single most useful fair summary","strengths":[{"label":"supported strength","reason":"why","evidence":[{"timestamp":"exact","speaker":"exact","quote":"exact"}]}],"improvements":[{"label":"supported improvement","reason":"why","evidence":[{"timestamp":"exact","speaker":"exact","quote":"exact"}]}],"critical_findings":[{"label":"material verified concern","reason":"why critical","evidence":[{"timestamp":"exact","speaker":"exact","quote":"exact"}]}]},
  "call_context":{"outcome":"stated outcome or unknown","summary":"brief factual summary"}
}

TRANSCRIPT:
${transcript}`;
const requestBody = { model: 'deepseek-v4-pro', messages: [{ role: 'system', content: system }, { role: 'user', content: user }], thinking: { type: 'disabled' }, temperature: 0, response_format: { type: 'json_object' }, stream: false, max_tokens: 12000 };
return [{ json: { ...source, ready: true, transcript, checkpointDefinitions: checkpoints.map(([key, label, weight]) => ({ key, label, weight })), requestBody } }];
