-- Explicit user authorization: remove the pilot ceiling, retain all cost accounting.
-- NULL means uncapped. Does not activate schedules or change historical receipts.
alter table script_adherence_budget alter column ceiling_microusd drop not null;
