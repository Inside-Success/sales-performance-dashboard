"""Build scoped n8n parameter patches from a private, fresh baseline.

No network calls or credentials. Usage: python3 build-prospect-identity.py
BASELINE.json.gz PATCHES.json.gz. Baselines and patches remain private.
"""
import copy
import gzip
import json
import pathlib
import sys

HERE = pathlib.Path(__file__).parent
INTAKE = 'qMQYNQtQbRZWjtG2'
OFFICIAL = 'L8Nn7xncA9ZPDdWA'


def replace_once(value, find, replacement):
    if value.count(find) != 1:
        raise ValueError('Expected one exact patch anchor: ' + find[:100])
    return value.replace(find, replacement, 1)


def build(baseline):
    inline = (HERE / 'prospect-identity.mjs').read_text().replace('export function ', 'function ')
    patches = {INTAKE: {}, OFFICIAL: {}}
    def params(wid, name):
        return copy.deepcopy(baseline[wid]['nodes'][name]['parameters'])

    p = params(INTAKE, 'Fetch Zoom Context')
    code = p['jsCode']
    code = replace_once(code, '      if (isGenericPersonValue(name) && !email) return false;',
                        '      if (identityBot(name)) return false;\n      if (isGenericPersonValue(name) && !email && !identityDevice(name)) return false;')
    code = replace_once(code, '    const titleShow = chooseTitleShow(item.meetingTitle, repName, clientName);',
                        '    const titleShow = chooseTitleShow(item.meetingTitle, repName, titleClientName || clientName);')
    code = replace_once(code, 'participantSource, salesGroupMembers, repName, repEmail,',
                        "participantSource, salesGroupMembers, titleClientName, knownShows: KNOWN_SHOWS, prospectParticipants: participantCandidates.map(p => ({ name: clean(p.name || p.user_name), email: clean(p.user_email || p.email) })), repName, repEmail,")
    # Bot/device detection only: embed those three functions, not the resolver.
    helper = inline[inline.index('function identityText'):inline.index('function identityPerson')]
    p['jsCode'] = helper + '\n' + code
    patches[INTAKE]['Fetch Zoom Context'] = p

    p = params(INTAKE, 'Classify Sales Call')
    p['text'] = replace_once(p['text'], '- Speaker List:', '- External Participant Labels: {{ JSON.stringify(($json.prospectParticipants || []).map(p => p.name)) }}\n- Speaker List:')
    old = '- Client name: never return the rep name, a closer-group member name, an internal team member, a speaker label, or a generic word. If uncertain, return an empty string.'
    new = '''- Client name: identify the actual external prospect, never an internal employee, host, bot, device label or person merely mentioned in conversation. A real human speaker name may be used when it is supported by the conversation. If uncertain, return an empty string.
- For a supported identity, return name_confidence and client_speaker_label (the exact original transcript label), plus name_evidence with a verbatim quote, exact timestamp without brackets, and exact speaker label. Use an introduction by that prospect or the rep directly addressing them; do not use celebrity, family-member or other third-party mentions. Use high name_confidence only when the quote establishes identity. No surname may be invented; the meeting title may corroborate the full name. If ambiguous, use low confidence and empty evidence. Name confidence is independent of sales-call confidence.
- Preserve multiple-attendee uncertainty. Do not arbitrarily decide that a spouse, partner, assistant or first external participant is the principal prospect.
- A prospect name is never a show name. New reality shows remain supported when explicitly named in the conversation; do not force an unknown show into the existing list.'''
    p['options']['systemMessage'] = replace_once(p['options']['systemMessage'], old, new)
    p['options']['systemMessage'] = replace_once(p['options']['systemMessage'], '  "client_name_source":',
        '  "name_confidence": "high" | "medium" | "low",\n  "client_speaker_label": "exact original transcript speaker label or empty",\n  "name_evidence": {"quote": "verbatim utterance or empty", "timestamp": "exact timestamp or empty", "speaker": "exact speaker label or empty"},\n  "client_name_source":')
    patches[INTAKE]['Classify Sales Call'] = p

    p = params(INTAKE, 'Sales Call Structured Parser')
    example = json.loads(p['jsonSchemaExample'])
    schema = {'type': 'object', 'properties': {key: {'type': 'boolean' if isinstance(value, bool) else 'string'} for key, value in example.items()}, 'required': list(example)}
    schema['properties'].update({
        'name_confidence': {'type': 'string'}, 'client_speaker_label': {'type': 'string'},
        'name_evidence': {'type': 'object', 'properties': {key: {'type': 'string'} for key in ['quote', 'timestamp', 'speaker']}}
    })
    # Optional fields keep historical/cached responses valid; no extra fixer call.
    p.update({'schemaType': 'manual', 'inputSchema': json.dumps(schema)})
    patches[INTAKE]['Sales Call Structured Parser'] = p

    p = params(INTAKE, 'Apply AI Sales Call Classification')
    code = p['jsCode']
    start = code.index('  let clientName = safeClientName(')
    end = code.index('  const finalDecisionCategory', start)
    code = code[:start] + '''  const identity = resolveProspectIdentity(source, output);
  const { clientName, clientNameSource, showName, showNameSource } = identity;
  let clientEmail = safeClientEmail(identity.clientEmail, source);
  let clientEmailSource = clientEmail ? identity.clientEmailSource : 'Unknown';
  const aiClientEmail = safeClientEmail(output.client_email || output.clientEmail, source);
  const changedAttendee = identity.clientIdentity.speakerAliases.length && source.clientName &&
    !identity.clientIdentity.speakerAliases.some(alias => identityKey(alias) === identityKey(source.clientName));
  if (aiClientEmail && !clientEmail && !changedAttendee) { clientEmail = aiClientEmail; clientEmailSource = sourceLabel(output.client_email_source || output.clientEmailSource, 'AI: Transcript'); }
''' + code[end:]
    code = replace_once(code, '...source, isSalesCall,', '...source, clientIdentity: identity.clientIdentity, isSalesCall,')
    code = replace_once(code, "ignoredReason: isSalesCall ? '' : (reason || 'AI classified this as a non-sales call.') } });",
                        "ignoredReason: isSalesCall ? '' : (reason || 'AI classified this as a non-sales call.') }, pairedItem: { item: index } });")
    p['jsCode'] = inline + '\n' + code
    patches[INTAKE]['Apply AI Sales Call Classification'] = p

    p = params(INTAKE, 'Build Transcript Document')
    code = replace_once(p['jsCode'], '  const data = item.json || {};', '  const input = item.json || {};\n  const data = { ...input, ...resolveProspectIdentity(input) };')
    code = replace_once(code, "    'Client Name Source: ' + clean(data.clientNameSource || 'Unknown'),",
                        "    'Client Name Source: ' + clean(data.clientNameSource || 'Unknown'),\n    'Client Identity JSON: ' + JSON.stringify(data.clientIdentity),")
    # Do not re-resolve a previously accepted identity with a different priority.
    code = replace_once(code, 'const data = { ...input, ...resolveProspectIdentity(input) };',
                        "const resolved = resolveProspectIdentity(input);\n  const manual = /^(manual|verified)(\\b|:)/i.test(String(resolved.clientNameSource));\n  const data = input.clientIdentity && !manual ? input : { ...input, ...resolved };")
    p['jsCode'] = inline + '\n' + code
    patches[INTAKE]['Build Transcript Document'] = p

    p = params(INTAKE, 'Prepare Airtable Write')
    code = p['jsCode']
    code = replace_once(code, 'const name = clean(value); const key = nameKey(name); if (!name || !key)',
                        "const name = clean(value); if (name === 'Prospect' && data.clientIdentity?.resolution === 'no_usable_label') return name; const key = nameKey(name); if (!name || !key)")
    code = replace_once(code, "  if (!clientName && existingClientName) { clientName = existingClientName; clientNameSource = safeExistingFields['Client Name Source'] || 'Manual'; }",
                        "  if (existingClientName && (!clientName || /^(manual|verified)(\\b|:)/i.test(String(safeExistingFields['Client Name Source'] || '')))) { clientName = existingClientName; clientNameSource = safeExistingFields['Client Name Source'] || 'Manual'; }")
    p['jsCode'] = code
    patches[INTAKE]['Prepare Airtable Write'] = p

    p = params(OFFICIAL, 'Clean Response')
    original = p['jsCode']
    prefix = original[:original.index('function normalizeName')]
    code = '''
const original_client_name = headerValue('Client Name');
const repName = headerValue('Rep Name');
let suppliedIdentity = null;
try { suppliedIdentity = JSON.parse(headerValue('Client Identity JSON')); } catch {}
const resolved = resolveProspectIdentity({
  clientName: original_client_name, clientNameSource: headerValue('Client Name Source'),
  repName, meetingTitle: headerValue('Meeting Title'), mergedTranscript: cleaned_transcript,
  showName: headerValue('Show Name'), clientIdentity: suppliedIdentity
});
// A newly resolved canonical identity must survive downstream reads unchanged.
const suppliedMatches = suppliedIdentity && identityKey(suppliedIdentity.name) === identityKey(original_client_name);
const effectiveName = suppliedMatches ? original_client_name : resolved.clientName;
const lines = identityLines({ mergedTranscript: cleaned_transcript });
const present = [...new Set(lines.map(line => line.speaker))].filter(name => !identityRep(name, {repName}) && !identityBot(name));
const aliases = suppliedMatches ? (Array.isArray(suppliedIdentity.speakerAliases) ? suppliedIdentity.speakerAliases : []).filter(name => present.includes(name)) : resolved.clientIdentity.speakerAliases;
return [{ json: { cleaned_transcript, too_short, original_client_name: suppliedMatches ? (suppliedIdentity.originalDisplayName || original_client_name) : original_client_name,
  normalized_client_name: effectiveName !== original_client_name ? effectiveName : '',
  client_name_normalization_reason: suppliedMatches ? 'source=validated_intake_identity' : resolved.clientIdentity.resolution,
  client_speaker_aliases: aliases, resolved_show_name: resolved.showName,
  person_misfiled_as_show: !resolved.showName && Boolean(headerValue('Show Name'))
} }];
'''
    p['jsCode'] = inline + '\n' + prefix + code
    patches[OFFICIAL]['Clean Response'] = p

    p = params(OFFICIAL, 'Edit Fields')
    fields = p['assignments']['assignments']
    fields.append({'id': 'mm-client-speaker-aliases-20261009', 'name': 'Client Speaker Aliases', 'value': '={{ JSON.stringify($json.client_speaker_aliases || []) }}', 'type': 'string'})
    for f in fields:
        if f['name'] == 'Client Name':
            f['value'] = "={{ /^(manual|verified)(\\b|:)/i.test(String($('Loop Over Items').item.json['Client Name Source'] || '')) ? $('Loop Over Items').item.json['Client Name'] : ($json.normalized_client_name || $('Loop Over Items').item.json['Client Name']) }}"
        if f['name'] == 'Show Name':
            f['value'] = "={{ $json.person_misfiled_as_show ? '' : ($json.resolved_show_name || $('Loop Over Items').item.json['Show Name']) }}"
    patches[OFFICIAL]['Edit Fields'] = p

    p = params(OFFICIAL, 'MM Parse Classifier')
    old = '  const clientPresent = speakers.some((speaker) => speakerMatchesExpected(speaker, m.client_name));'
    new = '''  let rawAliases = [];
  try { rawAliases = JSON.parse(String(caseItem?.source?.["Client Speaker Aliases"] || "[]")); } catch {}
  const aliases = Array.isArray(rawAliases) ? rawAliases.slice(0, 8).filter(alias => typeof alias === 'string' && speakers.includes(alias) && isHumanSpeakerLabel(alias) && !speakerMatchesExpected(alias, m.rep_name)) : [];
  const clientPresent = speakers.some((speaker) => speakerMatchesExpected(speaker, m.client_name) || aliases.includes(speaker));'''
    p['jsCode'] = replace_once(p['jsCode'], old, new)
    patches[OFFICIAL]['MM Parse Classifier'] = p
    return patches


if __name__ == '__main__':
    with gzip.open(sys.argv[1], 'rt') as f:
        baseline = json.load(f)
    patches = build(baseline)
    with gzip.open(sys.argv[2], 'wt') as f:
        json.dump(patches, f)
    print(json.dumps({wid: list(nodes) for wid, nodes in patches.items()}))
