-- Additive admin-only metadata. Does not change conversation/message/knowledge records.
create table if not exists ask_sales_faq_admin_reviews (
 conversation_id text primary key references ask_sales_faq_conversations(id) on delete cascade,
 reviewed boolean not null default false,
 reviewed_through timestamptz not null,
 note text not null default '' check(length(note)<=2000),
 actor text not null,
 version integer not null default 1,
 updated_at timestamptz not null default now()
);
