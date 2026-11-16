-- Operator-created recovery budgets, separate from normal production traffic.
create table if not exists coaching_recovery_budgets (
 id text primary key, ceiling numeric not null check(ceiling>0), spent numeric not null default 0,
 reserved numeric not null default 0, active boolean not null default true,
 check(spent>=0 and reserved>=0 and spent+reserved<=ceiling));
create table if not exists coaching_recovery_budget_sources (
 source_id text primary key, budget_id text not null references coaching_recovery_budgets(id));
create table if not exists coaching_recovery_budget_requests (
 request_key text primary key,budget_id text not null references coaching_recovery_budgets(id),
 source_id text not null,reserved numeric not null check(reserved>0), actual numeric,
 settled_at timestamptz,check(actual is null or (actual>=0 and actual<=reserved)));
create table if not exists coaching_recovery_states (
 source_id text not null,channel text not null,execution_id text not null,source_hash text not null,
 status text not null,state jsonb not null,updated_at timestamptz not null default now(),
 primary key(source_id,channel,execution_id));
