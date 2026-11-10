import {z} from 'zod';
// Archive identity is recording-specific. Meeting IDs and titles are reusable.
export const archiveRecordSchema=z.object({recordId:z.string().regex(/^rec[a-zA-Z0-9]+$/),uuid:z.string(),hostId:z.string(),startedAt:z.string(),fileId:z.string().min(1),automationKey:z.string(),docId:z.string().regex(/^[a-zA-Z0-9_-]{10,200}$/)}).strict();
export type ArchiveRecord=z.infer<typeof archiveRecordSchema>;
export function archiveIdentity(record:ArchiveRecord,job:{accountId:string;uuid:string;startedAt:string;hosts:string[];files:Array<{id:string}>}){
 if(record.uuid!==job.uuid||!job.hosts.includes(record.hostId))throw Error('Archive recording/account mismatch');
 const a=Date.parse(record.startedAt),b=Date.parse(job.startedAt);
 if(!Number.isFinite(a)||!Number.isFinite(b)||Math.abs(a-b)>1000)throw Error('Archive recording time mismatch');
 if(![`zoom:${record.uuid}:${record.fileId}`,`zoom:${job.accountId}:${record.uuid}:${record.fileId}`].includes(record.automationKey))throw Error('Archive identity key mismatch');
 if(job.files.length && (job.files.length!==1||job.files[0].id!==record.fileId))throw Error('Archive does not establish all recording segments');
}
export function archiveTranscript(record:ArchiveRecord,text:string){
 if(Buffer.byteLength(text)>650000)throw Error('Archive exceeds supported size');
 const markers=[...text.matchAll(/^Full Transcript\s*$/gm)];if(markers.length!==1)throw Error('Archive full transcript marker ambiguous');const marker=markers[0];if(!marker)throw Error('Archive full transcript marker absent');
 const header=text.slice(0,marker.index),body=text.slice(marker.index+marker[0].length).trim();
 const field=(name:string)=>{const lines=header.split(/\r?\n/).filter(l=>l.startsWith(name+': '));if(lines.length!==1)throw Error('Archive metadata ambiguous');return lines[0].slice(name.length+2).trim();};
 if(field('Zoom Meeting UUID')!==record.uuid||field('Recording File ID')!==record.fileId||field('Automation Key')!==record.automationKey||Date.parse(field('Meeting Start Date'))!==Date.parse(record.startedAt))throw Error('Document does not match archive record');
 if(!/^\[([^\]\n]*\d{1,2}:\d{2}[^\]\n]*)\]\s*[^:\n]+:\s*\S/m.test(body))throw Error('Archive lacks timestamped speaker transcript');
 if(Buffer.byteLength(body)>600000)throw Error('Full archive transcript exceeds supported size');
 // No summarization, truncation or AI-generated metadata enters the transcript.
 return body;
}
export function selectArchive(records:Array<{id:string;fields:Record<string,unknown>}>,job:{accountId:string;uuid:string;startedAt:string;hosts:string[];files:Array<{id:string}>}):ArchiveRecord{
 const matches=records.filter(r=>r.fields['Zoom Meeting UUID']===job.uuid);
 // Multiple segment/duplicate records need explicit reconciliation, not first-match wins.
 if(matches.length!==1)throw Error(matches.length?'Multiple archive records require reconciliation':'No matching archived transcript');
 const {id,fields:f}=matches[0];
 const link=String(f['Meeting Transcript Link']||'');
 const fromLink=/^https:\/\/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)(?:\/|$)/.exec(link)?.[1];
 const fromField=String(f['Transcript Google Doc ID']||'');
 if(!fromLink&&!fromField)throw Error('No archived transcript document available yet');
 if(fromLink&&fromField&&fromLink!==fromField)throw Error('Archive document identifiers conflict');
 const record=archiveRecordSchema.parse({recordId:id,uuid:f['Zoom Meeting UUID'],hostId:f['Zoom Host ID'],startedAt:f['Meeting Start Date'],fileId:f['Recording File ID'],automationKey:f['Automation Key'],docId:fromField||fromLink||''});
 archiveIdentity(record,job);return record;
}
