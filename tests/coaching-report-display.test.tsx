import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect,it,vi } from "vitest";
import { CoachingImprovement } from "@/components/dashboard/coaching-improvement";
import { CoachingReportContent } from "@/components/dashboard/coaching-report-content";
vi.mock("@/components/dashboard/transcript-evidence",()=>({TranscriptEvidence:()=>null}));
(globalThis as unknown as {React:typeof React}).React=React;
it("keeps the action visible and labels expandable explanations clearly",()=>{const html=renderToStaticMarkup(<CoachingImprovement text={'You moved past a direct question.\nWhy it matters: The concern remained unresolved.\nNext time: Answer the question before returning to payment.'}/>);expect(html).toContain('Show explanation');expect(html).toContain('Answer the question before returning to payment.');expect(html).toContain('<details');expect(html).not.toContain('<details open');});
it("can restore always-visible explanations using the same content",()=>{const html=renderToStaticMarkup(<CoachingImprovement expanded text={'Observation\nNext time: Action'}/>);expect(html).toContain('Observation');expect(html).toContain('Action');expect(html).not.toContain('<details');});

it("keeps evidence inside the corresponding explanation",()=>{const html=renderToStaticMarkup(<CoachingImprovement text={'Focus: Confirm the follow-up\nThe date was not confirmed.\nWhy it matters: Timing may be unclear.\nNext time: Confirm the date.'}><span>Transcript evidence fixture</span></CoachingImprovement>);expect(html.indexOf('Transcript evidence fixture')).toBeGreaterThan(html.indexOf('<details'));expect(html.indexOf('Transcript evidence fixture')).toBeLessThan(html.indexOf('</details>'));expect(html).toContain('Confirm the follow-up');});

it('finishes saved wording while preserving its recommendation and explanation',()=>{
 const html=renderToStaticMarkup(<CoachingReportContent report={{what_to_improve:['You moved on before explaining the plan.\nBetter action: Walk through the actual [confirmed initial amount] and remaining schedule.'],source_payload:{coaching_version:'call2-reviewed-coaching-2026-09-30'}}} reportType='official' reportId='fixture'/>);
 expect(html).not.toContain('[confirmed initial amount]');
 expect(html).toContain('Walk through the actual initial payment amount and remaining schedule.');
 expect(html).toContain('You moved on before explaining the plan.');
 expect(html).toContain('Show explanation');
});
