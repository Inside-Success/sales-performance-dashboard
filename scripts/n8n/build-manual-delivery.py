"""Build scoped manual delivery candidates from a private current workflow backup.
Usage: python3 scripts/n8n/build-manual-delivery.py /path/to/private-evidence-folder
No credentials or saved report content are embedded by this builder.
"""
import copy,json,pathlib,sys,uuid
P=pathlib.Path(sys.argv[1]); w=json.loads((P/'BMRrGxHyXMcgO6j3.before.json').read_text()); tid=json.loads((P/'queue.json').read_text())['id']
ORIGIN='https://sales-performance-dashboard-rose.vercel.app'; CALLBACK=ORIGIN+'/api/manual-reports/callback'
credential=copy.deepcopy(next(n for n in w['nodes'] if n['name']=='Post Callback')['credentials'])
def node(name,typ,params,version=1,**kw):return dict(id=str(uuid.uuid4()),name=name,type='n8n-nodes-base.'+typ,typeVersion=version,position=[0,0],parameters=params,**kw)
def edge(w,a,b,out=0):
 c=w['connections'].setdefault(a,{'main':[]})['main']
 while len(c)<=out:c.append([])
 c[out].append({'node':b,'type':'main','index':0})
def table(name,operation,values=None,conditions=None):
 p={'resource':'row','operation':operation,'dataTableId':{'__rl':True,'mode':'id','value':tid},'options':{}}
 if conditions:p.update(matchType='allConditions',filters={'conditions':[{'keyName':k,'condition':'eq','keyValue':v} for k,v in conditions.items()]})
 if values:p['columns']={'mappingMode':'defineBelow','value':values,'matchingColumns':[],'schema':[{'id':k,'displayName':k,'type':'number' if k=='attempts' else 'date' if k.endswith('_at') else 'string','display':True,'required':False,'canBeUsedToMatch':True} for k in values]}
 if operation=='get':p.update(returnAll=False,limit=100)
 return node(name,'dataTable',p,1.1,retryOnFail=True,maxTries=3,waitBetweenTries=2000)
def code(name,script):return node(name,'code',{'jsCode':script},2)
def condition(name,expr):return node(name,'if',{'conditions':{'options':{'version':2,'leftValue':'','caseSensitive':True,'typeValidation':'strict'},'conditions':[{'id':str(uuid.uuid4()),'leftValue':expr,'rightValue':True,'operator':{'type':'boolean','operation':'true','singleValue':True}}],'combinator':'and'},'options':{}},2.2)
def http(name):return node(name,'httpRequest',{'method':'POST','url':CALLBACK,'authentication':'genericCredentialType','genericAuthType':'httpHeaderAuth','sendBody':True,'contentType':'raw','rawContentType':'application/json','body':'={{ $json.payload }}','options':{'response':{'response':{'responseFormat':'json'}},'timeout':15000}},4.4,credentials=copy.deepcopy(credential),retryOnFail=True,maxTries=3,waitBetweenTries=2000,onError='continueErrorOutput')
def updates(name,ref):return table(name,'update',{k:'={{ $json.'+k+' }}' for k in ['status','attempts','next_attempt_at','last_error','delivered_at']},{'id':ref})
def receipt(name,source):
 return code(name,"""const row=$('%s').item.json;
const expected=JSON.parse(row.payload);const receipt=$json;
const delivered=receipt.ok===true && receipt.public_id===row.public_id && receipt.status===expected.status;
return [{json:{...row,status:delivered?'delivered':'queued',last_error:delivered?'':'Callback did not acknowledge the saved report',delivered_at:delivered?new Date().toISOString():null},pairedItem:{item:0}}];"""%source)
def retry(name,source):
 return code(name,"""const row=$('%s').item.json;
const exhausted=Number(row.attempts)>=8;
return [{json:{...row,status:exhausted?'needs_review':'queued',last_error:'Saved report delivery failed; inspect the callback execution. No AI was rerun.',delivered_at:null},pairedItem:{item:0}}];"""%source)
# Reject invalid callbacks before paid work, return a real acceptance/rejection receipt.
webhook=next(n for n in w['nodes'] if n['name']=='Manual Feedback Webhook');webhook['parameters']['responseMode']='responseNode';webhook['parameters']['authentication']='headerAuth';webhook['credentials']=copy.deepcopy(credential)
normal=next(n for n in w['nodes'] if n['name']=='Normalize Input');s=normal['parameters']['jsCode'];s=s.replace("if (!incoming.public_id) throw new Error('public_id is required');\nif (!callbackUrl) throw new Error('callback_url is required');", """const valid=/^[a-f0-9]{32}$/.test(String(incoming.public_id||'')) && callbackUrl==='%s' && incoming.report_url==='%s/self-report/'+incoming.public_id && !!String(incoming.rep_name||'').trim() && ['transcript','zoom_link'].includes(incoming.input_type);
if(!valid) return [{json:{valid:false,error:'Invalid manual report delivery destination or submission'}}];"""%(CALLBACK,ORIGIN));s=s.replace('    public_id: String(incoming.public_id),','    valid: true,\n    public_id: String(incoming.public_id),');normal['parameters']['jsCode']=s
w['connections']['Normalize Input']={'main':[[{'node':'Valid Manual Submission','type':'main','index':0}]]}
w['nodes'] += [condition('Valid Manual Submission','={{ $json.valid }}'),node('Accept Manual Submission','respondToWebhook',{'respondWith':'json','responseBody':'={{ JSON.stringify({ok:true,public_id:$json.public_id,status:"processing"}) }}','options':{'responseCode':202}},1.5),node('Reject Manual Submission','respondToWebhook',{'respondWith':'json','responseBody':'={{ JSON.stringify({ok:false,error:$json.error}) }}','options':{'responseCode':400}},1.5)]
edge(w,'Valid Manual Submission','Accept Manual Submission');edge(w,'Valid Manual Submission','Reject Manual Submission',1);edge(w,'Accept Manual Submission','Has Transcript')
# Cache every terminal result before attempting delivery. Delivery is credential-pinned.
queue=table('Save Manual Result','insert',{'public_id':'={{ $json.public_id }}','payload':'={{ JSON.stringify($json) }}','status':'queued','attempts':0,'next_attempt_at':'={{ $now.plus({minutes:2}).toISO() }}','last_error':'','execution_id':'={{ String($execution.id) }}'})
w['nodes'].append(queue)
for streams in w['connections'].values():
 for targets in streams.get('main',[]):
  for target in targets:
   if target['node']=='Post Callback':target['node']='Save Manual Result'
post=next(n for n in w['nodes'] if n['name']=='Post Callback');post.update(http('Post Callback'));w['nodes'] += [receipt('Check Manual Delivery Receipt','Save Manual Result'),code('Keep Manual Result Queued',"const row=$('Save Manual Result').item.json;return [{json:{...row,last_error:'Initial callback failed; saved result is queued for retry.',delivered_at:null},pairedItem:{item:0}}];"),updates('Save Manual Delivery Receipt','={{ $json.id }}')]
edge(w,'Save Manual Result','Post Callback');edge(w,'Post Callback','Check Manual Delivery Receipt');edge(w,'Post Callback','Keep Manual Result Queued',1);edge(w,'Check Manual Delivery Receipt','Save Manual Delivery Receipt');edge(w,'Keep Manual Result Queued','Save Manual Delivery Receipt')
w['settings']['errorWorkflow']='mgvnNUDfqNatEy3e'
# Worker reads only cached payloads. A ten-minute lease survives worker failure; no AI/docs path exists.
r={'name':'Magic Mike - Manual Saved Result Delivery','nodes':[],'connections':{},'settings':{'executionOrder':'v1','timezone':'America/New_York','saveDataSuccessExecution':'all','saveDataErrorExecution':'all','executionTimeout':120,'errorWorkflow':'mgvnNUDfqNatEy3e'}}
r['nodes']=[node('Every Two Minutes','scheduleTrigger',{'rule':{'interval':[{'field':'minutes','minutesInterval':2}]}},1.2),table('Read Queued Manual Results','get',conditions={'status':'queued'}),code('Select Due Manual Result',"const now=Date.now();return $input.all().map((x,i)=>({...x,pairedItem:{item:i}})).filter(x=>x.json.id && new Date(x.json.next_attempt_at||0).getTime()<=now).sort((a,b)=>new Date(a.json.next_attempt_at||0)-new Date(b.json.next_attempt_at||0)).slice(0,1);"),table('Reserve Manual Delivery Attempt','update',{'attempts':'={{ Number($json.attempts||0)+1 }}','next_attempt_at':'={{ $now.plus({minutes:10}).toISO() }}'},{'id':'={{ $json.id }}','status':'queued','attempts':'={{ $json.attempts }}'}),code('Validate Saved Manual Result',"const payload=JSON.parse($json.payload);if(payload.public_id!==$json.public_id || !/^[a-f0-9]{32}$/.test(payload.public_id)|| !['completed','refused','needs_transcript_paste','failed'].includes(payload.status)) throw new Error('Invalid cached manual result');return $input.all();"),http('Deliver Saved Manual Result'),receipt('Check Saved Delivery Receipt','Reserve Manual Delivery Attempt'),retry('Record Manual Delivery Retry','Reserve Manual Delivery Attempt'),updates('Persist Manual Delivery State','={{ $json.id }}'),condition('Manual Delivery Needs Review','={{ $json.status === "needs_review" }}'),node('Manual Delivery Exhausted','stopAndError',{'errorType':'errorMessage','errorMessage':'Saved manual report delivery exhausted eight attempts. The result remains in Magic Mike Manual Result Delivery for recovery; do not regenerate AI.'},1)]
# Receipt mismatch must follow the same bounded retry policy as HTTP errors.
r['nodes'][6]['parameters']['jsCode']=r['nodes'][6]['parameters']['jsCode'].replace("status:delivered?'delivered':'queued'","status:delivered?'delivered':Number(row.attempts)>=8?'needs_review':'queued'")
for a,b in [('Every Two Minutes','Read Queued Manual Results'),('Read Queued Manual Results','Select Due Manual Result'),('Select Due Manual Result','Reserve Manual Delivery Attempt'),('Reserve Manual Delivery Attempt','Validate Saved Manual Result'),('Validate Saved Manual Result','Deliver Saved Manual Result'),('Deliver Saved Manual Result','Check Saved Delivery Receipt'),('Check Saved Delivery Receipt','Persist Manual Delivery State'),('Record Manual Delivery Retry','Persist Manual Delivery State'),('Persist Manual Delivery State','Manual Delivery Needs Review'),('Manual Delivery Needs Review','Manual Delivery Exhausted')]:edge(r,a,b)
edge(r,'Deliver Saved Manual Result','Record Manual Delivery Retry',1)
for workflow,name in [(w,'manual-candidate.json'),(r,'worker-candidate.json')]:
 for i,n in enumerate(workflow['nodes']):
  if n['position']==[0,0] and n['name']!='Manual Feedback Webhook':n['position']=[(i%8)*280,500+(i//8)*220]
 (P/name).write_text(json.dumps(workflow,indent=2))
print('Built manual input validation, durable result cache, and delivery-only worker')
# A generation failure must also reach the report page. Recover a saved terminal result
# from the failed execution when present; otherwise deliver an explicit failure result.
scanner=json.loads((P/'scanner.before.json').read_text());api_credential=copy.deepcopy(next(n for n in scanner['nodes'] if n['name']=='Read Failed Execution')['credentials'])
f={'name':'Magic Mike - Manual Failure Result Recovery','nodes':[],'connections':{},'settings':{'executionOrder':'v1','saveDataSuccessExecution':'all','saveDataErrorExecution':'all','executionTimeout':120,'errorWorkflow':'mgvnNUDfqNatEy3e'}}
f['nodes']=[node('Manual Workflow Error','errorTrigger',{},1),node('Read Failed Manual Execution','httpRequest',{'url':"={{ 'https://insidesuccess.app.n8n.cloud/api/v1/executions/' + $json.execution.id + '?includeData=true' }}",'authentication':'genericCredentialType','genericAuthType':'httpHeaderAuth','options':{'timeout':20000}},4.4,credentials=api_credential,retryOnFail=True,maxTries=3,waitBetweenTries=2000),code('Recover Manual Terminal Result',"""const e=$input.first().json;
if(e.workflowId!=='BMRrGxHyXMcgO6j3') throw new Error('Unexpected manual failure workflow');
const rd=e.data?.resultData?.runData||{};
// An already persisted payload is owned by the delivery worker, never regenerate it.
if((rd['Save Manual Result']||[]).some(r=>r.data?.main?.[0]?.some(i=>i.json?.id))) return [];
const last=(name)=>(rd[name]||[]).flatMap(r=>r.data?.main?.[0]||[]).map(i=>i.json).at(-1);
const input=last('Normalize Input');if(!input?.valid) return [];
const saved=last('Build Complete Callback')||last('Build Refusal Callback')||last('Build Needs Transcript Callback');
const payload=saved||{public_id:input.public_id,status:'failed',rep_name:input.rep_name,refusal_reason:'This report could not be prepared. The failure has been recorded for review. Keep this report link before resubmitting.'};
if(payload.public_id!==input.public_id) throw new Error('Manual recovery identity mismatch');
return [{json:{public_id:payload.public_id,payload:JSON.stringify(payload),status:'queued',attempts:0,next_attempt_at:new Date().toISOString(),execution_id:String(e.id),last_error:'Recovered from failed manual execution'}}];"""),table('Save Recovered Manual Result','insert',{k:'={{ $json.'+k+' }}' for k in ['public_id','payload','status','attempts','next_attempt_at','last_error','execution_id']})]
for a,b in [('Manual Workflow Error','Read Failed Manual Execution'),('Read Failed Manual Execution','Recover Manual Terminal Result'),('Recover Manual Terminal Result','Save Recovered Manual Result')]:edge(f,a,b)
for i,n in enumerate(f['nodes']):n['position']=[i*300,0]
(P/'failure-candidate.json').write_text(json.dumps(f,indent=2))
print('Built generation-failure result recovery (no new AI generation)')
