"""Prepare scoped inverse operations privately. Never calls n8n or changes production."""
import argparse,json,pathlib,hashlib
ap=argparse.ArgumentParser();ap.add_argument('private_dir',type=pathlib.Path);ap.add_argument('--candidate-dir',default='candidate');a=ap.parse_args();p=a.private_dir;candidate_dir=a.candidate_dir
for f in (p/candidate_dir).glob('*.operations.json'):
 candidate=json.loads(f.read_text());wid=candidate['id'];base=json.loads((p/'baseline'/(wid+'.json')).read_text());inverse=[]
 for op in reversed(candidate['operations']):
  kind=op['type']
  if kind=='addNode': inverse.append({'type':'removeNode','nodeName':op['node']['name']})
  elif kind in ['addConnection','removeConnection']:
   inverse.append({**op,'type':'removeConnection' if kind=='addConnection' else 'addConnection'})
  elif kind=='updateNode':
   node=next(n for n in base['nodes'] if n['name']==op['nodeName']);updates={}
   for key in op['updates']:
    value=node
    for part in key.split('.'):value=value[part]
    updates[key]=value
   inverse.append({'type':'updateNode','nodeName':node['name'],'updates':updates})
  else:raise ValueError('Unsupported inverse operation: '+kind)
 payload={'id':wid,'baseline_version_id':base.get('versionId'),'baseline_sha256':hashlib.sha256((p/'baseline'/(wid+'.json')).read_bytes()).hexdigest(),'precondition':'Before use, compare current affected nodes and edges against the exact released candidate. Stop on unrelated drift. Validate-only first. Never restore unrelated workflow state.','operations':inverse}
 (p/candidate_dir/(wid+'.rollback.json')).write_text(json.dumps(payload,indent=2))
 print(wid,'scoped rollback operations',len(inverse))
