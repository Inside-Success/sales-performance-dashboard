import {it,expect} from 'vitest';
import {batchCost,indexBatchReceipts} from '../../scripts/script-adherence/batch-receipts';
it('matches shuffled results to source identity rather than file order',()=>{
 const r=indexBatchReceipts(['a','b'],[{custom_id:'b',response:2},{custom_id:'a',response:1}]);
 expect(r.get('a')?.response).toBe(1);expect(r.get('b')?.response).toBe(2);
});
it('rejects duplicate and unexpected receipts before settlement',()=>{
 expect(()=>indexBatchReceipts(['a'],[{custom_id:'a'},{custom_id:'a'}])).toThrow('Duplicate');
 expect(()=>indexBatchReceipts(['a'],[{custom_id:'b'}])).toThrow('Unexpected');
});
it('keeps missing receipts distinct from free successful requests',()=>expect(indexBatchReceipts(['a','b'],[{custom_id:'a'}]).has('b')).toBe(false));
it('includes cache reads and writes at batch rates',()=>expect(batchCost({prompt_tokens:10000,completion_tokens:1000,prompt_tokens_details:{cached_tokens:2000,cache_write_tokens:4000}})).toBe(7050));
it('does not turn missing usage into zero spend',()=>expect(()=>batchCost({})).toThrow());
