import fs from "node:fs";
import { neon } from "@neondatabase/serverless";
import { parseFilters } from "../src/lib/ask-sales-faq/admin/filters";
import {
  getConversationOverview,
  getConversation,
  getUsage,
  getReview,
  saveReview,
} from "../src/lib/ask-sales-faq/admin/store";
const config = JSON.parse(
  fs.readFileSync(
    "../.magic-mike-chatbot-implementation-2026-09-15/isolated-preview-config.json",
    "utf8",
  ),
);
if (!config.DATABASE_URL.includes("ep-dark-pine-aqty40j3"))
  throw Error("Isolated database required");
Object.assign(process.env, config);
const sql = neon(config.DATABASE_URL);
await sql.query(
  fs.readFileSync("migrations/20260917_ask_sales_admin_reviews.sql", "utf8"),
);
const id = "admin-redesign-fixture-20260917",
  email = "admin-redesign-fixture@example.invalid";
const assert = (v: unknown, m: string) => {
  if (!v) throw Error(m);
};
try {
  await sql.query(
    `insert into ask_sales_faq_conversations(id,viewer_email,viewer_name,title) values($1,$2,'Review fixture','A multi-turn question') on conflict(id) do nothing`,
    [id, email],
  );
  await sql.query(
    `insert into ask_sales_faq_messages(id,conversation_id,viewer_email,role,content_redacted,created_at,answer_payload) values($1,$3,$4,'user','Earlier context',now()-interval '1 day',null),($2,$3,$4,'assistant','Answer with context',now(),'{"runtimeMetadata":{"revamp":{"status":"partial"}}}') on conflict(id) do nothing`,
    [id + "-u", id + "-a", id, email],
  );
  const f = parseFilters({ days: "7", rep: email });
  const overview = await getConversationOverview(f);
  assert(overview.metrics.questions === 1, "Count user questions");
  assert(overview.rows[0]?.unanswered, "Partial flag");
  const thread = await getConversation(id);
  assert(thread?.messages.length === 2, "Full history");
  const through = thread!.messages
    .map((m) => m.event_at)
    .sort()
    .at(-1)!;
  assert(
    await saveReview(id, "admin@example.invalid", {
      reviewed: true,
      note: "Reviewed, issue still open",
      version: 0,
      through,
    }),
    "First review",
  );
  assert(
    !(await saveReview(id, "admin@example.invalid", {
      reviewed: true,
      note: "Stale",
      version: 0,
      through,
    })),
    "Stale write blocked",
  );
  assert((await getReview(id))?.version === 1, "Version unchanged on conflict");
  assert(
    (await getConversationOverview({ ...f, review: "reviewed" })).rows
      .length === 1,
    "Reviewed filter",
  );
  await sql.query(
    `insert into ask_sales_faq_feedback(id,message_id,conversation_id,viewer_email,rating,comment) values($1,$2,$3,$4,'down','Still missing context')`,
    [id + "-f", id + "-a", id, email],
  );
  assert(
    (await getConversationOverview({ ...f, review: "pending" })).rows.length ===
      1,
    "New feedback reopens review",
  );
  assert(
    (await getConversationOverview({ ...f, q: "Earlier context" })).rows
      .length === 1,
    "Question search",
  );
  assert(
    (await getConversationOverview({ ...f, q: "Answer with context" })).rows
      .length === 1,
    "Answer search",
  );
  assert(
    (await getConversationOverview({ ...f, filter: "down" })).metrics.down ===
      1,
    "Latest feedback count",
  );
  const usage = await getUsage({ ...f, rep: "" });
  assert(
    usage.users.find((u) => u.email === email)?.days === 1,
    "Period activity",
  );
  process.env.ASK_SALES_FAQ_ADMIN_EMAILS = email;
  assert(
    (await getConversationOverview(f)).rows.length === 0,
    "Admin exclusion",
  );
  assert(
    (await getConversationOverview({ ...f, includeAdmins: true })).rows
      .length === 1,
    "Admin opt-in",
  );
  console.log(
    "PASS: isolated SQL, full history, filters, review conflict, feedback reopens, usage and admin exclusion.",
  );
} finally {
  await sql.query(
    "delete from ask_sales_faq_conversations where id=$1 and viewer_email=$2",
    [id, email],
  );
}
