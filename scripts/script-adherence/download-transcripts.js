const work=$('Next work batch').item.json.work;
const tokens={nTC8wAG7SsijjSRAP3IOng:$('Zoom main token').first().json.access_token,ELrPkucySZ2nxcs4fpyAaA:$('Zoom legacy token').first().json.access_token};
const owner=String($execution.id);
return await Promise.all(work.map(async job=>{
 const files=[];
 try{
  if(!tokens[job.account_id])throw Error('Missing account');
  for(const file of job.files){
   if(!/^https:\/\/(?:[a-z0-9-]+\.)*zoom\.us(?::443)?\//i.test(file.url))throw Error('Invalid source URL');
   const vtt=await this.helpers.httpRequest({method:'GET',url:file.url,headers:{Authorization:'Bearer '+tokens[job.account_id]},returnFullResponse:false,json:false,timeout:60000});
   if(typeof vtt!=='string'||vtt.length>250000)throw Error('Invalid transcript body');files.push({id:file.id,vtt});
  }
  return {json:{operation:'source',id:job.id,owner,files}};
 }catch{return {json:{operation:'source',id:job.id,owner,files:[],error:'Transcript download failed; retained for retry'}};}
}));
