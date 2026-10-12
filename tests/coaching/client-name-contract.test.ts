import {describe,it,expect} from 'vitest';
import {normalizeIngestPayload} from '../../src/lib/ingest';
import {normalizeManualCallback} from '../../src/lib/manual-reports';

describe('client name at report persistence boundaries',()=>{
 for(const [label,normalize,identity] of [
  ['official',normalizeIngestPayload,{airtable_record_id:'report',source_airtable_record_id:'source'}],
  ['manual',normalizeManualCallback,{public_id:'manual',status:'completed'}],
 ] as const){
  it(`${label}: retains an unchanged selected display label`,()=>{
   const result=normalize({...identity,client_name:' ',resolved_client_name:'Zoom user',original_client_name:'Zoom user'});
   expect(result.client_name).toBe('Zoom user');
  });
  it(`${label}: preserves an explicit name over fallback fields`,()=>{
   expect(normalize({...identity,client_name:'Verified Name',resolved_client_name:'Other Name',original_client_name:'iPhone'}).client_name).toBe('Verified Name');
  });
  it(`${label}: retains the original label if the final-name field is absent`,()=>{
   expect(normalize({...identity,client_name:null,original_client_name:'Pat’s iPhone'}).client_name).toBe('Pat’s iPhone');
  });
  it(`${label}: does not fabricate a person or drop a report when no label exists`,()=>{
   expect(normalize({...identity}).client_name).toBeNull();
  });
 }
});
