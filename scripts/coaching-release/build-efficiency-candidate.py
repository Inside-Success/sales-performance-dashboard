"""Build an isolated successor from fresh private baselines. Never calls a service."""
import argparse,copy,json,pathlib
ap=argparse.ArgumentParser();ap.add_argument('private_dir',type=pathlib.Path);p=ap.parse_args().private_dir
out=p/'candidate';out.mkdir(exist_ok=True)
common=(p/'common-system.txt').read_text();writer=(p/'writer-task.txt').read_text();audit=(p/'audit-task.txt').read_text()
lib=(pathlib.Path(__file__).parent/'structured-coaching.cjs').read_text().split('module.exports=')[0]
config={'provider':'anthropic','model':'claude-sonnet-5','max_tokens':8500,'thinking':{'type':'adaptive'},'reasoning_effort':'medium','prompt_cache':False,'pricing':{'input_mtok':2,'cache_write_mtok':2.5,'cache_read_mtok':.2,'output_mtok':10}}
for wid,manual in [('L8Nn7xncA9ZPDdWA',False),('BMRrGxHyXMcgO6j3',True)]:
 base=json.loads((p/'baseline'/(wid+'.json')).read_text());w=copy.deepcopy(base);ops=[]
 def get(name):return next(n for n in w['nodes'] if n['name']==name)
 def update(name,code):
  get(name)['parameters']['jsCode']=code;ops.append({'type':'updateNode','nodeName':name,'updates':{'parameters.jsCode':code}})
 def edge(source,target,add=True,index=0):
  a=w['connections'].setdefault(source,{'main':[]})['main']
  while len(a)<=index:a.append([])
  if add:a[index].append({'node':target,'type':'main','index':0})
  else:a[index].remove(next(e for e in a[index] if e['node']==target))
  ops.append({'type':'addConnection' if add else 'removeConnection','source':source,'target':target,'sourceIndex':index})
 prefix='MM Manual' if manual else 'MM';build=prefix+' Build Structured Coaching' if manual else 'MM Build Coaching Request';prep=prefix+' Build Factual Audit'
 code=get(build)['parameters']['jsCode'];start=code.rfind('const state=structuredClone($json.state);');assert start>0
 setup='const state=structuredClone($json.state); state.coaching_version=VERSION; state.coaching_model="claude-sonnet-5"; state.coaching_revision="call2-sonnet5-efficiency-2026-09-08"; const input='+('state.input' if manual else 'state.caseItem')+'; const blocks=transcriptBlocks(input.cleaned_transcript); const metadata='+('input' if manual else 'input.metadata')+';'
 if not manual:setup+='await refreshCutoverContext(state);'
 body='const cachedSystem='+json.dumps(common)+'+JSON.stringify({metadata:{rep_name:metadata.rep_name,client_name:metadata.client_name,call_date:metadata.call_date,meeting_title:metadata.meeting_title},transcript_blocks:blocks}); const provider_request={...'+json.dumps(config)+',request_id:state.result_id+"-structured",result_id:state.result_id,case_id:state.case_id||state.caseItem?.case_id,call_purpose:"call2_sonnet5_writer",system:cachedSystem,prompt:'+json.dumps(writer)+'}; return {json:{state,blocks,provider_request}};'
 update(build,code[:start]+setup+body)
 code=get(prep)['parameters']['jsCode'];start=code.rfind('const prepared=$(');assert start>0
 setup='const prepared=$('+json.dumps(build)+').item.json; const generated=$json; if(generated.ok===false||["length","max_tokens"].includes(generated.stop_reason))throw Error("Structured coaching generation failed"); if(generated.request_id!==prepared.provider_request.request_id)throw Error("Coaching source alignment failed"); const analysis=generated.parsed_json; const validated=renderCoaching(analysis,prepared.blocks);'
 if manual:setup+='if(validated.status==="refused")return {json:{...prepared.state.input,state:prepared.state,manual_parsed:validated,skip_safety:true}};'
 else:setup+='if(validated.status!=="completed")throw Error("Coaching eligibility disagrees with completed gate");'
 body='return {json:{...prepared,generated,analysis,skip_safety:false,provider_request:{...'+json.dumps({**config,'max_tokens':12000,'reasoning_effort':'high'})+',request_id:prepared.state.result_id+"-factual-audit",result_id:prepared.state.result_id,case_id:prepared.state.case_id||prepared.state.caseItem?.case_id,call_purpose:"call2_sonnet5_audit",system:prepared.provider_request.system,prompt:'+json.dumps(audit)+'+"\\nUNTRUSTED ANALYSIS:\\n"+JSON.stringify(analysis)}}};'
 update(prep,lib+"\n"+setup+body)
 if manual:
  name='MM Manual Prepare Safety';code=get(name)['parameters']['jsCode'];start=code.rfind('const input = $("Build AI Prompt")');assert start>0
  update(name,code[:start]+'''const input = $("Build AI Prompt").item.json;
const state = {case_id:String(input.public_id||input.report_url||"manual-submit"),result_id:safeId(CUTOVER.agent_version+"-"+(input.public_id||input.report_url||"manual-submit")),input,selectedCard:selectCardId(input),coaching_raw:{},provider_results:[],parsed_status:"pending"};
return {json:{...input,state,skip_safety:false}};''')
  edge('Build AI Prompt','AI Report',False);edge('AI Report',name,False)
  edge(name,'MM Manual If Safety Needed',False);edge('MM Manual If Safety Needed',build,False)
  edge(prep,'MM Manual Factual Audit Provider',False)
  edge('Build AI Prompt',name);edge(name,build);edge(prep,'MM Manual If Safety Needed');edge('MM Manual If Safety Needed','MM Manual Factual Audit Provider')
  # Existing false branch goes directly to refusal parsing. Refused submissions never run the audits or write a report.
  # Retain the disconnected old chain and model for scoped rollback; neither can run from the trigger.
 # One complete high-effort factual review replaces the two repeated reviews.
 review=prefix+' Factual Audit Provider';finish=prefix+' Render Audited Coaching';confirmPrep=prefix+' Build Audit Confirmation'
 edge(review,confirmPrep,False);edge(review,finish)
 final=lib+'\nconst prepared=$('+json.dumps(prep)+').item.json; if($json.ok===false||["length","max_tokens"].includes($json.stop_reason))throw Error("Coaching audit generation failed"); if($json.request_id!==prepared.provider_request.request_id)throw Error("Audit source alignment failed"); const audited=applySingleAudit(prepared.analysis,$json.parsed_json,prepared.blocks); const report=renderCoaching(audited,prepared.blocks,{materialOnly:true,excludePolicyChanges:true});'
 if manual:
  final+='const state=structuredClone(prepared.state); state.parsed_status="completed"; state.coaching_raw={...state.coaching_raw,...report}; state.provider_results.push({purpose:"structured_coaching",result:prepared.generated},{purpose:"coaching_factual_audit",result:$json}); return {json:{...state.input,state}};'
 else:
  final+='const sum=(a,b)=>Object.fromEntries([...new Set([...Object.keys(a||{}),...Object.keys(b||{})])].filter(k=>typeof a?.[k]==="number"||typeof b?.[k]==="number").map(k=>[k,Number(a?.[k]||0)+Number(b?.[k]||0)])); return {json:{...prepared.generated,parsed_json:report,model_text:JSON.stringify(report),costs:sum(prepared.generated.costs,$json.costs),usage:sum(prepared.generated.usage,$json.usage),latency_ms:Number(prepared.generated.latency_ms||0)+Number($json.latency_ms||0),coaching_version:VERSION,factual_audit:{review:$json.parsed_json,revision:"call2-sonnet5-efficiency-2026-09-08"}}};'
 update(finish,final)
 # Match n8n serialization: removed last edges leave no empty source entry.
 w["connections"]={k:v for k,v in w["connections"].items() if any(any(outputs) for outputs in v.values())}
 # Do not touch compliance, shared context, safety/repair, score generation or any business-write node.
 (out/(wid+'.json')).write_text(json.dumps(w,indent=2));(out/(wid+'.operations.json')).write_text(json.dumps({'id':wid,'operations':ops},indent=2))
 print(wid,len(w['nodes']),'nodes;',len(ops),'operations; NOT APPLIED')
