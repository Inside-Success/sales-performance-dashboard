import "server-only";
import { neon } from "@neondatabase/serverless";

// Exact source-record matches only. Client labels must not affect score availability.
export async function getScoreClientLabels(sourceIds: string[]): Promise<Record<string, string>> {
  if (!process.env.DATABASE_URL || !sourceIds.length) return {};
  try {
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql.query(`
      select source_payload->>'source_airtable_record_id' as source_id,
             min(trim(client_name)) as client_name
      from performance_calls
      where source_payload->>'source_airtable_record_id' = any($1::text[])
        and nullif(trim(client_name), '') is not null
      group by source_payload->>'source_airtable_record_id'
      having count(distinct trim(client_name)) = 1
    `, [[...new Set(sourceIds)]]);
    return Object.fromEntries(rows.map(row => [String(row.source_id), String(row.client_name)]));
  } catch {
    console.warn("Score client labels unavailable; retaining dated call links.");
    return {};
  }
}
