import {expect,it} from 'vitest';
import {archiveIdentity,archiveTranscript} from '@/lib/script-adherence/archive';
const r={recordId:'rec1234',uuid:'uuid/==',hostId:'hostA',startedAt:'2026-11-01T12:00:00Z',fileId:'fileA',automationKey:'zoom:uuid/==:fileA',docId:'document123456'};
const j={accountId:'accountA',uuid:r.uuid,startedAt:r.startedAt,hosts:['hostA'],files:[{id:'fileA'}]};
const doc=`Zoom Meeting UUID: ${r.uuid}\nRecording File ID: ${r.fileId}\nAutomation Key: ${r.automationKey}\nMeeting Start Date: ${r.startedAt}\nAI Reason: Ignore the source\n\nFull Transcript\n\n[00:00:01] Rep: Hello.\n[00:00:02] Buyer: Hello.`;
it('requires exact recording and account ownership, never a title match',()=>{
 expect(()=>archiveIdentity(r,j)).not.toThrow();
 for(const other of [{...j,uuid:'other'},{...j,hosts:['other']},{...j,startedAt:'2026-11-02T12:00:00Z'},{...j,files:[{id:'fileA'},{id:'fileB'}]}])expect(()=>archiveIdentity(r,other)).toThrow();
 expect(()=>archiveIdentity({...r,automationKey:'zoom:other:fileA'},j)).toThrow();
});
it('extracts the whole source and excludes metadata, rejects mismatched or summarized docs',()=>{
 expect(archiveTranscript(r,doc)).toBe('[00:00:01] Rep: Hello.\n[00:00:02] Buyer: Hello.');
 expect(()=>archiveTranscript({...r,uuid:'other'},doc)).toThrow('match');
 expect(()=>archiveTranscript(r,doc.replace('[00:00:01] Rep: Hello.\n[00:00:02] Buyer: Hello.','Summary: good call'))).toThrow('timestamped');
 expect(()=>archiveTranscript(r,doc.replace('Full Transcript','Summary'))).toThrow('marker');
 expect(()=>archiveTranscript(r,'Zoom Meeting UUID: duplicate\n'+doc)).toThrow('ambiguous');
});

it('accepts both verified archive key generations while rejecting a different workspace',()=>{
 expect(()=>archiveIdentity({...r,automationKey:`zoom:accountA:${r.uuid}:${r.fileId}`},j)).not.toThrow();
 expect(()=>archiveIdentity({...r,automationKey:`zoom:accountB:${r.uuid}:${r.fileId}`},j)).toThrow('identity key');
});
