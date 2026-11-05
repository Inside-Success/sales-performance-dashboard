"""Add the read-only archive branch to an exported current worker, preserving live wiring."""
import copy,json,pathlib,sys,uuid
src,dest=sys.argv[1:]
w=json.loads(pathlib.Path(src).read_text());nodes={n['name']:n for n in w['nodes']}
assert 'Read transcript archive' not in nodes
nodes['Work type']['parameters'].update(numberOutputs=5,output="={{ ({source:0,openai:1,anthropic:2,done:3,archive:4})[$json.kind] }}")
def node(name,typ,parameters,credentials=None):
 n={'name':name,'id':str(uuid.uuid4()),'type':'n8n-nodes-base.'+typ,'typeVersion':4.5 if typ=='httpRequest' else 3.2 if typ=='switch' else 2,'position':[1100,1000+len(w['nodes'])*80],'parameters':parameters}
 if credentials:n['credentials']=credentials
 w['nodes'].append(n);return n
def edge(a,b,index=0):
 outputs=w['connections'].setdefault(a,{'main':[]})['main']
 while len(outputs)<=index:outputs.append([])
 outputs[index].append({'node':b,'type':'main','index':0})
lookup=node('Read transcript archive','httpRequest',{'method':'GET','url':"={{ 'https://api.airtable.com/v0/appNIvRt5uouRrcZ6/tblD1VHKC49agh9QZ?pageSize=100&filterByFormula=' + encodeURIComponent('OR(' + $json.work.map(j => '{Zoom Meeting UUID}=' + JSON.stringify(j.meeting_uuid)).join(',') + ')') }}",'authentication':'predefinedCredentialType','nodeCredentialType':'airtableTokenApi','options':{'timeout':30000}},{'airtableTokenApi':{'id':'jzyRlXOdp1z6G1s8','name':'Airtable - Zoom Sales Calls'}})
lookup['onError']='continueRegularOutput'
check=copy.deepcopy(nodes['Save complete transcripts']);check.update(name='Match archive records',id=str(uuid.uuid4()),position=[1400,1500]);check['parameters']['jsonBody']="={{ {operation:'archive_lookup',owner:String($execution.id),ids:$('Next work batch').item.json.work.map(j=>j.id),records:Array.isArray($json.records)?$json.records:[],incomplete:!!$json.offset||!!$json.error||!Array.isArray($json.records)} }}";w['nodes'].append(check)
node('Archive work type','switch',{'mode':'expression','numberOutputs':2,'output':"={{ $json.kind === 'documents' ? 0 : 1 }}"})
node('Archive document requests','code',{'jsCode':"return $input.first().json.work.map(j=>({json:j,pairedItem:{item:0}}));"})
docs=node('Read archived Google Doc','httpRequest',{'method':'GET','url':"={{ 'https://docs.googleapis.com/v1/documents/' + $json.record.docId + '?includeTabsContent=true' }}",'authentication':'predefinedCredentialType','nodeCredentialType':'googleDocsOAuth2Api','options':{'timeout':20000,'batching':{'batch':{'batchSize':3,'batchInterval':100}}}},{'googleDocsOAuth2Api':{'id':'cKUAWmLGskh7kIOm','name':'Syed Moonis Haider google doc'}});docs['onError']='continueRegularOutput'
node('Archive document receipts','code',{'jsCode':pathlib.Path('scripts/script-adherence/archive-document-receipts.js').read_text()})
save=copy.deepcopy(nodes['Save complete transcripts']);save.update(name='Save archived transcripts',id=str(uuid.uuid4()),position=[2200,1500]);w['nodes'].append(save)
for a,b,i in [('Work type','Read transcript archive',4),('Read transcript archive','Match archive records',0),('Match archive records','Archive work type',0),('Archive work type','Archive document requests',0),('Archive work type','Continue within time budget',1),('Archive document requests','Read archived Google Doc',0),('Read archived Google Doc','Archive document receipts',0),('Archive document receipts','Save archived transcripts',0),('Save archived transcripts','Continue within time budget',0)]:edge(a,b,i)
pathlib.Path(dest).write_text(json.dumps(w,indent=2)+'\n')
