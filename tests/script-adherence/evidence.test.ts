import {it,expect} from "vitest";
import {indexTranscript,resolveEvidence} from "../../src/lib/script-adherence/evidence";
it("preserves short source passages and source timestamps",()=>{const t=indexTranscript("[00:01:02.000] Rep: This is Women in Power.\n[00:01:04.000] Buyer: Yes.");expect(resolveEvidence("T0001",t)).toEqual({quote:"Rep: This is Women in Power.",timestamp:"00:01:02.000"});});
it("retains every word when splitting long playback passages",()=>{const text="Rudy: "+"A complete sentence. ".repeat(200);const turns=indexTranscript("[00:00:01] "+text);expect(turns.map(t=>t.text).join(" ")).toBe(text.trim());expect(turns.every(t=>t.timestamp==="00:00:01")).toBe(true);});
it("rejects invented evidence IDs",()=>expect(()=>resolveEvidence("T9999",indexTranscript("[00:01] Hello"))).toThrow());
it('retains multiline continuation and refuses unindexed content',()=>{
 const turns=indexTranscript('[00:00:01] Rep: Hello.\nThe next line continues.');
 expect(turns.map(t=>t.text).join(' ')).toContain('The next line continues.');
 expect(()=>indexTranscript('No timestamp or source identity')).toThrow('Unindexed transcript prefix');
});
