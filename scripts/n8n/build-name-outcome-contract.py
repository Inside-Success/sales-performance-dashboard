"""Build scoped, reversible node-parameter patches from a fresh private baseline.

No network. Does not edit prompts, credentials, connections, schedules or source data.
"""
import gzip, json, pathlib, sys

repo = pathlib.Path(__file__).resolve().parents[2]
baseline = json.loads(gzip.decompress(pathlib.Path(sys.argv[1]).read_bytes()))
shared = (repo / 'src/lib/coaching-presentation.js').read_text().replace('export function ', 'function ')
start = shared.index('function coachingClosingParts(')
end = shared.index('function formatCoachingTimestamp(', start)
new_sections = shared[start:end]
new_parts = shared[start:shared.index('function coachingSections(', start)]
patches = {}
for wid, workflow in baseline.items():
    patches[wid] = {}
    for node in workflow['nodes']:
        name, params = node['name'], json.loads(json.dumps(node['parameters']))
        if name == 'Clean Response':
            old = "normalized_client_name: effectiveName !== original_client_name ? effectiveName : '',"
            assert params['jsCode'].count(old) == 1
            params['jsCode'] = params['jsCode'].replace(old, 'resolved_client_name: effectiveName, normalized_client_name: effectiveName,')
        elif name == 'Edit Fields':
            fields = params['assignments']['assignments']
            field = next(x for x in fields if x['name'] == 'Client Name')
            field['value'] = "={{ (() => { const row = $('Loop Over Items').item.json; return /^(manual|verified)(\\b|:)/i.test(String(row['Client Name Source'] || '')) && String(row['Client Name'] || '').trim() ? row['Client Name'] : ($json.resolved_client_name || $json.normalized_client_name || $json.original_client_name || row['Client Name'] || ''); })() }}"
        else:
            code = params['jsCode']
            begin = code.index('function coachingSections(')
            finish = code.index('function coachingEvidence(', begin)
            if name == 'Code in JavaScript':
                assert 'const closeParts=' in code[begin:finish]
                params['jsCode'] = code[:begin] + new_sections + code[finish:]
            else:
                # Preserve the existing reviewed/structured document branch and
                # all sections. Repair only the flat closing comparison.
                old = " const remainder=coachingText(close.text).replace(outcome,'').trim();"
                assert code.count(old) == 1
                code = code.replace(old, " const parts=coachingClosingParts(close.text);\n const matched=parts[0] && comparison(parts[0])===comparison(outcome) ? parts[0] : '';\n const displayOutcome=matched||outcome;\n const remainder=parts.filter(part=>comparison(part)!==comparison(outcome)).join('\\n\\n');")
                tail = code[begin:code.index('function coachingEvidence(', begin)]
                assert tail.count("items:[outcome].filter(Boolean)") == 1
                tail = tail.replace("items:[outcome].filter(Boolean)", "items:[displayOutcome].filter(Boolean)")
                params['jsCode'] = code[:begin] + new_parts + tail + code[code.index('function coachingEvidence(', begin):]
        patches[wid][name] = params
pathlib.Path(sys.argv[2]).write_bytes(gzip.compress(json.dumps(patches).encode()))
print(json.dumps({wid:list(nodes) for wid,nodes in patches.items()}))
