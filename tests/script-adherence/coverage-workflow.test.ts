import {readFileSync} from 'node:fs';
import {expect,it,vi} from 'vitest';
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const code=(file:string)=>new AsyncFunction('$input','$','$execution',readFileSync(`scripts/script-adherence/${file}.js`,'utf8'));
const account={id:'nTC8wAG7SsijjSRAP3IOng',group:'group',from:'2026-11-01T00:00:00Z',to:'2026-11-03T00:00:00Z'};
const nodes=(window:unknown)=>(name:string)=>({first:()=>({json:name==='Read coverage window'?window:{access_token:'SECRET'}})});
it('prepares one member per loop task and a final coverage receipt without embedding credentials',async()=>{
 const httpRequest=vi.fn().mockResolvedValue({members:[{id:'a',first_name:'A'},{id:'b',first_name:'B'}]});
 const tasks=await code('coverage-tasks').call({helpers:{httpRequest}},null,nodes({accounts:[account],pending:[]}),{id:'run'});
 expect(tasks.map((x:any)=>x.json.kind)).toEqual(['persist','member','member','persist']);
 expect(tasks[3].json.payload).toMatchObject({operation:'finish_scan',members:['a','b']});
 expect(JSON.stringify(tasks)).not.toContain('SECRET');expect(httpRequest).toHaveBeenCalledTimes(1);
});
it('does not produce a completed scan for an empty or repeated group page',async()=>{
 const httpRequest=vi.fn().mockResolvedValue({members:[]});
 await expect(code('coverage-tasks').call({helpers:{httpRequest}},null,nodes({accounts:[account],pending:[]}),{id:'run'})).rejects.toThrow('Empty closer');
 httpRequest.mockResolvedValue({members:[{id:'a'}],next_page_token:'repeat'});
 await expect(code('coverage-tasks').call({helpers:{httpRequest}},null,nodes({accounts:[account],pending:[]}),{id:'run'})).rejects.toThrow('Repeated group');
});
it('persists every recording page, including the empty terminal page, for one closer',async()=>{
 const httpRequest=vi.fn().mockResolvedValueOnce({meetings:[],next_page_token:'page2'}).mockResolvedValueOnce({meetings:[],next_page_token:''});
 const task={kind:'member',account,member:{id:'member'},runId:'run'};
 const pages=await code('coverage-step').call({helpers:{httpRequest}},{first:()=>({json:task})},nodes(null),{});
 expect(pages.map((p:any)=>[p.json.page,p.json.next])).toEqual([['','page2'],['page2','']]);
 expect(pages.every((p:any)=>p.json.operation==='discover')).toBe(true);
 expect(httpRequest.mock.calls.every(([r])=>r.timeout===10000)).toBe(true);
});
it('retains an unavailable pending recording without manufacturing completion',async()=>{
 const task={kind:'pending',account,pending:{meeting_uuid:'/uuid',rep:'Rep'},runId:'run'};
 const pages=await code('coverage-step').call({helpers:{httpRequest:vi.fn().mockRejectedValue(Error('404'))}},{first:()=>({json:task})},nodes(null),{});
 expect(pages[0].json.operation).toBe('pending_checked');expect(pages[0].json.uuid).toBe('/uuid');
});
it('only advances to source processing after the loop has acknowledged every task',()=>{
 const workflow=JSON.parse(readFileSync('scripts/script-adherence/unattended-workflow.json','utf8'));
 expect(workflow.connections['Each coverage task'].main[0][0].node).toBe('Initialize coordinator');
 expect(workflow.connections['Each coverage task'].main[1][0].node).toBe('Read one coverage task');
 expect(workflow.connections['Persist coverage pages'].main[0][0].node).toBe('Each coverage task');
 expect(workflow.nodes.find((n:any)=>n.name==='Each coverage task').parameters.batchSize).toBe(1);
});
it('retains the entire source rather than returning partial segments when the download window is exceeded',async()=>{
 const workflow=JSON.parse(readFileSync('scripts/script-adherence/bounded-worker-workflow.json','utf8'));
 const fn=new AsyncFunction('$','$execution',workflow.nodes.find((n:any)=>n.name==='Download transcript segments').parameters.jsCode);
 const work=[{id:'job',account_id:account.id,files:[{id:'a',url:'https://zoom.us/a'},{id:'b',url:'https://zoom.us/b'}]}];
 const nodes=(name:string)=>name==='Next work batch'?{item:{json:{work}}}:{first:()=>({json:{access_token:'SECRET'}})};
 const clock=vi.spyOn(Date,'now').mockReturnValueOnce(0).mockReturnValueOnce(1).mockReturnValue(41000);
 try{const output=await fn.call({helpers:{httpRequest:vi.fn().mockResolvedValue('WEBVTT')}},nodes,{id:'owner'});expect(output[0].json.files).toEqual([]);expect(output[0].json.error).toContain('retained');}finally{clock.mockRestore();}
});

it('source-only resume cannot clear an unresolved coverage fault, while daily intake still scans',async()=>{
 const workflow=JSON.parse(readFileSync('scripts/script-adherence/unattended-workflow.json','utf8'));
 const init=workflow.nodes.find((n:any)=>n.name==='Initialize coordinator').parameters.jsCode;
 const finish=workflow.nodes.find((n:any)=>n.name==='Start provider processing').parameters.jsonBody;
 for(const sourceOnly of [true,false]){
  const [item]=await new AsyncFunction('$input','$execution',init)({first:()=>({json:{body:{sourceOnly}}})},{id:'run'});
  const payload=new Function('$',`return (${finish.slice(3,-2).trim()});`)(()=>({first:()=>item}));
  expect(payload).toEqual(sourceOnly?{}:{event:'source_success'});
 }
 const schedule=workflow.nodes.find((n:any)=>n.type==='n8n-nodes-base.scheduleTrigger');
 expect(workflow.connections[schedule.name].main[0][0].node).toBe('Read coverage window');
 expect(workflow.nodes.find((n:any)=>n.name==='Scoped verification').parameters.authentication).toBe('headerAuth');
});
