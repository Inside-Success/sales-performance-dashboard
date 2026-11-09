import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createRequire} from 'node:module';
import {expect,it,vi} from 'vitest';
import {normalizeIngestPayload} from '../../src/lib/ingest';
import {normalizeManualCallback} from '../../src/lib/manual-reports';
import {buildReportChatMessages,buildManualReportChatMessages} from '../../src/lib/report-chat';
import {CoachingReportContent} from '../../src/components/dashboard/coaching-report-content';
import type {PerformanceCall,ManualFeedbackReport} from '../../src/lib/types';
const require=createRequire(import.meta.url),a=require('../../src/lib/foundations-record.cjs');
vi.mock('@/components/dashboard/transcript-evidence',()=>({TranscriptEvidence:()=>null}));
(globalThis as unknown as {React:typeof React}).React=React;
function payload(channel:'manual'|'official'){
 const prepared=a.prepare({sourceId:'source-fixture',policyRevision:'fixture',policyText:'GOVERNED FIXTURE POLICY',blocks:[{id:'T0001',text:'Please check and send it tomorrow.',timestamp:'00:01'}]});
 const report={version:'coaching-foundations-v3',status:'completed',exclusion_reason:'',offer_family:'reality',show:'Reality show',outcome:{payment:'not_confirmed',text:'No payment confirmed.',evidence_ids:['T0001']},objections:[{id:'O1',title:'Needs a check',category:'practical',concern:'Wants a confirmed answer.',response:'You agreed to check.',handling:'sound',resolution:'unresolved',assessment:'You left the answer open.',teaching:'Verify before promising.',example:'',evidence_ids:['T0001'],counterevidence_ids:[]}],lessons:[{id:'L1',purpose:'repeat',title:'Give a clear next step',observation:'You agreed when to return.',teaching:'Make the next decision concrete.',example:'',evidence_ids:['T0001'],counterevidence_ids:[]}],focus_id:'O1',next_steps:[{kind:'promised',text:'Send the answer tomorrow.',evidence_ids:['T0001']}]};
 const response=(request_id:string,parsed_json:unknown)=>({ok:true,request_id,provider_response_id:'test-'+request_id,parsed_json,stop_reason:'stop'});
 const c=a.accept({prepared,draftResponse:response('writer',report),draftRequestId:'writer',reviewResponse:response('review',{pass:true,findings:[],corrected_report:null}),reviewRequestId:'review'});
 return {...a.publish(a.safety(c,{candidateDigest:c.digest,requestId:'SYNTHETIC-TEST-ONLY',pass:true,unresolvedFindings:[]}),{sourceId:prepared.sourceId,channel}),source_airtable_record_id:'source-fixture'};
}
it.each(['official','manual'] as const)('preserves the same reviewed teaching in %s ingestion, display and chat',channel=>{
 const p=payload(channel),report={id:1,public_id:'source-fixture',source_payload:p,rep_name:'Rep fixture',client_name:'Buyer fixture'};
 if(channel==='official')expect(normalizeIngestPayload({...p,call_status:'scored'}).source_payload).toBeTruthy();
 else expect(normalizeManualCallback({...p,public_id:'source-fixture',status:'completed'}).source_payload).toBeTruthy();
 const html=renderToStaticMarkup(<CoachingReportContent report={{source_payload:p}} reportId='source-fixture' reportType={channel}/>);
 expect(html.indexOf('Objections and how')).toBeLessThan(html.indexOf('What to carry'));
 expect(html).toContain('Verify before promising.');expect(html).toContain('Promised:');expect(html).not.toContain('T0001');expect(html).not.toContain('SYNTHETIC-TEST-ONLY');
 const messages=channel==='official'?buildReportChatMessages(report as unknown as PerformanceCall,'FULL SOURCE',[]):buildManualReportChatMessages(report as unknown as ManualFeedbackReport,'FULL SOURCE',[]);
 const context=messages.map(m=>m.content).join('\n');expect(context).toContain('Verify before promising.');expect(context).toContain('GOVERNED FIXTURE POLICY');expect(context).toContain('FULL SOURCE');
});
it('rejects stale or cross-source official and manual callbacks',()=>{
 const p=payload('official');expect(()=>normalizeIngestPayload({...p,call_status:'scored',source_airtable_record_id:'other'})).toThrow();
 expect(()=>normalizeManualCallback({...p,public_id:'source-fixture',status:'completed'})).toThrow();
 p.reviewed_coaching_v3.report.outcome.text='Different candidate';expect(()=>normalizeIngestPayload({...p,call_status:'scored'})).toThrow();
});
it('matches standard SHA256 after unicode and object key normalization',()=>{const {createHash}=require('node:crypto'),{canonical,digest}=require('../../src/lib/coaching-canonical.cjs');for(const v of [{b:'🙂',a:'é'},'a'.repeat(1000),[]])expect(digest(v)).toBe(createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex'));});

it('counts observed concerns without inventing absence coverage or legacy themes',async()=>{
 const {summarizeCoachingInsights}=await import('../../src/lib/coaching-insights');
 const p=payload('official');const call={id:'1',rep_name:'Fixture',rep_slug:'fixture',client_name:'Buyer',call_date:null,one_line_verdict:null,what_to_improve:[],objections_surfaced:[],source_payload:p,source_id:'source-fixture',report_type:'official' as const};
 const result=summarizeCoachingInsights([call,call]);
 expect(result.total).toBe(0);expect(result.enhanced.total).toBe(1);expect(result.enhanced.coverageUnassessed).toBe(1);expect(result.enhanced.noObjections).toBe(0);expect(result.enhanced.categories[0].handledWell).toBe(1);
});

it('renders the actual manual report page with foundations sections, without legacy duplicates',async()=>{
 const {ManualReportStatus}=await import('../../src/components/dashboard/manual-report-status');
 const p=payload('manual');
 const report={public_id:'source-fixture',input_type:'transcript',status:'completed',source_payload:p,rep_name:'Fixture rep',client_name:'Fixture buyer',what_went_well:[],what_to_improve:[],objections_surfaced:[],why_no_close:null,what_made_this_close_work:null} as unknown as ManualFeedbackReport;
 const html=renderToStaticMarkup(<ManualReportStatus initialReport={report}/>);
 expect(html).toContain('Objections and how');expect(html).toContain('Verify before promising.');
 expect(html).not.toContain('Biggest Strength');expect(html).not.toContain('Rudy&#x27;s Note');
});
it('reads the exact bound transcript without depending on public Google sharing',async()=>{
 const {fetchManualTranscriptText}=await import('../../src/lib/report-chat');
 const p=payload('manual');const report={public_id:'source-fixture',source_payload:p,transcript_link:'https://docs.google.com/document/d/private-doc/edit'} as unknown as ManualFeedbackReport;
 expect(await fetchManualTranscriptText(report)).toEqual({text:'[00:01] Please check and send it tomorrow.',source:'reviewed_source_snapshot'});
 p.reviewed_coaching_v3.source_blocks[0].text='Different transcript';
 await expect(fetchManualTranscriptText(report)).rejects.toThrow('Invalid bound transcript');
});
