import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({score:vi.fn(),call:vi.fn()}));
vi.mock('@/lib/db',()=>({getPerformanceCall:mocks.call}));
vi.mock('@/lib/rep-scoring/coaching-score',()=>({getCoachingCallScore:mocks.score}));
import CallPage from '@/app/call/[id]/page';
(globalThis as unknown as {React:typeof React}).React=React;
it('shows a correction instead of coaching, a score, feedback or chat for a first-call exclusion',async()=>{
 mocks.call.mockResolvedValue({id:1,call_status:'call_1',client_name:'Fixture',transcript_link:'https://example.com/transcript',google_doc_link:'https://example.com/correction',source_payload:{coaching_version:'coaching-excluded'}});
 const html=renderToStaticMarkup(await CallPage({params:Promise.resolve({id:'1'}),searchParams:Promise.resolve({})}));
 expect(html).toContain('Call not scored');expect(html).toContain('earlier coaching has been withdrawn');expect(html).toContain('Read the transcript');
 for(const absent of ['Call score','What happened','Was this report helpful?','Ask Magic Mike'])expect(html).not.toContain(absent);
 expect(mocks.score).not.toHaveBeenCalled();
});
