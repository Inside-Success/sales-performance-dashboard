import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildSourceAccounting} from './build-source-accounting.mjs';
import {identityRep,identityPerson} from './prospect-identity.mjs';
assert(identityRep('GARRETT MOORE - Casting Manager',{repName:'Garrett Moore'}));
assert(identityRep('Jones - Casting Manager',{repName:'Jones Mumba'}));
assert(!identityRep('Jones',{repName:'Jones Mumba'}),'Bare first names must not globally bind another person');
assert(!identityPerson('My Meeting'));
if(process.argv[2]) {
 const b=JSON.parse(fs.readFileSync(process.argv[2]));
 const patches=buildSourceAccounting(b);
 for(const op of patches.official){const code=op.node?.parameters?.jsCode||op.updates?.['parameters.jsCode'];if(code)new Function(code);}
 const code=patches.official.find(op=>op.nodeName==='MM Parse Classifier').updates['parameters.jsCode'];
 const gate=new Function('caseItem','gateOutput',code.slice(0,code.indexOf('let built ='))+'return applyAttendanceGuards(gateOutput,caseItem);');
 const fixture=(body,rep='Assigned Rep',client='Client',aliases=[])=>({cleaned_transcript:'Full Transcript\n'+body,metadata:{rep_name:rep,client_name:client},source:{'Client Speaker Aliases':JSON.stringify(aliases)}});
 const scored={call_status:'scored',classification_reason:'Substantive dialogue'};
 const long='The package and payment options were discussed. '.repeat(100);
 assert.equal(gate(fixture('[00:00] Assigned Rep: '+long+'\n[00:01] Jamie,  Safe2Talk2: Yes, please explain.','Assigned Rep','Jamie Tedrick-Monroe',['Jamie, Safe2Talk2']),scored).call_status,'scored');
 assert.equal(gate(fixture('[00:00] Assigned Rep: '+long+'\n[00:01] Unexpected human label: Yes, please explain.'),scored).call_status,'scored','Name mismatch alone is not absence');
 assert.equal(gate(fixture('[00:00] Assigned Rep: '+long+'\n[00:01] Audio shared by Assigned Rep: '+long),scored).call_status,'transcript_too_short','Presentation audio is not a prospect');
 assert.equal(gate(fixture('[00:00] Guest Person: Can you hear me?'),{call_status:'transcript_too_short'}).call_status,'transcript_too_short','Unmatched names do not establish rep absence');
 const restore=patches.official.find(op=>op.node?.name==='MM Restore Source Start').node;
 const input={'Source Airtable Record ID':'recFixture','Transcript Doc':'original'};
 assert.deepEqual(new Function('$',restore.parameters.jsCode)(()=>({item:{json:input}})),{json:input,pairedItem:{item:0}});
 const early=patches.official.find(op=>op.node?.name==='MM Queue Transcript Fetch').node.parameters.jsCode;
 assert(!early.includes("$('If')"));assert(early.includes("$('Loop Over Items').item"));
 assert(!patches.official.some(op=>/Classify Sales Call|Scoring|Compliance/.test(op.nodeName||'')));
 assert(patches.official.some(op=>op.type==='addConnection'&&op.source==='MM Observe Source Start'&&op.sourceIndex===1&&op.target==='MM Restore Source Start'));
}
console.log('Source accounting: role-qualified names, generic labels, compiled handoffs, presentation exclusion, source pairing and bounded fetch routing passed.');
