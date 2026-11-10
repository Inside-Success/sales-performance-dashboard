"""Add only source monitoring to an exact live coordinator snapshot; no schedule edits."""
import copy,json,sys
from pathlib import Path
w=json.loads(Path(sys.argv[1]).read_text())
assert not any(n['name']=='Script source list' for n in w['nodes'])
base=next(n for n in w['nodes'] if n['name']=='Read coverage window')
manifest=json.loads(Path('src/lib/script-adherence/source-manifest.json').read_text())
listing={'id':'adherence-script-source-list','name':'Script source list','type':'n8n-nodes-base.code','typeVersion':2,'position':[600,-400],'parameters':{'jsCode':'return '+json.dumps([{'json':{'documentId':s['documentId']},'pairedItem':{'item':0}} for s in manifest])+';'}}
read={'id':'adherence-read-script-source','name':'Read script source','type':'n8n-nodes-base.httpRequest','typeVersion':4.5,'position':[850,-400],'parameters':{'url':"=https://docs.googleapis.com/v1/documents/{{ $json.documentId }}?includeTabsContent=true&suggestionsViewMode=PREVIEW_WITHOUT_SUGGESTIONS",'authentication':'predefinedCredentialType','nodeCredentialType':'googleDocsOAuth2Api','options':{'timeout':20000}},'credentials':{'googleDocsOAuth2Api':{'id':'cKUAWmLGskh7kIOm','name':'Syed Moonis Haider google doc'}},'retryOnFail':True,'maxTries':2,'waitBetweenTries':1000,'onError':'continueErrorOutput'}
record=copy.deepcopy(base);record.update(id='adherence-record-script-check',name='Record script check',position=[1100,-400]);record['parameters']['jsonBody']="={{ {operation:'script_source',documentId:$('Script source list').item.json.documentId,document:$json} }}"
# One idempotent status write handles a success or failed Google read. API does
# not promote rules, change calls or submit AI. Failure leaves stale owner status.
record['onError']='continueRegularOutput'
w['nodes'] += [listing,read,record]
w['connections']['Read coverage window']['main'][0].append({'node':listing['name'],'type':'main','index':0})
w['connections'][listing['name']]={'main':[[{'node':read['name'],'type':'main','index':0}]]}
w['connections'][read['name']]={'main':[[{'node':record['name'],'type':'main','index':0}],[{'node':record['name'],'type':'main','index':0}]]}
Path(sys.argv[2]).write_text(json.dumps(w,indent=2)+'\n')
