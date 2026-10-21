import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {neon} from '@neondatabase/serverless';
import {claimSource,settleSource} from '../src/lib/coaching-source-claim';
// Explicit opt-in integration check: only temporary owned claim rows, never reports/source data.
if(process.env.MM_CLAIM_INTEGRATION!=='1')throw Error('Explicit integration opt-in required');
const env=fs.readFileSync(process.env.MM_ENV_FILE!,'utf8');
process.env.DATABASE_URL=env.split('\n').find(l=>l.startsWith('DATABASE_URL='))!.slice(13).trim().replace(/^"|"$/g,'');
const key='verification:'+randomUUID(),source='recVerify'+Date.now();
try {
 const settled=await Promise.allSettled(Array.from({length:8},(_,i)=>claimSource(source,key,String(900000000+i))));
 assert(settled.every(r=>r.status==='fulfilled'),JSON.stringify(settled));
 const results=settled.map(r=>(r as PromiseFulfilledResult<Awaited<ReturnType<typeof claimSource>>>).value);
 assert.equal(results.filter(r=>r.acquired).length,1);
 const owner=String(900000000+results.findIndex(r=>r.acquired));
 assert.equal((await claimSource(source,key,owner)).acquired,true);
 assert.equal((await claimSource(source+'x',key,'999999999',true)).acquired,false);
 await settleSource(source,'wrong-owner','queued');
 assert.equal((await claimSource(source,key,'999999999',true)).acquired,false);
 await settleSource(source,owner,'queued');
 assert.equal((await claimSource(source,key,'999999999')).acquired,false);
 assert.equal((await claimSource(source,key,'999999999',true)).acquired,true);
 await settleSource(source,'999999999','delivered');
 assert.equal((await claimSource(source,key,'999999998',true)).acquired,false);
 console.log('PASS: eight simultaneous claimants produced one owner; retries, wrong owner, duplicate identity, recovery and completion guards verified.');
} finally {
 await neon(process.env.DATABASE_URL!).query('delete from coaching_source_claims where identity=$1 and source_id=$2',[key,source]);
 console.log('Temporary verification claim removed.');
}
