"""Replace only the existing resolver prefix in three selected Code nodes.

Usage: python3 build-prospect-name-refinement.py BASELINE.json.gz PATCHES.json.gz
Private baseline is captured from current production; no network side effects.
"""
import gzip, json, pathlib, sys
END = "resolution: selected ? 'conversation_supported' : confidence === 'verified' ? 'manual_verified' : name === 'Prospect' ? 'no_usable_label' : 'display_label_retained' } };\n}\n"
inline = pathlib.Path(__file__).with_name('prospect-identity.mjs').read_text().replace('export function ', 'function ')
with gzip.open(sys.argv[1], 'rt') as f: baseline = json.load(f)
patches = {}
for wid, workflow in baseline.items():
    patches[wid] = {}
    for name, node in workflow['nodes'].items():
        code = node['parameters']['jsCode']
        assert code.startswith('// Pure, dependency-free resolver.') and code.count(END) == 1
        boundary = code.index(END) + len(END)
        patches[wid][name] = {'jsCode': inline + code[boundary:]}
with gzip.open(sys.argv[2], 'wt') as f: json.dump(patches, f)
print(json.dumps({wid: list(nodes) for wid, nodes in patches.items()}))
