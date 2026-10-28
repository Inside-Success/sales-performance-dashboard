"""Read-only release preflight and post-publish verification; private snapshots only."""
import sys, json, pathlib, tomllib, urllib.request, ssl, certifi, hashlib
root=pathlib.Path(sys.argv[1]);mode=sys.argv[2]
assert mode in ('before','after')
config=tomllib.loads((pathlib.Path.home()/'.codex/config.toml').read_text())['mcp_servers']['n8n']['env']
operations=json.loads((root/'candidate-operations.json').read_text())
for wid,ops in operations.items():
 request=urllib.request.Request(config['N8N_API_URL'].rstrip('/')+'/api/v1/workflows/'+wid,headers={'X-N8N-API-KEY':config['N8N_API_KEY']})
 with urllib.request.urlopen(request,context=ssl.create_default_context(cafile=certifi.where()),timeout=30) as response:live=json.load(response)
 baseline=json.loads((root/('full-release-baseline-'+wid+'.json')).read_text())
 expected=json.loads(json.dumps(baseline));nodes={n['name']:n for n in expected['nodes']}
 if mode=='after':
  for op in ops:
   for key,value in op['updates'].items():
    target=nodes[op['nodeName']];parts=key.split('.')
    for part in parts[:-1]:target=target[part]
    target[parts[-1]]=value
 assert live['connections']==expected['connections'],wid+' connections changed'
 assert len(live['nodes'])==len(expected['nodes']),wid+' node count changed'
 for node in live['nodes']:
  old=nodes[node['name']]
  for key in ['id','name','type','parameters','credentials','disabled','onError','retryOnFail','maxTries','waitBetweenTries']:
   assert node.get(key)==old.get(key),wid+' unexpected node change: '+node['name']+' '+key
 assert live['settings']==expected['settings'],wid+' settings changed'
 active=live.get('activeVersion')
 assert live.get('active') and live.get('activeVersionId')==live.get('versionId'),wid+' draft not published'
 if active:assert active['nodes']==live['nodes'] and active['connections']==live['connections'],wid+' published graph differs'
 (root/(mode+'-verified-'+wid+'.json')).write_text(json.dumps(live))
 print(json.dumps({'id':wid,'version':live['versionId'],'nodes':len(live['nodes']),'changed_nodes':len(ops),'verified':mode,'target_hashes':{op['nodeName']:hashlib.sha256(json.dumps(next(n for n in live['nodes'] if n['name']==op['nodeName'])['parameters'],sort_keys=True).encode()).hexdigest() for op in ops}}))
