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
