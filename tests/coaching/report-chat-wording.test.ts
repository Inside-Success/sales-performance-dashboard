import { expect, it } from 'vitest';
import { buildReportChatMessages, buildManualReportChatMessages } from '@/lib/report-chat';
import type { PerformanceCall, ManualFeedbackReport } from '@/lib/types';

it('finishes official and manual report advice without modifying source transcript text', () => {
  const transcript = 'SOURCE: [confirmed initial amount] [T0204] $2,500';
  const official = { id: 1, what_to_improve: ['Discuss [confirmed initial amount].'], source_payload: {} } as PerformanceCall;
  const manual = { public_id: 'fixture', what_to_improve: ['Discuss [confirmed initial amount].'], source_payload: {} } as ManualFeedbackReport;
  for (const messages of [buildReportChatMessages(official, transcript, []), buildManualReportChatMessages(manual, transcript, [])]) {
    const context = messages.map(message => message.content).join('\n');
    expect(context).toContain('Discuss the initial payment amount.');
    expect(context).toContain(transcript);
  }
});

it('disables coaching chat for a first-call exclusion even when report chat is enabled',async()=>{
 const {isReportChatEnabledForCall}=await import('@/lib/report-chat');
 const before=process.env.REPORT_CHAT_ENABLED;process.env.REPORT_CHAT_ENABLED='true';
 try{expect(isReportChatEnabledForCall({id:1,rep_slug:'rep',call_status:'call_1'})).toBe(false);expect(isReportChatEnabledForCall({id:2,rep_slug:'rep',call_status:'scored'})).toBe(true);}finally{if(before===undefined)delete process.env.REPORT_CHAT_ENABLED;else process.env.REPORT_CHAT_ENABLED=before;}
});
