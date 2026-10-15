import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { providerCheckpoint } from "./provider-checkpoints";

describe.skipIf(process.env.MM_CHECKPOINT_LIVE_TEST !== "1")("isolated live checkpoint ownership", () => {
  it("opens an outage circuit and grants one recovery probe without touching real provider health", async () => {
    // Call the store with a test-only provider namespace. The HTTP schema refuses it.
    const provider=("checkpoint-qa-"+randomUUID()) as "anthropic";
    const sql=neon(process.env.DATABASE_URL!);
    try {
      for(let i=0;i<3;i++) {
        const id={source_id:"durable-test-circuit-"+i,stage:"outage_qa",provider,request_hash:"c".repeat(64)};
        const claim=await providerCheckpoint({action:"claim",...id});expect(claim.status).toBe("acquired");
        await providerCheckpoint({action:"fail",...id,token:claim.token!,error:"Synthetic provider timeout"});
      }
      const probe={source_id:"durable-test-probe",stage:"outage_qa",provider,request_hash:"d".repeat(64)};
      expect((await providerCheckpoint({action:"claim",...probe})).status).toBe("deferred");
      await sql`update coaching_provider_health set open_until=now()-interval '1 second',probe_until=now()-interval '1 second' where provider=${provider}`;
      const attempts=await Promise.all(Array.from({length:8},(_,i)=>providerCheckpoint({action:"claim",...probe,source_id:probe.source_id+i})));
      expect(attempts.filter(x=>x.status==="acquired")).toHaveLength(1);
      expect(attempts.filter(x=>x.status==="deferred")).toHaveLength(7);
      const winner=attempts.findIndex(x=>x.status==="acquired");
      await providerCheckpoint({action:"complete",...probe,source_id:probe.source_id+winner,token:attempts[winner].token!,result:{ok:true,parsed_json:{status:"verified"}}});
      expect((await sql`select failures from coaching_provider_health where provider=${provider}`)[0].failures).toBe(0);
    } finally {
      await sql`delete from coaching_provider_checkpoints where provider=${provider}`;
      await sql`delete from coaching_provider_health where provider=${provider}`;
    }
  },60000);
  it("allows one owner, rejects stale completion, preserves success and isolates exact hashes", async () => {
    const source_id = "durable-test-store-" + randomUUID();
    const id = {source_id,stage:"ownership_qa",provider:"anthropic" as const,request_hash:"a".repeat(64)};
    const sql = neon(process.env.DATABASE_URL!);
    try {
      const claims = await Promise.all(Array.from({length:8}, () => providerCheckpoint({action:"claim",...id})));
      const owners = claims.filter(c=>c.status === "acquired");
      expect(owners).toHaveLength(1);
      expect(claims.filter(c=>c.status === "deferred")).toHaveLength(7);
      const token=owners[0].token!;
      await expect(providerCheckpoint({action:"complete",...id,token,result:{ok:true,parsed_json:null}})).rejects.toThrow("Invalid structured");
      await sql`update coaching_provider_checkpoints set lease_until=now()-interval '1 minute' where source_id=${source_id} and status='running'`;
      const next = await providerCheckpoint({action:"claim",...id});
      expect(next.status).toBe("acquired");expect(next.token).not.toBe(token);
      const result = {ok:true,parsed_json:{status:"verified"},parse_error:"",stop_reason:"end_turn"};
      await expect(providerCheckpoint({action:"complete",...id,token,result})).rejects.toThrow("ownership changed");
      await providerCheckpoint({action:"complete",...id,token:next.token!,result});
      await providerCheckpoint({action:"fail",...id,token,error:"stale invalid source"});
      const cached = await providerCheckpoint({action:"claim",...id});
      expect(cached.status).toBe("cached");expect(cached.result.parsed_json).toEqual({status:"verified"});
      expect((await providerCheckpoint({action:"claim",...id,request_hash:"b".repeat(64)})).status).toBe("acquired");
    } finally { await sql`delete from coaching_provider_checkpoints where source_id=${source_id}`; }
  }, 60000);
});
