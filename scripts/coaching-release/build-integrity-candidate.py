"""Compile guarded integrity changes from private workflow baselines. No network or writes to services."""
from pathlib import Path
import json,copy,re,sys
p=Path(sys.argv[1]);r=Path(__file__).resolve().parents[2];out=p/'candidate';out.mkdir(exist_ok=True)
lib=(r/'scripts/coaching-release/text-integrity.cjs').read_text().split('module.exports=')[0]
join=(r/'scripts/coaching-release/reconciliation-precheck.cjs').read_text().split('module.exports=')[0]
for wid in ['L8Nn7xncA9ZPDdWA','BMRrGxHyXMcgO6j3','qMQYNQtQbRZWjtG2']:
 b=json.loads((p/'baseline'/f'{wid}.json').read_text());w=copy.deepcopy(b);ops=[];inverse=[]
 for n,old in zip(w['nodes'],b['nodes']):
  code=n.get('parameters',{}).get('jsCode','')
  if wid!='qMQYNQtQbRZWjtG2' and 'function splitSentences(text)' in code:
   assert 'Compliance' not in n['name'],n['name']
   code=re.sub(r'function dedupeRepeatedSentencesText\(text\) \{.*?(?=\nfunction )','',code,flags=re.S)
   code,count=re.subn(r'function splitSentences\(text\) \{\n.*?\n\}',lambda m:lib,code,count=1,flags=re.S);assert count==1
   if 'function applyRepairs(' in code:
    needle=next(v for v in ['const after = String(repair.after || "").trim();','const after = String(repair.after ?? "").trim();'] if v in code)
    code=code.replace(needle,'const after = coachingRepairAfter(target.before, String(repair.after || "").trim());')
   n['parameters']['jsCode']=code
  if wid=='qMQYNQtQbRZWjtG2' and n['name'].startswith('Attach Reconciliation Precheck Result'):
   suffix=n['name'][len('Attach Reconciliation Precheck Result'):];source='Prepare Reconciliation Airtable Precheck'+suffix
   n['parameters']['jsCode']=join+'\nreturn attachReconciliationPrecheck($('+json.dumps(source)+').all(),$input.all());\n'
  if n!=old:
   ops.append({'type':'updateNode','nodeName':n['name'],'updates':{'parameters.jsCode':n['parameters']['jsCode']}});inverse.append({'type':'updateNode','nodeName':old['name'],'updates':{'parameters.jsCode':old['parameters']['jsCode']}})
 assert w['connections']==b['connections'] and w['settings']==b['settings']
 (out/f'{wid}.json').write_text(json.dumps(w));(out/f'{wid}.operations.json').write_text(json.dumps({'id':wid,'operations':ops}));(out/f'{wid}.rollback.json').write_text(json.dumps({'id':wid,'operations':inverse}));print(wid,[x['nodeName'] for x in ops])
