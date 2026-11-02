import {usageCost} from '../../src/lib/script-adherence/cost';
export function batchCost(usage:Record<string,unknown>){
 // Conservative rounding to whole microUSD; no more than one microUSD overhead.
 return Math.ceil(usageCost('gpt-6.1-terra',usage)/2);
}
export function indexBatchReceipts(expected:string[],receipts:Array<{custom_id:string;[key:string]:unknown}>){
 if(new Set(expected).size!==expected.length)throw Error('Duplicate manifest ID');
 const allowed=new Set(expected),out=new Map<string,typeof receipts[number]>();
 for(const receipt of receipts){
  if(!allowed.has(receipt.custom_id))throw Error('Unexpected receipt ID');
  if(out.has(receipt.custom_id))throw Error('Duplicate receipt ID');
  out.set(receipt.custom_id,receipt);
 }
 return out;
}
