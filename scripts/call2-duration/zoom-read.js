// n8n Code node following the workspace-specific Zoom OAuth node.
// The authenticated pilot launcher supplies a meeting occurrence UUID.
try {
const { uuid } = $('Pilot request').first().json.body;
if (typeof uuid !== 'string' || !/^[a-zA-Z0-9+/=]{16,40}$/.test(uuid)) throw Error('Invalid occurrence');
const encoded = encodeURIComponent(uuid);
const key = uuid.startsWith('/') || uuid.includes('//') ? encodeURIComponent(encoded) : encoded;
const headers = {Authorization: 'Bearer ' + $input.first().json.access_token};
const read = async (path, qs = {}) => {
  try { return await this.helpers.httpRequest({method:'GET',url:'https://api.zoom.us/v2/'+path,headers,qs,json:true}); }
  catch (error) { throw Error(path.split('/')[0] + ' ' + String(error.message).slice(0,100)); }
};
let meeting;
try { meeting = await read('report/meetings/'+key); }
catch { try { meeting = await read('past_meetings/'+key); } catch { meeting = null; } }
const recording = await read('meetings/'+key+'/recordings');
if ((meeting && meeting.uuid !== uuid) || recording.uuid !== uuid) throw Error('Recording occurrence mismatch');
const sessions = [];
let cursor = '';
do {
  const page = await read('report/meetings/'+key+'/participants',{page_size:300,...(cursor ? {next_page_token:cursor} : {})});
  for (const p of page.participants) sessions.push({name:p.name,email:p.user_email,join:p.join_time,leave:p.leave_time});
  cursor = page.next_page_token;
} while (cursor);
const fileId = $('Pilot request').first().json.body.file;
const file = recording.recording_files.find(f=>f.id===fileId && f.file_type==='TRANSCRIPT');
let transcript;
if (file) {
  if (!/^https:\/\/(?:[a-zA-Z0-9-]+\.)*zoom\.us\//.test(file.download_url)) throw Error('Unexpected transcript location');
  transcript = await this.helpers.httpRequest({method:'GET',url:file.download_url,headers});
}
return [{json:{uuid,transcript,start:meeting?.start_time,end:meeting?.end_time,sessions,
  files:recording.recording_files.map(f=>({id:f.id,type:f.file_type,start:f.recording_start,end:f.recording_end,url:f.play_url,kind:f.recording_type}))}}];

} catch (error) { return [{json:{problem:error.message}}]; }
