import { neon } from '@neondatabase/serverless';
import { databaseUrl } from './database-connection';
const db=()=>neon(databaseUrl()!);
// Recovery sources are explicitly enrolled by the operator. Normal traffic is unaffected.
export async function reserveRecoveryRequest(source:string,key:string,bound?:number) {
 const sql=db();
 const enrolled=await sql`select b.id from coaching_recovery_budgets b join coaching_recovery_budget_sources s on s.budget_id=b.id where s.source_id=${source} and b.active=true`;
 if(!enrolled.length)return;
 if(enrolled.length!==1||!Number.isFinite(bound)||Number(bound)<=0)throw Error('Recovery reservation required');
 const prior=await sql`select request_key from coaching_recovery_budget_requests where request_key=${key}`;
 if(prior.length)return;
 const rows=await sql`with funded as (
 update coaching_recovery_budgets set reserved=reserved+${bound!} where id=${enrolled[0].id}
 and active=true and spent+reserved+${bound!}<=ceiling
 and not exists(select 1 from coaching_recovery_budget_requests where request_key=${key}) returning id)
 insert into coaching_recovery_budget_requests(request_key,budget_id,source_id,reserved)
 select ${key},id,${source},${bound!} from funded returning request_key`;
 if(!rows.length)throw Error('Recovery budget ceiling reached');
}
export async function settleRecoveryRequest(key:string,result:Record<string,unknown>) {
 const sql=db();const cost=Number((result.costs as {total_cost_usd?:number})?.total_cost_usd);
 const rows=await sql`select reserved,actual from coaching_recovery_budget_requests where request_key=${key}`;
 if(!rows.length)return;
 if(!Number.isFinite(cost)||cost<0||cost>Number(rows[0].reserved))throw Error('Recovery cost receipt requires reconciliation');
 if(rows[0].actual!==null){if(Number(rows[0].actual)!==cost)throw Error('Conflicting recovery cost receipt');return;}
 await sql`with settled as (update coaching_recovery_budget_requests set actual=${cost},settled_at=now()
 where request_key=${key} and actual is null returning budget_id,reserved)
 update coaching_recovery_budgets b set spent=b.spent+${cost},reserved=b.reserved-s.reserved from settled s where b.id=s.budget_id`;
}
