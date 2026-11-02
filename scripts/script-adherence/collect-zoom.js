// n8n Code node. Native OAuth HTTP nodes supply account-scoped tokens.
// Outputs metadata only, never OAuth tokens. Every page is persisted downstream.
const window=$('Read coverage window').first().json;
const tokens={nTC8wAG7SsijjSRAP3IOng:$('Zoom main token').first().json.access_token,ELrPkucySZ2nxcs4fpyAaA:$('Zoom legacy token').first().json.access_token};
const output=[],finishes=[],started=Date.now(),runId=String($execution.id);
const get=async(account,path,query={})=>{
 if(Date.now()-started>600000)throw Error('Coverage scan reached bounded runtime; cursor not advanced');
 const qs=Object.entries(query).filter(([,v])=>v!=='').map(([k,v])=>encodeURIComponent(k)+'='+encodeURIComponent(String(v))).join('&');
 return await this.helpers.httpRequest({method:'GET',url:'https://api.zoom.us/v2'+path+(qs?'?'+qs:''),headers:{Authorization:'Bearer '+tokens[account]},json:true,timeout:30000});
};
function recording(account,meeting,member){
 const files=meeting.recording_files||[],transcripts=files.filter(f=>f.file_type==='TRANSCRIPT'||f.recording_type==='audio_transcript');
 const mediaStarts=[...new Set(files.filter(f=>['MP4','M4A'].includes(f.file_type)).map(f=>f.recording_start).filter(Boolean))];
 const missingSegment=mediaStarts.some(start=>!transcripts.some(f=>f.recording_start===start));
 const settled=Date.parse(meeting.start_time)+Number(meeting.duration||0)*60000<Date.now()-30*60000;
 return {accountId:account,uuid:meeting.uuid,rep:[member.first_name,member.last_name].filter(Boolean).join(' ')||member.email||member.id,title:meeting.topic||'Untitled Zoom meeting',startedAt:meeting.start_time,sourceUrl:meeting.share_url||'',files:transcripts.map(f=>({id:f.id,url:f.download_url,start:f.recording_start||meeting.start_time,ready:!missingSegment&&settled&&f.status==='completed'}))};
}
for(const account of window.accounts){
 if(!tokens[account.id])throw Error('Missing account token');
 const members=[];let token='',seen=new Set();
 do{
  if(seen.has(token))throw Error('Repeated member pagination token');seen.add(token);
  const r=await get(account.id,'/groups/'+encodeURIComponent(account.group)+'/members',{page_size:300,next_page_token:token});
  if(!Array.isArray(r.members))throw Error('Invalid closer group response');members.push(...r.members);token=r.next_page_token||'';
 }while(token);
 if(!members.length)throw Error('Empty closer group; coverage not advanced');
 const unique=[...new Map(members.map(m=>[m.id,m])).values()];
 output.push({json:{operation:'closers',accountId:account.id,members:unique.map(m=>({id:m.id,name:[m.first_name,m.last_name].filter(Boolean).join(' ')||m.email||m.id}))}});
 for(const member of unique){
  token='';seen=new Set();
  do{
   if(seen.has(token))throw Error('Repeated recordings pagination token');seen.add(token);
   const r=await get(account.id,'/users/'+encodeURIComponent(member.id)+'/recordings',{from:account.from.slice(0,10),to:account.to.slice(0,10),page_size:300,next_page_token:token});
   if(!Array.isArray(r.meetings))throw Error('Invalid recording page');
   const meetings=r.meetings.filter(m=>Date.parse(m.start_time)>=Date.parse(account.from)&&Date.parse(m.start_time)<=Date.parse(account.to));
   output.push({json:{operation:'discover',accountId:account.id,runId,memberId:member.id,from:account.from,to:account.to,page:token,next:r.next_page_token||'',recordings:meetings.map(m=>recording(account.id,m,member))}});
   token=r.next_page_token||'';
  }while(token);
 }
 for(const pending of window.pending.filter(p=>p.account_id===account.id)){
  const raw=pending.meeting_uuid,encoded=raw.startsWith('/')||raw.includes('//')?encodeURIComponent(encodeURIComponent(raw)):encodeURIComponent(raw);
  try{
   const meeting=await get(account.id,'/meetings/'+encoded+'/recordings'),member=unique.find(m=>m.id===meeting.host_id)||{id:meeting.host_id,first_name:pending.rep,last_name:''};
   // A removed closer's already-discovered recording remains retained, not silently reassigned.
   if(!member)continue;
   output.push({json:{operation:'discover',accountId:account.id,runId,memberId:'pending:'+raw,from:account.from,to:account.to,page:'',next:'',recordings:[recording(account.id,meeting,member)]}});
  }catch{output.push({json:{operation:'pending_checked',accountId:account.id,uuid:raw,error:'Recording metadata unavailable; retained for retry'}});}
 }
 finishes.push({operation:'finish_scan',accountId:account.id,runId,from:account.from,to:account.to,members:unique.map(m=>m.id)});
}
// Finish receipts run only after ALL discovery pages have been durably acknowledged.
return output.map((v,i)=>({json:{...v.json,...(i===0?{finishRequests:finishes}:{})}}));
