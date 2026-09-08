"""Build private candidates only. No API access. Release requires separate quality and drift checks."""
import argparse,copy,json,pathlib,uuid
ap=argparse.ArgumentParser();ap.add_argument('private_dir',type=pathlib.Path);p=ap.parse_args().private_dir
out=p/'structured-candidate';out.mkdir(exist_ok=True)
lib=(pathlib.Path(__file__).parent/'structured-coaching.cjs').read_text().split('module.exports=')[0]
system=(p/'structured-system.txt').read_text();audit=(p/'structured-audit-system.txt').read_text()
shared=json.loads((p/'baseline/35bFcPYdHSADpyTN.json').read_text());url=next(n['parameters']['url'] for n in shared['nodes'] if n['name']=='Run Context-Rich Analysis')
config={'provider':'anthropic','model':'claude-opus-5','max_tokens':8500,'thinking':{'type':'adaptive'},'reasoning_effort':'high','pricing':{'input_mtok':5,'cache_write_mtok':6.25,'cache_read_mtok':0.5,'output_mtok':25}}
def node(name,code,x=9200,y=7200):return {'id':str(uuid.uuid4()),'name':name,'type':'n8n-nodes-base.code','typeVersion':2,'position':[x,y],'parameters':{'mode':'runOnceForEachItem','jsCode':code}}
def http(name,x=9450,y=7200):return {'id':str(uuid.uuid4()),'name':name,'type':'n8n-nodes-base.httpRequest','typeVersion':4.2,'position':[x,y],'parameters':{'method':'POST','url':url,'sendBody':True,'contentType':'raw','rawContentType':'application/json','body':'={{ JSON.stringify($json.provider_request) }}','options':{'timeout':600000}},'retryOnFail':True,'maxTries':2,'waitBetweenTries':3000}
for wid,manual in [('L8Nn7xncA9ZPDdWA',False),('BMRrGxHyXMcgO6j3',True)]:
 base=json.loads((p/'baseline'/(wid+'.json')).read_text());w=copy.deepcopy(base);ops=[]
 def update(name,code):
  n=next(n for n in w['nodes'] if n['name']==name);n['parameters']['jsCode']=code;ops.append({'type':'updateNode','nodeName':name,'updates':{'parameters.jsCode':code}})
 def add(n):
  if not manual:n['onError']='continueErrorOutput'
  w['nodes'].append(n);ops.append({'type':'addNode','node':n})
 def connect(s,t,index=0):
  c=w['connections'].setdefault(s,{'main':[]})['main']
  while len(c)<=index:c.append([])
  c[index].append({'node':t,'type':'main','index':0});ops.append({'type':'addConnection','source':s,'target':t,'sourceIndex':index})
 def disconnect(s,t,index=0):
  c=w['connections'][s]['main'][index];c.remove(next(e for e in c if e['node']==t));ops.append({'type':'removeConnection','source':s,'target':t,'sourceIndex':index})
 prefix='MM Manual' if manual else 'MM';build=prefix+' Build Structured Coaching' if manual else 'MM Build Coaching Request';provider=prefix+' Structured Coaching Provider' if manual else 'MM Coaching Provider';prep=prefix+' Build Factual Audit';review=prefix+' Factual Audit Provider';finish=prefix+' Render Audited Coaching';confirmPrep=prefix+' Build Audit Confirmation';confirm=prefix+' Audit Confirmation Provider'
 setup='const state=cloneCoachingJson($json.state); state.coaching_version=VERSION; state.coaching_model="claude-opus-5"; const input='+('state.input' if manual else 'state.caseItem')+'; const blocks=transcriptBlocks(input.cleaned_transcript); const metadata='+('input' if manual else 'input.metadata')+';'
 body='const provider_request={...'+json.dumps(config)+',request_id:state.result_id+"-structured",result_id:state.result_id,case_id:state.case_id||state.caseItem?.case_id,call_purpose:"call2_structured_coaching",system:'+json.dumps(system)+',prompt:"Metadata: "+JSON.stringify({rep_name:metadata.rep_name,client_name:metadata.client_name,call_date:metadata.call_date,meeting_title:metadata.meeting_title})+"\\nTRANSCRIPT BLOCKS:\\n"+JSON.stringify(blocks)}; return {json:{state,blocks,provider_request}};'
 if manual:
  add(node(build,lib+'\n'+setup+body,8400));add(http(provider,8650));disconnect('MM Manual If Safety Needed','MM Manual Build Safety Screen Request');connect('MM Manual If Safety Needed',build);connect(build,provider)
 else:
  old=next(n['parameters']['jsCode'] for n in base['nodes'] if n['name']==build);start=old.rfind('const state = clone($json.state);');assert start>0
  # Preserve the live context refresh used by subsequent compliance. Coaching uses its own instructions.
  update(build,old[:start]+lib+'\n'+setup+'\nawait refreshCutoverContext(state);\n'+body)
  disconnect('MM Call 2 Coaching + Evidence Score','MM Adapt VNext Coaching Result');connect('MM Call 2 Coaching + Evidence Score','MM Restore Coaching Request Fallback');disconnect(provider,'MM Build Compliance Request')
 prepCode=lib+'\nconst prepared=$('+json.dumps(build)+').item.json; const generated=$json; if(generated.ok===false||["length","max_tokens"].includes(generated.stop_reason))throw Error("Structured coaching generation failed"); if(generated.request_id!==prepared.provider_request.request_id)throw Error("Coaching source alignment failed"); const analysis=generated.parsed_json; const validated=renderCoaching(analysis,prepared.blocks); if(validated.status!=="completed")throw Error("Coaching eligibility disagrees with completed gate"); return {json:{...prepared,generated,analysis,provider_request:{...'+json.dumps({**config,'max_tokens':6000})+',request_id:prepared.state.result_id+"-factual-audit",result_id:prepared.state.result_id,case_id:prepared.state.case_id||prepared.state.caseItem?.case_id,call_purpose:"call2_coaching_factual_audit",system:'+json.dumps(audit)+',prompt:"TRANSCRIPT BLOCKS:\\n"+JSON.stringify(prepared.blocks)+"\\n\\nUNTRUSTED ANALYSIS:\\n"+JSON.stringify(analysis)}}};'
 add(node(prep,prepCode));add(http(review));connect(provider,prep);connect(prep,review)
 confirmCode=lib+'\nconst prepared=$('+json.dumps(prep)+').item.json; const firstAudit=$json; if(firstAudit.ok===false||["length","max_tokens"].includes(firstAudit.stop_reason)||firstAudit.request_id!==prepared.provider_request.request_id)throw Error("First factual audit failed or source mismatch"); applyAudit(prepared.analysis,firstAudit.parsed_json,prepared.blocks); return {json:{...prepared,firstAudit,provider_request:{...prepared.provider_request,request_id:prepared.state.result_id+"-factual-confirm",call_purpose:"call2_coaching_factual_confirmation"}}};'
 add(node(confirmPrep,confirmCode,9700));add(http(confirm,9950));connect(review,confirmPrep);connect(confirmPrep,confirm)
 finalCode=lib+'\nconst prepared=$('+json.dumps(confirmPrep)+').item.json; if($json.ok===false||["length","max_tokens"].includes($json.stop_reason))throw Error("Coaching audit generation failed"); if($json.request_id!==prepared.provider_request.request_id)throw Error("Audit source alignment failed"); const audited=applyAuditConsensus(prepared.analysis,prepared.firstAudit.parsed_json,$json.parsed_json,prepared.blocks); const report=renderCoaching(audited,prepared.blocks);'
 if manual:
  finalCode+='const state=cloneCoachingJson(prepared.state); state.coaching_raw={...state.coaching_raw,...report}; state.provider_results.push({purpose:"structured_coaching",result:prepared.generated},{purpose:"coaching_factual_audit",result:prepared.firstAudit},{purpose:"coaching_factual_confirmation",result:$json}); return {json:{...state.input,state}};'
  target='MM Manual Build Safety Screen Request'
  name='MM Manual Finalize Coaching';s=next(n['parameters']['jsCode'] for n in base['nodes'] if n['name']==name);s=s.replace('agent_version: CUTOVER.agent_version } };','agent_version: state.coaching_version || CUTOVER.agent_version, coaching_version: state.coaching_version || null, coaching_model: state.coaching_model || null } };');update(name,s)
 else:
  finalCode+='const sum=(a,b)=>Object.fromEntries([...new Set([...Object.keys(a||{}),...Object.keys(b||{})])].filter(k=>typeof a?.[k]==="number"||typeof b?.[k]==="number").map(k=>[k,Number(a?.[k]||0)+Number(b?.[k]||0)])); return {json:{...prepared.generated,parsed_json:report,model_text:JSON.stringify(report),costs:sum(sum(prepared.generated.costs,prepared.firstAudit.costs),$json.costs),usage:sum(sum(prepared.generated.usage,prepared.firstAudit.usage),$json.usage),latency_ms:Number(prepared.generated.latency_ms||0)+Number(prepared.firstAudit.latency_ms||0)+Number($json.latency_ms||0),coaching_version:VERSION,factual_audit:{first:prepared.firstAudit.parsed_json,confirmation:$json.parsed_json}}};'
  target='MM Build Compliance Request'
  name='Performance Agent';s=next(n['parameters']['jsCode'] for n in base['nodes'] if n['name']==name);s=s.replace('model_version: CUTOVER.coaching.model ||','model_version: state.coaching_model || CUTOVER.coaching.model ||').replace('agent_version: CUTOVER.agent_version','agent_version: state.coaching_version || CUTOVER.agent_version');update(name,s)
 add(node(finish,finalCode,9700));connect(confirm,finish);connect(finish,target)
 if not manual:
  for name in [prep,review,confirmPrep,confirm,finish]:connect(name,'Set: agent_failed',1)
 # Persist generation identity in the existing single dashboard/callback write.
 if manual:
  name='Parse AI Output';code=next(n['parameters']['jsCode'] for n in base['nodes'] if n['name']==name);assert code.count("model_version: 'claude-sonnet-4-6'")==1;update(name,code.replace("model_version: 'claude-sonnet-4-6'","model_version: first.coaching_model || 'claude-sonnet-4-6'"))
  name='Build Complete Callback';code=next(n['parameters']['jsCode'] for n in base['nodes'] if n['name']==name);assert code.count("  status: 'completed',")==1;update(name,code.replace("  status: 'completed',","  status: 'completed',\n  coaching_version: report.agent_version || null,\n  coaching_model: report.model_version || null,"))
 else:
  n=next(n for n in w['nodes'] if n['name']=='Post to Dashboard');body=n['parameters']['body'];assert body.count("call_status: 'scored',")==1
  body=body.replace("call_status: 'scored',","call_status: 'scored', coaching_version: $('Performance Agent').item.json.agent_version || null, coaching_model: $('Performance Agent').item.json.output.airtable.scorecard_record.model_version || null,")
  n['parameters']['body']=body;ops.append({'type':'updateNode','nodeName':n['name'],'updates':{'parameters.body':body}})
 # Shared compliance context, scoring subworkflow, safety, and write counts are preserved.
 (out/(wid+'.json')).write_text(json.dumps(w,indent=2));(out/(wid+'.operations.json')).write_text(json.dumps({'id':wid,'operations':ops},indent=2))
 print(wid,len(w['nodes']),'nodes;',len(ops),'operations; not applied')
