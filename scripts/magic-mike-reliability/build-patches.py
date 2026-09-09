"""Reconstruct the reviewed release locally. Does not call APIs or publish workflows.
Private backups must be in the workspace's .magic-mike-repair-2026-09-08 directory.
Never apply these release patches to a newer workflow without a fresh diff review.
"""
import copy,json,pathlib
HERE=pathlib.Path(__file__).resolve().parent
PRIVATE=HERE.parents[2]/'.magic-mike-repair-2026-09-08'
for label in ['coaching','intake']:
 release=json.loads((PRIVATE/'release'/(label+'.operations.json')).read_text());wid=release['workflowId']
 w=json.loads((PRIVATE/(wid+'.before.json')).read_text())
 assert w['activeVersionId']==release['baseVersionId'],'Backup is not the reviewed base'
 for op in release['operations']:
  if op['type']=='removeNode':w['nodes']=[n for n in w['nodes'] if n['id']!=op['nodeId']]
  elif op['type']=='addNode':w['nodes'].append(copy.deepcopy(op['node']))
  elif op['type']=='updateNode':
   n=next(n for n in w['nodes'] if n['id']==op['nodeId'])
   for k,v in op['updates'].items():
    if v is None:n.pop(k,None)
    else:n[k]=copy.deepcopy(v)
  elif op['type']=='replaceConnections':w['connections']=copy.deepcopy(op['connections'])
  elif op['type']=='updateSettings':w['settings']=copy.deepcopy(op['settings'])
  else:raise ValueError('Unsupported release operation '+op['type'])
 (PRIVATE/(wid+'.candidate.json')).write_text(json.dumps(w))
 print(label,'reconstructed locally:',len(w['nodes']),'nodes')
