// One loop item per Code invocation avoids the shared 60-second task limit.
const task=$input.first().json;if(task.kind==='persist')return [{json:task.payload}];
const account=task.account,runId=task.runId,started=Date.now();
const tokens={nTC8wAG7SsijjSRAP3IOng:$('Zoom main token').first().json.access_token,ELrPkucySZ2nxcs4fpyAaA:$('Zoom legacy token').first().json.access_token};
const get=async(path,query={})=>{if(Date.now()-started>35000)throw Error('Member pagination reached bounded runtime; coverage not advanced');return await this.helpers.httpRequest({method:'GET',url:'https://api.zoom.us/v2'+path,qs:query,headers:{Authorization:'Bearer '+tokens[account.id]},json:true,timeout:10000});};
function recording(account,meeting,member){
 const files=meeting.recording_files||[],transcripts=files.filter(f=>f.file_type==='TRANSCRIPT'||f.recording_type==='audio_transcript');
 const mediaStarts=[...new Set(files.filter(f=>['MP4','M4A'].includes(f.file_type)).map(f=>f.recording_start).filter(Boolean))];
 const missingSegment=mediaStarts.some(start=>!transcripts.some(f=>f.recording_start===start));
 const settled=Date.parse(meeting.start_time)+Number(meeting.duration||0)*60000<Date.now()-30*60000;
 return {accountId:account,uuid:meeting.uuid,rep:[member.first_name,member.last_name].filter(Boolean).join(' ')||member.email||member.id,title:meeting.topic||'Untitled Zoom meeting',startedAt:meeting.start_time,sourceUrl:meeting.share_url||'',files:transcripts.map(f=>({id:f.id,url:f.download_url,start:f.recording_start||meeting.start_time,ready:!missingSegment&&settled&&f.status==='completed'}))};
}

if(task.kind==='pending'){
 const p=task.pending,raw=p.meeting_uuid,encoded=raw.startsWith('/')||raw.includes('//')?encodeURIComponent(encodeURIComponent(raw)):encodeURIComponent(raw);
 try{const m=await get('/meetings/'+encoded+'/recordings');return [{json:{operation:'discover',accountId:account.id,runId,memberId:'pending:'+raw,from:account.from,to:account.to,page:'',next:'',recordings:[recording(account.id,m,{id:m.host_id,first_name:p.rep,last_name:''})]}}];}
 catch{return [{json:{operation:'pending_checked',accountId:account.id,uuid:raw,error:'Recording metadata unavailable; retained for retry'}}];}
}
if(task.kind!=='member')throw Error('Unknown coverage task');
const output=[],seen=new Set();let token='';
do{
 if(seen.has(token))throw Error('Repeated recordings pagination token');seen.add(token);
 const r=await get('/users/'+encodeURIComponent(task.member.id)+'/recordings',{from:account.from.slice(0,10),to:account.to.slice(0,10),page_size:300,next_page_token:token});
 if(!Array.isArray(r.meetings))throw Error('Invalid recording page');
 output.push({json:{operation:'discover',accountId:account.id,runId,memberId:task.member.id,from:account.from,to:account.to,page:token,next:r.next_page_token||'',recordings:r.meetings.filter(m=>Date.parse(m.start_time)>=Date.parse(account.from)&&Date.parse(m.start_time)<=Date.parse(account.to)).map(m=>recording(account.id,m,task.member))}});
 token=r.next_page_token||'';
}while(token);
return output;
