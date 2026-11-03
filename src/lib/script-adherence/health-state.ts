export type HealthInput={enabled:boolean;canary:number;active:number;held:number;errors:number;oldest:string|null;lastCheck:string|null;coverage:string|null;committed:number;ceiling:number;runnerError:boolean;stalled?:boolean;waitingSources?:number;pendingRequests?:number};
export type HealthState={tone:'neutral'|'good'|'waiting'|'attention';label:string;message:string};
export function healthState(s:HealthInput,now=Date.now()):HealthState{
 const stale=(date:string|null,hours:number)=>!date||!Number.isFinite(Date.parse(date))||now-Date.parse(date)>hours*3600000;
 if(s.held||s.errors||s.runnerError||s.stalled)return {tone:'attention',label:'Needs attention',message:'A retained item needs review. Completed results remain available.'};
 if(!s.enabled&&!s.canary&&!s.active)return {tone:'neutral',label:'Paused',message:'Automatic intake is off. Saved results are unchanged.'};
 if(s.committed>=s.ceiling||((s.pendingRequests??0)>0&&s.ceiling-s.committed<500000))return {tone:'attention',label:'Budget limit',message:'New requests are paused at the configured spending ceiling.'};
 if(stale(s.lastCheck,0.75))return {tone:'attention',label:'Check overdue',message:'The batch runner has not confirmed a successful check within 45 minutes.'};
 if(s.active&&stale(s.oldest,26))return {tone:'attention',label:'Batch overdue',message:'A provider batch has exceeded its normal processing window.'};
 if(s.enabled&&stale(s.coverage,36))return {tone:'attention',label:'Coverage overdue',message:'The daily recording scan has not confirmed both workspaces within 36 hours.'};
 if(s.active)return {tone:'waiting',label:'Processing',message:'Provider processing is in progress. Waiting is expected; only reviewed results are published.'};
 if(s.waitingSources)return {tone:'waiting',label:'Waiting for transcripts',message:'Discovered recordings are retained while their complete transcripts become available.'};
 return {tone:'good',label:s.enabled?'Up to date':'Limited test',message:s.enabled?'Recent checks completed without an outstanding fault.':'The limited test runner is responding. Company-wide intake remains off.'};
}
