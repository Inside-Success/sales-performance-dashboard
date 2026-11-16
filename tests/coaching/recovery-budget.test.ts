import {beforeAll,afterAll,it,expect,vi} from 'vitest';
import {PGlite} from '@electric-sql/pglite';import {readFileSync} from 'node:fs';
const holder=vi.hoisted(()=>({db:null as unknown as PGlite}));
vi.mock('@neondatabase/serverless',()=>({neon:()=>async(strings:TemplateStringsArray,...values:unknown[])=>{const text=strings.reduce((a,x,i)=>a+x+(i<values.length?'$'+(i+1):''),'');return (await holder.db.query(text,values)).rows;}}));
vi.mock('../../src/lib/database-connection',()=>({databaseUrl:()=> 'isolated'}));
import {reserveRecoveryRequest,settleRecoveryRequest} from '../../src/lib/coaching-recovery-budget';
beforeAll(async()=>{holder.db=new PGlite();await holder.db.exec(readFileSync('scripts/coaching-release/recovery-budget-schema.sql','utf8'));await holder.db.exec("insert into coaching_recovery_budgets(id,ceiling) values('test',1);insert into coaching_recovery_budget_sources values('recA','test');");});
afterAll(async()=>{await holder.db.close();});
it('reserves once, rejects overspend and settles actual charges once',async()=>{
 await reserveRecoveryRequest('recA','a',0.7);await reserveRecoveryRequest('recA','a',0.7);
 await expect(reserveRecoveryRequest('recA','b',0.4)).rejects.toThrow('ceiling');
 await settleRecoveryRequest('a',{costs:{total_cost_usd:0.2}});await settleRecoveryRequest('a',{costs:{total_cost_usd:0.2}});
 await expect(settleRecoveryRequest('a',{costs:{total_cost_usd:0.3}})).rejects.toThrow('Conflicting');
 await reserveRecoveryRequest('recA','b',0.7);
 const row=(await holder.db.query('select spent,reserved from coaching_recovery_budgets')).rows[0] as {spent:string,reserved:string};expect(Number(row.spent)).toBe(0.2);expect(Number(row.reserved)).toBe(0.7);
 await expect(settleRecoveryRequest('b',{costs:{total_cost_usd:0.8}})).rejects.toThrow('reconciliation');
 await reserveRecoveryRequest('unrelated','normal');
});
