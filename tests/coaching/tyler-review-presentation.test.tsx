import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createRequire} from 'node:module';
import {expect,it,vi} from 'vitest';
import {CoachingReportContent} from '../../src/components/dashboard/coaching-report-content';
const require=createRequire(import.meta.url), c=require('../../src/lib/foundations-contract.cjs'), a=require('../../src/lib/foundations-record.cjs');
vi.mock('@/components/dashboard/transcript-evidence',()=>({TranscriptEvidence:()=>null}));
(globalThis as unknown as {React:typeof React}).React=React;
const blocks=[{id:'T0001',text:'Buyer: I need my wife here. Rep: When can she join?',timestamp:'00:01'},{id:'T0002',text:'Buyer: I will not invest now. Rep: Understood.',timestamp:'00:02'}];
function report(){return {version:c.VERSION,presentation:'tyler-review-v1',summary:'You offered to include his wife. Respect the later refusal rather than forcing another appointment.',status:'completed',exclusion_reason:'',offer_family:'reality',show:'Reality',outcome:{payment:'not_confirmed',text:'The buyer declined to invest now.',evidence_ids:['T0002']},objections:[{id:'O2',title:'Declines investment',category:'cost',exchange:'He declined; the rep respected his decision.',concern:'Not investing now.',response:'Accepted refusal.',handling:'sound',resolution:'unresolved',assessment:'The refusal was clear.',teaching:'',example:'',evidence_ids:['T0002'],counterevidence_ids:[]},{id:'O1',title:'Wife discussion',category:'commitment',exchange:'He wanted his wife present; the rep offered a joint conversation.',concern:'Wants wife present.',response:'Offered a joint call.',handling:'sound',resolution:'unresolved',assessment:'A relevant offer.',teaching:'',example:'',evidence_ids:['T0001'],counterevidence_ids:[]}],lessons:[],focus_id:'',next_steps:[]};}
function candidate(r=report()){return {prepared:a.prepare({sourceId:'fixture',policyRevision:'test',policyText:'Test policy',blocks}),report:r,digest:a.digest(r),writerRequestId:'w',reviewRequestId:'r',safety:null};}
function payload(channel:string){const r=candidate();return a.publish(a.safety(r,{candidateDigest:r.digest,requestId:'SYNTHETIC-UNIT-ONLY',pass:true,unresolvedFindings:[]}),{sourceId:'fixture',channel});}
it('renders source chronology, concise good handling and bottom outcome identically for Docs and dashboard',()=>{
 const r=report(), md=c.render(r,blocks);expect(md.indexOf('Coaching snapshot')).toBeLessThan(md.indexOf('Objections'));expect(md.indexOf('Wife discussion')).toBeLessThan(md.indexOf('Declines investment'));expect(md.endsWith(r.outcome.text)).toBe(true);expect(md).not.toContain('A relevant offer.');expect(md).not.toContain('Next steps');expect(md.match(/Handled well—no further feedback/g)).toHaveLength(2);
 for(const channel of ['official','manual'] as const){const p={...payload(channel),source_airtable_record_id:'fixture'};expect(a.sections(p,'fixture',channel).map((s:{key:string})=>s.key)).toEqual(['summary','objections','outcome']);const html=renderToStaticMarkup(<CoachingReportContent report={{source_payload:p}} reportType={channel} reportId="fixture"/>);expect(html.indexOf('Wife discussion')).toBeLessThan(html.indexOf('Declines investment'));expect(html).not.toContain('Your response');expect(html).not.toContain('Resolution:');expect(html).not.toContain('A relevant offer.');expect(html).toContain('Commitment and Priority concerns');expect(html.indexOf('Coaching snapshot')).toBeLessThan(html.indexOf('Objections and how'));}
});
it('does not silently shorten or reinterpret historical reports',()=>{const r:any=report();delete r.presentation;delete r.summary;r.objections.forEach((o:any)=>{delete o.exchange;o.teaching='Historical positive teaching.';});const md=c.render(r,blocks);expect(md).toContain('Historical positive teaching.');expect(md.indexOf('Declines investment')).toBeLessThan(md.indexOf('Wife discussion'));expect(md.indexOf('Outcome')).toBeLessThan(md.indexOf('Objections'));});
it('holds a reviewer downgrade and rejects forced feedback on sound handling',()=>{const r=report();r.objections[0].teaching='Ask again.';expect(()=>c.validate(r,blocks)).toThrow('Sound handling');const good=report(),old:any=structuredClone(good);delete old.presentation;delete old.summary;old.objections.forEach((o:any)=>delete o.exchange);expect(()=>c.acceptReview(good,{pass:false,findings:[{issue:'Change format',evidence_ids:[]}],corrected_report:old},blocks)).toThrow('presentation revision');});
it('includes every new visible field in atomic safety repair and invalidates prior safety',()=>{let r=candidate();const fixed=a.repair(r,r.digest,[{path:'summary',before:r.report.summary,after:'Corrected summary. Useful next move.'},{path:'objections.0.exchange',before:r.report.objections[0].exchange,after:'A corrected source-grounded exchange.'}]);expect(fixed.safety).toBeNull();expect(()=>a.publish(fixed,{sourceId:'fixture',channel:'manual'})).toThrow('Unreviewed');expect(()=>a.repair(r,r.digest,[{path:'presentation',before:'tyler-review-v1',after:'other'}])).toThrow('Invalid atomic');});
it('preserves handling and unresolved status in analytics metadata',()=>{const r=a.read(payload('official'),'fixture','official').report;expect(r.objections.every((o:any)=>o.handling==='sound'&&o.resolution==='unresolved')).toBe(true);});
it('does not bullet the coaching summary in native documents',()=>{const {docRequests}=require('../../scripts/coaching-foundations/document-format.cjs');const p=payload('official'),s=a.sections(p,'fixture','official'),doc=docRequests(s,[]);const end=doc.text.indexOf('Objections and how');expect(doc.requests.filter((r:any)=>r.createParagraphBullets).every((r:any)=>r.createParagraphBullets.range.startIndex>end)).toBe(true);});

it('safety screens new summary and exchange paths, rather than only old prose fields',()=>{const safety=require('../../scripts/coaching-foundations/safety.cjs');const r=candidate();r.report.summary='You are legally compliant. Keep doing this.';r.report.objections[0].exchange='You are legally compliant.';const fields=safety.fields(r.report).map((x:any)=>x.path);expect(fields).toContain('summary');expect(fields).toContain('objections.0.exchange');expect(safety.signals(r).some((x:any)=>x.path==='summary')).toBe(true);expect(safety.signals(r).some((x:any)=>x.path==='objections.0.exchange')).toBe(true);});

it('replaces the contradictory exact-date instruction without erasing real commitments',()=>{const {reconcileNextSteps}=require('../../scripts/coaching-foundations/lesson-selection.cjs');const old='An absent date, proposed follow-up or missing agreement belongs in a recommended step, never an agreed step.';const revised=reconcileNextSteps('Before. '+old+' After.');expect(revised).not.toContain(old);expect(revised).toContain('not an exact calendar date');expect(revised).toContain('one-sided explicit commitment is promised');expect(revised).toMatch(/^Before\./);expect(revised.endsWith('After.')).toBe(true);});

it('identifies the exact missing teaching field so bounded repair cannot mistake assessment for it',()=>{const r=report();r.objections[0].handling='needs_work';r.objections[0].assessment='A supported assessment and suggested action.';r.objections[0].example='Illustrative words.';expect(()=>c.validate(r,blocks)).toThrow('objection O2 has empty teaching');});

it('fails closed on missing or duplicated pinned reasoning instructions',()=>{
 const {reconcileConcerns,reconcileNextSteps}=require('../../scripts/coaching-foundations/lesson-selection.cjs');
 const concern='An objection is actual resistance or a material unresolved concern, not every question.';
 const next='An absent date, proposed follow-up or missing agreement belongs in a recommended step, never an agreed step.';
 for(const [fn,text] of [[reconcileConcerns,concern],[reconcileNextSteps,next]]){
  expect(()=>fn('Unrecognized upstream wording')).toThrow('Expected one pinned');
  expect(()=>fn(text+'\n'+text)).toThrow('Expected one pinned');
  const revised=fn('Before. '+text+' After.');
  expect(revised).not.toContain(text);expect(revised.startsWith('Before. ')).toBe(true);expect(revised.endsWith(' After.')).toBe(true);
 }
});

it('v2 renders a fixed takeaway heading and numbered source-order objections while preserving safety',()=>{
 const r=report();r.presentation='tyler-review-v2';r.summary='Make the next conversation count\nInclude the decision partner while respecting a later refusal.';
 r.objections[1].exchange='He wanted his wife present.\n\nThe rep offered a joint conversation.';
 c.validate(r,blocks);
 expect(c.render(r,blocks)).toContain('### 1. Wife discussion');expect(c.render(r,blocks)).toContain('### 2. Declines investment');
 const x=candidate(r),p=a.publish(a.safety(x,{candidateDigest:x.digest,requestId:'SYNTHETIC-UNIT-ONLY',pass:true,unresolvedFindings:[]}),{sourceId:'fixture',channel:'official'});
 const html=renderToStaticMarkup(<CoachingReportContent report={{source_payload:{...p,source_airtable_record_id:"fixture"}}} reportType="official" reportId="fixture"/>);
 expect(html).toContain('1. Wife discussion');expect(html).toContain('Make the next conversation count');expect(html).toContain('whitespace-pre-line');
 expect(require('../../scripts/coaching-foundations/safety.cjs').fields(r).map((f:{path:string})=>f.path)).toContain('summary');
 expect(()=>c.validate({...r,summary:'A clear takeaway.'},blocks)).not.toThrow();
 expect(()=>c.validate({...r,summary:'one\ntwo\nthree'},blocks)).toThrow('Takeaway requires');
 expect(html).toContain('>Key takeaway</h2>');
 expect(html).not.toContain('>Make the next conversation count</h2>');
 const repaired=a.repair(x,x.digest,[{path:'summary',before:r.summary,after:'A grounded hook\nA grounded subheadline.'}]);expect(repaired.safety).toBeNull();
 expect(()=>a.publish(repaired,{sourceId:'fixture',channel:'official'})).toThrow('Unreviewed');
 expect(()=>c.acceptReview(r,{pass:false,findings:[{issue:'downgrade',evidence_ids:[]}],corrected_report:report()},blocks)).toThrow('presentation revision');
});

it('v2 puts every improvement before strengths across reasoning layers without dropping reviewed text',()=>{
 const r:any=report();r.presentation='tyler-review-v2';r.summary='A useful decision conversation\nClarify the decision without inventing urgency.';
 r.lessons=[
  {id:'L1',title:'Keep the relevant invitation',purpose:'repeat',layer:'interpretation',observation:'The invitation matched the stated need.',teaching:'Include the actual decision partner.',example:'',evidence_ids:['T0001'],counterevidence_ids:[]},
  {id:'L2',title:'Respect the changed decision',purpose:'refine',layer:'strategy',observation:'The later refusal superseded the earlier opportunity.',teaching:'Use the latest buyer decision to choose the next move.',example:'',evidence_ids:['T0002'],counterevidence_ids:[]},
  {id:'L3',title:'Explore the underlying value',purpose:'explore',layer:'foundations',observation:'The early request provided an opportunity to understand shared value.',teaching:'Explore what the decision partner would need to understand.',example:'',evidence_ids:['T0001'],counterevidence_ids:[]},
 ];
 r.objections[0].handling='needs_work';r.objections[0].teaching='A separate practical move.';r.objections[0].example='A distinct illustrative sentence.';
 r.next_steps=[{kind:'promised',text:'Send the requested information.',evidence_ids:['T0001']}];
 const md=c.render(r,blocks),before=JSON.stringify(r);
 expect(md.indexOf('Explore the underlying value')).toBeLessThan(md.indexOf('What worked'));
 expect(md.indexOf('What to improve')).toBeLessThan(md.indexOf('What worked'));
 expect(md).toContain('**Improvement:** The refusal was clear.\n\nA separate practical move.\n\n**For example:** A distinct illustrative sentence.');
 for(const channel of ['official','manual'] as const){
  const x=candidate(r),p=a.publish(a.safety(x,{candidateDigest:x.digest,requestId:'SYNTHETIC-UNIT-ONLY',pass:true,unresolvedFindings:[]}),{sourceId:'fixture',channel});
  const sections=a.sections(p,'fixture',channel),keys=sections.map((s:any)=>s.key);
  expect(new Set(keys).size).toBe(keys.length);expect(keys).toEqual(['summary','objections','takeaways','strengths','next-steps','outcome']);
  const html=renderToStaticMarkup(<CoachingReportContent report={{source_payload:{...p,source_airtable_record_id:'fixture'}}} reportType={channel} reportId="fixture"/>);
  expect(html.indexOf('Explore the underlying value')).toBeLessThan(html.indexOf('Keep the relevant invitation'));
  for(const lesson of r.lessons)for(const field of ['title','observation','teaching'])expect(html).toContain(lesson[field]);
  expect(html).toContain('Send the requested information.');expect(html).toContain('A separate practical move.</p><p>');
  const doc=require('../../scripts/coaching-foundations/document-format.cjs').docRequests(sections,[]);
  expect(doc.text.indexOf('Explore the underlying value')).toBeLessThan(doc.text.indexOf('Keep the relevant invitation'));
  expect(p.reviewed_coaching_v3.digest).toBe(a.digest(r));
 }
 expect(JSON.stringify(r)).toBe(before);
 r.presentation='tyler-review-v1';expect(c.render(r,blocks)).toContain('Reading the buyer');expect(c.render(r,blocks)).not.toContain('## What worked');
});
