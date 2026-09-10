import {describe,it,expect} from 'vitest';
import {coachingSections,coachingClose,coachingEvidence} from '../../src/lib/coaching-presentation';
import {resolveCloseSection} from '../../src/lib/close-section';
describe('coaching display contract',()=>{
 it('shows a complete improvement once without repeating its action',()=>{
 const action='Confirm the purpose of your next call.';
 const full='You booked a follow-up. [00:12:34.840]\nPossible effect: The next call may lack a goal.\nBetter action: '+action;
 const sections=coachingSections({what_id_polish:full,what_to_improve:'1. '+full,coaching_tip:action,rudys_note:action});
 expect(sections).toEqual([{key:'improvements',title:'What to improve',items:[full]}]);
 });
 it('preserves distinct additional advice and all material improvements',()=>{
 const s=coachingSections({what_to_improve:'1. First issue.\nBetter action: Ask.\n\n2. Second issue.\nBetter action: Listen.',coaching_tip:'Another distinct useful action.'});
 expect(s[0].items).toHaveLength(2);expect(s[1].items).toEqual(['Another distinct useful action.']);
 });
 it('does not repeat closing strengths already displayed and retains outcome evidence',()=>{
 const s=coachingSections({one_line_verdict:'You confirmed payment.',biggest_strength:'You clarified the question. [00:01:00.000]',what_went_well:'1. You clarified the question. [00:01:00.000]',what_made_this_close_work:'You confirmed payment. [00:02:00.000]\n\n1. You clarified the question. [00:01:00.000]'});
 expect(s.map(x=>x.key)).toEqual(['outcome','strengths']);expect(s[0].items[0]).toContain('[00:02:00.000]');
 });
 it('keeps the no-payment explanation in each display',()=>{
 const r={why_no_close:'You agreed a follow-up; payment remains pending.',what_made_this_close_work:'No completed payment was confirmed on this call.'};
 expect(coachingClose(r).text).toBe(r.why_no_close);
 expect(resolveCloseSection({whyNoClose:r.why_no_close,closeWorks:r.what_made_this_close_work}).type).toBe('why_no_close');
 });
 it('selects confirmed closing content over not-applicable text',()=>{
 expect(coachingClose({why_no_close:'Not applicable: payment was confirmed on this call.',what_made_this_close_work:'You confirmed the payment and organized onboarding.'}).title).toBe('What helped you close');
 });
 it('preserves legacy object sections and empty content safely',()=>{
 expect(coachingClose({why_no_close:{root_cause:'Pending review'}}).text).toContain('Pending review');
 expect(coachingSections({})).toEqual([]);
 });
 it('separates exact transcript references without changing numbers or quoted text',()=>{
 expect(coachingEvidence('You clarified the $2,000 payment. [00:12:34.840, 00:14:43.660]')).toEqual({text:'You clarified the $2,000 payment.',evidence:['00:12:34','00:14:43']});
 });
});

describe('closing duplication after downstream repair',()=>{
 for(const newline of ['\n','\n\n','\r\n'])it(`removes copied outcome and multiple numbered strengths with ${JSON.stringify(newline)}`,()=>{
  const a='You personalized the story. [00:01:00.100] This made it relevant.';
  const b='You resolved the payment obstacle. [00:02:00.200] This maintained momentum.';
  const outcome='You confirmed payment.';
  const report={one_line_verdict:outcome,what_went_well:`1. ${a}${newline}2. ${b}`,what_made_this_close_work:`${outcome} [00:03:00.300]${newline}1. ${a}${newline}2. ${b}`};
  const before=JSON.stringify(report);const sections=coachingSections(report);
  expect(sections.map(s=>s.key)).toEqual(['outcome','strengths']);
  expect(sections[0].items[0]).toContain('[00:03:00.300]');expect(sections[1].items).toHaveLength(2);expect(JSON.stringify(report)).toBe(before);
 });
 it('retains a unique closing action and its evidence alongside copied strengths',()=>{
  const s=coachingSections({one_line_verdict:'Payment confirmed.',what_went_well:'You tailored the pitch.',what_made_this_close_work:'Payment confirmed. [00:01:00.000]\n1. You tailored the pitch.\n2. You confirmed the onboarding owner. [00:02:00.000]'});
  expect(s.find(s=>s.key==='close')?.items).toEqual(['You confirmed the onboarding owner. [00:02:00.000]']);
 });
 it('preserves unnumbered multiline unpaid explanation and distinct advice',()=>{
  const text='Payment remains pending.\nObserved concerns:\n1. Buyer requested review.\nAgreed next steps:\n1. Follow up Friday. [00:05:00.000]';
  const sections=coachingSections({one_line_verdict:'Buyer will review.',why_no_close:text});
  expect(sections.find(s=>s.key==='close')?.items.join(' ')).toContain('Follow up Friday. [00:05:00.000]');
 });
});
