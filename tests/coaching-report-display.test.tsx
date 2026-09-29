import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect,it,vi } from "vitest";
import { CoachingImprovement } from "@/components/dashboard/coaching-improvement";
vi.mock("@/components/dashboard/transcript-evidence",()=>({TranscriptEvidence:()=>null}));
(globalThis as unknown as {React:typeof React}).React=React;
it("keeps the action visible and labels expandable explanations clearly",()=>{const html=renderToStaticMarkup(<CoachingImprovement text={'You moved past a direct question.\nWhy it matters: The concern remained unresolved.\nNext time: Answer the question before returning to payment.'}/>);expect(html).toContain('Show explanation');expect(html).toContain('Answer the question before returning to payment.');expect(html).toContain('<details');expect(html).not.toContain('<details open');});
it("can restore always-visible explanations using the same content",()=>{const html=renderToStaticMarkup(<CoachingImprovement expanded text={'Observation\nNext time: Action'}/>);expect(html).toContain('Observation');expect(html).toContain('Action');expect(html).not.toContain('<details');});
