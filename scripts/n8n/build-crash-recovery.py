"""Build scoped n8n diff operations from private workflow rollback snapshots.
Usage: python3 scripts/n8n/build-crash-recovery.py PRIVATE_DIR DRAFT_TABLE_ID
No credentials or production execution content is committed to Git.
"""
import copy,gzip,json,pathlib,sys,uuid
root=pathlib.Path(sys.argv[1]); table=sys.argv[2]
lib=pathlib.Path(__file__).with_name('crash-recovery.mjs').read_text().replace('export ','')
def baseline(fid):return json.loads(gzip.decompress((root/(fid+'.baseline.json.gz')).read_bytes()))
def node(w,name):return next(n for n in w['nodes'] if n['name']==name)
def cloned(w,old,name,x,y):
 n=copy.deepcopy(node(w,old));n.update(id=str(uuid.uuid4()),name=name,position=[x,y]);return n
def code(name,tail,x,y):return {'id':str(uuid.uuid4()),'name':name,'type':'n8n-nodes-base.code','typeVersion':2,'position':[x,y],'parameters':{'jsCode':lib+'\n'+tail}}
def iff(w,old,name,expr,x,y):
 n=cloned(w,old,name,x,y);c=n['parameters']['conditions']['conditions'][0];c.update(leftValue=expr,rightValue='',operator={'type':'boolean','operation':'true','singleValue':True});return n
class Patch:
 def __init__(self,w):self.w=copy.deepcopy(w);self.ops=[]
 def add(self,n):self.ops.append({'type':'addNode','node':n});self.w['nodes'].append(n)
 def update(self,name,updates):
  self.ops.append({'type':'updateNode','nodeName':name,'updates':updates})
  for k,v in updates.items():
   keys=k.split('.');obj=node(self.w,name)
   for key in keys[:-1]:obj=obj[key]
   obj[keys[-1]]=v
 def wire(self,s,t,idx=0):
  self.ops.append({'type':'addConnection','source':s,'target':t,'sourceIndex':idx});m=self.w['connections'].setdefault(s,{'main':[]})['main']
  while len(m)<=idx:m.append([])
  m[idx].append({'node':t,'type':'main','index':0})
 def rewire(self,s,old,new,idx=0):
  self.ops.append({'type':'rewireConnection','source':s,'from':old,'to':new,'sourceIndex':idx})
  for edge in self.w['connections'][s]['main'][idx]:
   if edge['node']==old:edge['node']=new
 def save(self,fid):
  (root/(fid+'.ops.json')).write_text(json.dumps(self.ops));(root/(fid+'.candidate.json')).write_text(json.dumps(self.w))
# Official: separate unreviewed cache, never the reviewed-result shortcut.
fid='L8Nn7xncA9ZPDdWA';w=baseline(fid);p=Patch(w)
n=cloned(w,'MM Read Recovery Cache','MM Read Unreviewed Draft',9200,7150);n['parameters']['dataTableId']['value']=table;p.add(n)
p.add(code('MM Validate Unreviewed Draft',"const prepared=$('MM Build Coaching Request').item.json;const source=$('If').item.json['Source Airtable Record ID'];return [{json:{generated:validateDraft($json,prepared,source)},pairedItem:{item:0}}];",9420,7150))
p.add(iff(w,'MM Has Reviewed Recovery','MM Draft Matches Current Request','={{ Boolean($json.generated) }}',9640,7150))
n=code('MM Restore Unreviewed Draft','return [{json:$json.generated,pairedItem:{item:0}}];',9860,7050);p.add(n)
p.rewire('MM Has Reviewed Recovery','MM Restore Coaching Request Fallback','MM Read Unreviewed Draft',1)
p.wire('MM Read Unreviewed Draft','MM Validate Unreviewed Draft');p.wire('MM Validate Unreviewed Draft','MM Draft Matches Current Request')
p.wire('MM Draft Matches Current Request','MM Restore Unreviewed Draft');p.wire('MM Draft Matches Current Request','MM Restore Coaching Request Fallback',1)
p.wire('MM Restore Unreviewed Draft','MM Reliable Coaching');p.save(fid)
# Worker: terminal stale processing claims are held, never blindly replayed.
fid='Zx3S5B1gYHRrbv2F';w=baseline(fid);p=Patch(w)
n=cloned(w,'Read Queued Call','Read Processing Claims',480,400);n['parameters'].update(returnAll=True);n['parameters'].pop('limit',None);n['parameters']['filters']['conditions'][0]['keyValue']='processing';p.add(n)
p.add(code('Select Stale Processing Claim','return staleClaims($input.all().map(x=>x.json)).map(row=>({json:row,pairedItem:{item:$input.all().findIndex(x=>x.json.id===row.id)}}));',720,400))
s=baseline('mIsdpJO71D8DMrxe');n=cloned(s,'Read Failed Execution','Read Claim Execution',960,400);n['parameters']['url']="={{ 'https://insidesuccess.app.n8n.cloud/api/v1/executions/' + $json.execution_id }}";p.add(n)
p.add(code('Confirm Terminal Stale Claim',"const row=$('Select Stale Processing Claim').item.json;return canHoldClaim(row,$json)?[{json:row,pairedItem:{item:0}}]:[];",1200,400))
n=cloned(w,'Close Unfinished Attempt','Hold Crashed Recovery Claim',1440,400);n.pop('alwaysOutputData',None)
n['parameters']['filters']['conditions']=[{'keyName':'id','condition':'eq','keyValue':'={{ $json.id }}'},{'keyName':'status','condition':'eq','keyValue':'processing'},{'keyName':'execution_id','condition':'eq','keyValue':'={{ $json.execution_id }}'}]
n['parameters']['columns']['value']['message']='Recovery worker ended before a final receipt. Held safely: inspect parent/child execution and partial writes before retry.';p.add(n)
p.wire('Every Five Minutes','Read Processing Claims');p.wire('Read Processing Claims','Select Stale Processing Claim');p.wire('Select Stale Processing Claim','Read Claim Execution');p.wire('Read Claim Execution','Confirm Terminal Stale Claim');p.wire('Confirm Terminal Stale Claim','Hold Crashed Recovery Claim');p.wire('Hold Crashed Recovery Claim','Notify Unfinished Recovery');p.save(fid)
# Scanner: merge error and crash lists sequentially; save draft before queue.
fid='mIsdpJO71D8DMrxe';w=baseline(fid);p=Patch(w)
n=cloned(w,'Read Failed Executions','Read Crashed Executions',420,0);n['parameters']['url']=n['parameters']['url'].replace('status=error','status=crashed');p.add(n)
p.rewire('Read Failed Executions','Read Scan Receipts','Read Crashed Executions');p.wire('Read Crashed Executions','Read Scan Receipts')
p.update('Select Unscanned Failures',{'parameters.jsCode':lib+"\nreturn selectFailures([$('Read Failed Executions').first().json,$('Read Crashed Executions').first().json],$input.all().map(x=>x.json)).map(e=>({json:{execution_id:String(e.id)}}));"})
p.update('Plan Missing Calls',{'parameters.jsCode':lib+"\nconst e=$('Read Failed Execution').first(0,$runIndex).json;const rows=planMissing(e,$input.all().map(x=>x.json));return (rows.length?rows:[{source_id:'',execution_id:String(e.id)}]).map(row=>({json:row}));"})
p.add(iff(w,'Has Missing Calls','Has Saved Unreviewed Draft','={{ Boolean($json.draft) }}',680,500))
n=cloned(w,'Queue Missing Calls','Save Unreviewed Draft',900,500);n['parameters'].update(operation='upsert',matchType='allConditions',filters={'conditions':[{'keyName':'source_id','condition':'eq','keyValue':'={{ $json.source_id }}'}]});n['parameters']['dataTableId']['value']=table
n['parameters']['columns']={'mappingMode':'defineBelow','value':{'source_id':'={{ $json.draft.source_id }}','payload':'={{ $json.draft.payload }}','revision':'={{ $json.draft.revision }}'},'matchingColumns':[],'schema':[{'id':k,'displayName':k,'type':'string','display':True,'required':False,'canBeUsedToMatch':True} for k in ['source_id','payload','revision']]};p.add(n)
n=code('Restore Missing Call Plan',"return $input.all().map((x,i)=>({json:$('Has Saved Unreviewed Draft').itemMatching(i).json,pairedItem:{item:i}}));",1120,500);p.add(n)
p.rewire('Has Missing Calls','Queue Missing Calls','Has Saved Unreviewed Draft');p.wire('Has Saved Unreviewed Draft','Save Unreviewed Draft');p.wire('Has Saved Unreviewed Draft','Queue Missing Calls',1);p.wire('Save Unreviewed Draft','Restore Missing Call Plan');p.wire('Restore Missing Call Plan','Queue Missing Calls');p.save(fid)
print('Built three scoped candidate workflows and operation lists in private directory.')
