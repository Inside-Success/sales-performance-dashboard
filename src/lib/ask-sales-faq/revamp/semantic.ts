import "server-only";
import { createHash } from "node:crypto";
import type { Evidence } from "./types";

export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 256;
export type SemanticIndex = { model: string; dimensions: number; entries: Record<string, { fingerprint: string; vector: number[] }> };
export function embeddingText(record: Evidence) {
  return [record.title, ...record.questions, record.text, ...record.scopes, ...record.conditions].join("\n").slice(0, 6000);
}
export function evidenceFingerprint(record: Evidence) {
  return createHash("sha256").update(embeddingText(record)).digest("hex");
}
export function semanticScores(records: Evidence[], index: SemanticIndex, query: number[]) {
  if(index.model !== EMBEDDING_MODEL || index.dimensions !== EMBEDDING_DIMENSIONS || query.length !== EMBEDDING_DIMENSIONS || query.some(v=>!Number.isFinite(v))) return new Map<string,number>();
  const queryNorm = Math.hypot(...query);
  const scores = new Map<string,number>();
  if(!queryNorm) return scores;
  for(const record of records) {
    const entry = index.entries[record.id];
    // A retired record is absent from records; changed text cannot reuse stale vectors.
    if(!entry || entry.fingerprint !== evidenceFingerprint(record) || entry.vector.length !== query.length || entry.vector.some(v=>!Number.isFinite(v))) continue;
    const norm = Math.hypot(...entry.vector);
    if(norm) scores.set(record.id, entry.vector.reduce((sum,value,i)=>sum+value*query[i],0)/(norm*queryNorm));
  }
  return scores;
}
export async function requestEmbeddings(input: string[], apiKey: string, timeoutMs = 8000) {
  if(!apiKey) throw new Error("embedding_not_configured");
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({model:EMBEDDING_MODEL,dimensions:EMBEDDING_DIMENSIONS,input,encoding_format:"float"}),
  });
  if(!response.ok) throw new Error(`embedding_http_${response.status}`);
  const data = await response.json();
  const rows = data.data as Array<{index:number;embedding:number[]}>;
  if(!Array.isArray(rows) || rows.length!==input.length || new Set(rows.map(r=>r.index)).size!==input.length) throw new Error("embedding_invalid_response");
  rows.sort((a,b)=>a.index-b.index);
  if(rows.some((r,i)=>r.index!==i || r.embedding.length!==EMBEDDING_DIMENSIONS || r.embedding.some(v=>!Number.isFinite(v)))) throw new Error("embedding_invalid_response");
  return { vectors:rows.map(r=>r.embedding),tokens:Number(data.usage?.total_tokens)||0 };
}
