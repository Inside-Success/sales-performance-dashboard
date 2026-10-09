// Pure, dependency-free resolver. The release builder embeds these functions in
// existing n8n nodes; no additional model call, trigger, or persistent store.
export function identityText(value) {
  return String(value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
}
export function identityKey(value) {
  return identityText(value).toLowerCase().normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
export function identityBot(value) {
  return /\b(?:fireflies|otter|notetaker|note\s*taker|read\.ai|fathom|tl;?dv|tldv|avoma|grain\s+notetaker|gong\s+notetaker|zoom\s*ai|ai\s*companion|recording\s*bot)\b/i.test(identityText(value))
    || /^(?:audio shared by|screen share|shared screen|recording|system)\b/i.test(identityText(value));
}
export function identityDevice(value) {
  return /\b(?:iphone|ipad|android|macbook|galaxy|zoom user|unknown speaker)\b/i.test(identityText(value))
    || /^(?:iphone|ipad|android)/i.test(identityText(value))
    || /^(?:guest|participant|speaker|user|unknown|phone)(?:\s*\(?\d+\)?)?$/i.test(identityText(value));
}
export function identityPerson(value) {
  const name = identityText(value);
  return name.length >= 2 && name.length <= 100 && /\p{L}/u.test(name)
    && !identityBot(name) && !identityDevice(name) && !/@|https?:|\d/u.test(name)
    && !/\b(?:assistant|zoom meeting|personal meeting room|casting manager|sales rep|closer)\b/i.test(name)
    && !/\s+x\s+|\[|\]/i.test(name)
    && !/^(?:client|prospect|customer|host|sales call|casting call|call|show|tv show|inside success|inside success tv)$/i.test(name)
    && !/^(?:interested|excited|happy|good|fine|ready|sorry|thinking|calling|doing|glad|here|okay|ok|sure|not|just|really)(?:\s|$)/i.test(name);
}
export function identityFirst(value) {
  const key = identityKey(value).replace(/\b(?:mr|mrs|ms|dr)\b/g, '').trim();
  return key.split(' ')[0] || '';
}
export function identityFirstMatches(a, b) {
  const x = identityFirst(a), y = identityFirst(b);
  const families = [['jacob', 'jake'], ['joshua', 'josh'], ['william', 'will', 'bill'],
    ['robert', 'rob', 'bob'], ['james', 'jim', 'jimmy'], ['michael', 'mike'],
    ['daniel', 'dan', 'danny'], ['elizabeth', 'liz', 'beth'], ['thomas', 'tom'],
    ['joseph', 'joe'], ['christopher', 'chris'], ['jonathan', 'jon']];
  return Boolean(x && y && (x === y || families.some(group => group.includes(x) && group.includes(y))));
}
// Nicknames alone cannot establish identity: full names must also share a surname.
export function identitySameFullName(a, b) {
  const x = identityKey(a).split(' '), y = identityKey(b).split(' ');
  return identityPerson(a) && identityPerson(b) && x.length > 1 && y.length > 1
    && identityFirstMatches(a, b) && x.slice(1).join(' ') === y.slice(1).join(' ');
}
export function identityRep(value, source) {
  const key = identityKey(value).replace(/\s+success$/, '');
  const roleLabel = /\b(?:casting manager|sales rep|closer)\b/i.test(String(value || ''));
  const withoutRole = key.replace(/\b(?:casting manager|sales rep|closer)\b/g, '').trim();
  const names = [source.repName, ...(source.salesGroupMembers || []).map(member =>
    [member.first_name, member.last_name].filter(Boolean).join(' ') || member.display_name || member.name)];
  return Boolean(key && names.some(name => identityKey(name) === key
    || (roleLabel && withoutRole && identityFirst(name) === withoutRole)));
}
export function identityBody(value) {
  const text = String(value || '').replace(/\r/g, '');
  const marker = text.match(/(?:^|\n)\s*Full Transcript\s*\n/i);
  return marker ? text.slice(marker.index + marker[0].length) : text;
}
export function identityLines(source) {
  const text = identityBody(source.mergedTranscript || source.plainTranscript || '');
  return text.split('\n').map(line => {
    const m = line.match(/^\s*(?:\[([^\]]+)\]\s*)?([^:\n]{1,100}):\s*(.+)$/u);
    return m ? { timestamp: m[1] || '', speaker: identityText(m[2]), text: identityText(m[3]) } : null;
  }).filter(Boolean);
}
export function identityTitleCandidate(source) {
  const shows = source.knownShows || [];
  const text = String(source.meetingTitle || '')
    .replace(/\[inside success(?: tv)?\]/gi, '').trim();
  // A compound title is usable only when all other named parties are known reps.
  const compound = text.split(/\s+x\s+/i);
  if (compound.length > 1) {
    const external = compound.map(identityText).filter(part => !identityRep(part, source));
    if (external.length !== 1 || compound.filter(part => identityRep(part, source)).length !== compound.length - 1) return '';
    return identityPerson(external[0]) ? external[0] : '';
  }
  const parts = text.split(/\s+[-–—|]\s+|:\s*/u);
  return parts.map(identityText).find(part => identityPerson(part) && !identityRep(part, source)
    && !/\b(?:casting|follow.?up|call|meeting|episode|reality|tv|show|inside success)\b/i.test(part)
    && !shows.some(show => identityKey(show) === identityKey(part))) || '';
}
export function identityEvidence(line, name, source) {
  // Only introductions or a rep addressing the attendee establish identity.
  // Incidental mentions (celebrities, relatives, clients, prior calls) do not.
  const text = identityKey(line.text), first = identityFirst(name);
  if (!first || identityRep(name, source) || !identityPerson(name)) return false;
  const tokens = [first];
  if (identityFirstMatches(name, 'Jake')) tokens.push('jake', 'jacob');
  if (identityFirstMatches(name, 'Josh')) tokens.push('josh', 'joshua');
  const words = [...new Set(tokens)].join('|');
  const self = new RegExp('^(?:hi |hello |hey )?(?:my name is|this is|i am|im) (' + words + ')(?: |$)', 'u');
  const address = new RegExp('^(?:(?:hi|hey|hello)(?: there)?|good (?:morning|afternoon|evening)) (?:(?:dr|mr|mrs|ms) )?(' + words + ')(?: |$)', 'u');
  const nameFirst = new RegExp('^(' + words + ') (?:hi|hey|hello|good (?:morning|afternoon|evening)|can you|how are|are you|i |we |you |so )', 'u');
  const afterPrefix = new RegExp('^(?:okay|ok|alright|all right|so|well) (' + words + ')(?: |$)', 'u');
  return !identityRep(line.speaker, source) ? self.test(text) : address.test(text) || nameFirst.test(text) || afterPrefix.test(text);
}
export function resolveProspectIdentity(source = {}, ai = {}) {
  const lines = identityLines(source);
  const speakers = [...new Set(lines.map(line => line.speaker))];
  const external = speakers.filter(name => !identityRep(name, source) && !identityBot(name));
  const original = identityText(source.clientName);
  const title = identityTitleCandidate({ ...source, meetingTitle: source.titleClientName || '' }) || identityTitleCandidate(source);
  const aiName = identityText(ai.client_name || ai.clientName);
  const valid = name => identityPerson(name) && !identityRep(name, source)
    && !(source.knownShows || []).some(show => identityKey(show) === identityKey(name));
  const rawUsable = original && !identityBot(original) && !identityRep(original, source)
    && !/^(?:unknown|client|prospect|customer|host)$/i.test(original);
  const currentSpeaker = external.find(name => identityKey(name) === identityKey(original));
  let primary = currentSpeaker || (external.length === 1 ? external[0] : '');
  const evidence = ai.name_evidence && typeof ai.name_evidence === 'object' ? ai.name_evidence : {};
  const aiSpeaker = identityText(ai.client_speaker_label);
  const quote = identityText(evidence.quote);
  const verifiedAiLine = quote && lines.find(line => identityText(line.text).includes(quote)
    && (!evidence.speaker || identityText(evidence.speaker) === line.speaker)
    && (!evidence.timestamp || line.timestamp === String(evidence.timestamp).replace(/^\[|\]$/g, ''))
    && identityEvidence(line, aiName, source));
  const groundedName = name => identityKey(name).split(' ').length === 1
    || [title, original, ...external].some(value => identityKey(value) === identityKey(name))
    || lines.some(line => identityKey(line.text).includes(identityKey(name)));
  const verifiedAi = valid(aiName) && groundedName(aiName) && ai.name_confidence === 'high' && verifiedAiLine
    && external.includes(aiSpeaker)
    && (identityRep(verifiedAiLine.speaker, source) ? external.length === 1 : verifiedAiLine.speaker === aiSpeaker);
  if (verifiedAi) primary = aiSpeaker;

  const candidates = [title, ...(groundedName(aiName) ? [aiName] : []), original, ...external].filter(valid);
  let selected = '';
  let proof = null;
  if (verifiedAi) { selected = aiName; proof = verifiedAiLine; }
  if (!selected && primary) {
    for (const name of candidates) {
      if (/\s(?:and|&)\s/i.test(name)) continue; // Never collapse two attendees into one person.
      const line = lines.find(row => identityEvidence(row, name, source)
        && (identityRep(row.speaker, source) ? external.length === 1 : row.speaker === primary));
      if (line) { selected = name; proof = line; break; }
    }
  }
  // Upgrade a spoken first name to a title's full name only when the title
  // agrees; this never resolves contradictory surnames or multiple prospects.
  if (selected && valid(title) && !/\s(?:and|&)\s/i.test(title)
    && identityFirstMatches(selected, title) && identityKey(selected).split(' ').length === 1) selected = title;
  const contradicted = selected && valid(original) && !identityFirstMatches(selected, original);
  // A greeting alone cannot overwrite another name. A matching appointment
  // title plus a direct greeting and exactly one external speaker can: this
  // covers people joining through someone else's Zoom account.
  const titleCorroborates = selected && identityKey(selected) === identityKey(title) && external.length === 1;
  if (contradicted && (!proof || (identityRep(proof.speaker, source) && !titleCorroborates))) selected = '';
  const originalParts = identityKey(original).split(' '), selectedParts = identityKey(selected).split(' ');
  if (selected && valid(original) && originalParts.length > 1 && selectedParts.length > 1
    && originalParts.at(-1) !== selectedParts.at(-1)
    && (!proof || identityRep(proof.speaker, source) || !identityKey(proof.text).includes(identityKey(selected)))) selected = '';
  // An unspeaking account label must not hide a conflicting human surname.
  if (selected && !currentSpeaker && valid(primary) && identityKey(primary).split(' ').length > 1
    && selectedParts.length > 1 && identityKey(primary).split(' ').at(-1) !== selectedParts.at(-1)
    && (!proof || identityRep(proof.speaker, source))) selected = '';
  // The single external human speaker and appointment title independently
  // agree, while the selected Zoom account label never actually speaks.
  // This handles an assistant/account participant being picked by Zoom.
  if (!selected && external.length === 1 && valid(primary) && valid(title)
    && (identityKey(primary) === identityKey(title) || identitySameFullName(primary, title)) && !currentSpeaker) selected = primary;
  // Prefer the actual named speaker when the corroborated title uses a nickname.
  if (selected && external.length === 1 && identitySameFullName(selected, primary)) selected = primary;
  let name = selected || (rawUsable ? original : '') || (primary && !identityBot(primary) ? primary : '') || 'Prospect';
  let nameSource = selected ? 'AI: Transcript' : (name === original ? source.clientNameSource || 'Zoom Display Name' : 'Unknown');
  let confidence = selected ? 'high' : (valid(name) ? 'medium' : 'low');
  // Explicit manual verification is authoritative, including replay/recovery.
  const existing = source.existingFields || {};
  const existingMatched = (source.automationKey && identityText(existing['Automation Key']) === identityText(source.automationKey))
    || source.airtableSearchMatchedBy === 'guarded_meeting_identity';
  if (existingMatched && /^(?:manual|verified)(?:\b|:)/i.test(identityText(existing['Client Name Source'])) && valid(existing['Client Name'])) {
    name = identityText(existing['Client Name']); nameSource = existing['Client Name Source']; confidence = 'verified';
  } else if (/^(?:manual|verified)(?:\b|:)/i.test(identityText(source.clientNameSource)) && valid(original)) {
    name = original; nameSource = source.clientNameSource; confidence = 'verified';
  }
  const aliases = primary && (selected || name === original || confidence === 'verified') ? [primary] : [];
  if (external.includes(name) && !aliases.includes(name)) aliases.push(name);
  const supplied = source.clientIdentity;
  if (supplied && identityKey(supplied.name) === identityKey(name)) {
    for (const alias of Array.isArray(supplied.speakerAliases) ? supplied.speakerAliases : []) {
      if (external.includes(alias) && !aliases.includes(alias)) aliases.push(alias);
    }
  }
  // Keep independently supplied email unless resolving to a different Zoom
  // attendee; never bind the first external email to another speaker.
  let email = source.clientEmail || '';
  let emailSource = source.clientEmailSource || 'Unknown';
  if (primary && original && identityKey(primary) !== identityKey(original) && /zoom/i.test(emailSource)) {
    const participant = (source.prospectParticipants || []).find(p => identityKey(p.name) === identityKey(primary));
    email = participant?.email || ''; emailSource = email ? 'Zoom Participant' : 'Unknown';
  }
  let showName = source.showName || '';
  let showNameSource = source.showNameSource || 'Unknown';
  const sourceLooksLikePerson = [title, original, name].filter(Boolean).some(person => identityKey(person) === identityKey(showName));
  if (sourceLooksLikePerson && !/known/i.test(showNameSource)) { showName = ''; showNameSource = 'Unknown'; }
  const aiShow = identityText(ai.show_name || ai.showName);
  const showIsPerson = [title, original, name, aiName, ...external].filter(Boolean).some(person => identityKey(person) === identityKey(aiShow));
  const knownAiShow = (source.knownShows || []).some(show => identityKey(show) === identityKey(aiShow));
  const showExplicit = knownAiShow
    || (aiShow && lines.some(line => /\b(?:show|series|casting|episode)\b/i.test(line.text) && identityKey(line.text).includes(identityKey(aiShow))));
  if (aiShow && !showIsPerson && showExplicit) { showName = aiShow; showNameSource = ai.show_name_source === 'known_show_list' ? 'AI: Known Show List' : 'AI: Transcript'; }
  return { clientName: name, clientNameSource: nameSource, clientEmail: email, clientEmailSource: emailSource,
    showName, showNameSource, clientIdentity: { version: '2026-10-09', name, originalDisplayName: original,
      confidence, speakerAliases: aliases, evidence: proof ? { quote: proof.text, timestamp: proof.timestamp, speaker: proof.speaker } : null,
      resolution: selected ? 'conversation_supported' : confidence === 'verified' ? 'manual_verified' : name === 'Prospect' ? 'no_usable_label' : 'display_label_retained' } };
}
