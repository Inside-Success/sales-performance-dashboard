// Runs once: only group pagination, never every closer's recordings.
const window=$('Read coverage window').first().json;
const tokens={nTC8wAG7SsijjSRAP3IOng:$('Zoom main token').first().json.access_token,ELrPkucySZ2nxcs4fpyAaA:$('Zoom legacy token').first().json.access_token};
const tasks=[],started=Date.now(),runId=String($execution.id);
for(const account of window.accounts){
 const members=[];let token='';const seen=new Set();
 do{
  if(Date.now()-started>35000)throw Error('Group pagination reached bounded runtime; coverage retained');
  if(seen.has(token))throw Error('Repeated group pagination token');seen.add(token);
  const r=await this.helpers.httpRequest({method:'GET',url:'https://api.zoom.us/v2/groups/'+encodeURIComponent(account.group)+'/members',qs:{page_size:300,next_page_token:token},headers:{Authorization:'Bearer '+tokens[account.id]},json:true,timeout:10000});
  if(!Array.isArray(r.members))throw Error('Invalid closer group');members.push(...r.members);token=r.next_page_token||'';
 }while(token);
 const unique=[...new Map(members.map(m=>[m.id,m])).values()];if(!unique.length)throw Error('Empty closer group; coverage not advanced');
 tasks.push({json:{kind:'persist',payload:{operation:'closers',accountId:account.id,members:unique.map(m=>({id:m.id,name:[m.first_name,m.last_name].filter(Boolean).join(' ')||m.email||m.id}))}}});
 for(const member of unique)tasks.push({json:{kind:'member',account,member,runId}});
 for(const pending of window.pending.filter(p=>p.account_id===account.id))tasks.push({json:{kind:'pending',account,pending,runId}});
 // The loop reaches this receipt only after every earlier page was acknowledged.
 tasks.push({json:{kind:'persist',payload:{operation:'finish_scan',accountId:account.id,runId,from:account.from,to:account.to,members:unique.map(m=>m.id)}}});
}
return tasks;
