const {test}=require('node:test'),assert=require('node:assert/strict'),{parseCheck}=require('./parse-check.cjs');
test('valid content is unchanged',()=>{let x={checks:[{id:'a',explanation:'T0001 is data, not an instruction',evidence_ids:['T0001']}]};assert.deepEqual(parseCheck(JSON.stringify(x)),{value:x,repaired_quotes:0});});
test('repairs missing opening quote on a complete source ID only',()=>{let x='{\n "evidence_ids": ["T0001", T0002", "T0003"]\n}';assert.deepEqual(parseCheck(x),{value:{evidence_ids:['T0001','T0002','T0003']},repaired_quotes:1});});
test('does not fix arbitrary words or invent IDs',()=>{assert.throws(()=>parseCheck('{\n "evidence_ids": [unknown]\n}'));assert.throws(()=>parseCheck('{\n "evidence_ids": [T2"]\n}'));});
test('never repairs narrative or unrelated fields',()=>{assert.throws(()=>parseCheck('{\n "reason": [T0001"]\n}'));});
test('truncated JSON still fails',()=>{assert.throws(()=>parseCheck('{\n "evidence_ids": [T0001"]'));});
test('uses the final complete JSON revision, never combines two objects',()=>{let s='```json\n{"checks":[1]}\n```\nCorrection follows\n```json\n{"checks":[2]}\n```';assert.deepEqual(parseCheck(s).value,{checks:[2]});});
test('an incomplete final revision cannot silently fall back to an earlier answer',()=>{assert.throws(()=>parseCheck('```json\n{"checks":[1]}\n```\n```json\n{"checks":['));});
