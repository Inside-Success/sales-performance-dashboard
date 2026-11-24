const assert=require('node:assert/strict');
const code=require('./search-guards.json');
const refs={'Attach Airtable Search Result':'Prepare Airtable Search','Attach Fallback Airtable Search Result':'Exact Airtable Record?','Attach Final Pre-Create Search Result':'Existing Airtable Record?','Prepare Pending Transcript Airtable Write':'Prepare Pending Transcript Airtable Search'};
const src=['a','b'].map(k=>({json:{automationKey:k,'Automation Key':k,repName:k,meetingUuid:k,meetingId:k}}));
function run(name,rows){return new Function('$input','$',code[name])({all:()=>rows.map(records=>({json:{records}}))},ref=>{assert.equal(ref,refs[name]);return {itemMatching:i=>src[i]}})}
for(const name of Object.keys(code))for(const rows of [[[],[]],[[{id:'recA',fields:{'Automation Key':'a'}}],[]],[[],[{id:'recB',fields:{'Automation Key':'b'}}]]]){const out=run(name,rows);assert.equal(out.length,2);out.forEach((x,i)=>assert.deepEqual(x.pairedItem,{item:i}));}
const pending=run('Prepare Pending Transcript Airtable Write',[[{id:'recA',fields:{'Automation Key':'a','Processing Status':'Processed'}}],[]]);assert.equal(pending.length,1);assert.deepEqual(pending[0].pairedItem,{item:1});assert.equal(pending[0].json['Rep Name'],'b');
const rejected=run('Attach Fallback Airtable Search Result',[[{id:'wrong',fields:{'Zoom Meeting UUID':'other','Meeting ID':'a'}}],[]]);assert.equal(rejected[0].json.existingRecordId,'');
const exact=run('Attach Final Pre-Create Search Result',[[{id:'recA',fields:{'Automation Key':'a'}}],[]]);assert.equal(exact[0].json.id,'recA');assert.equal(exact[1].json.finalPreCreateMatched,false);
console.log('PASS: all four search guards, mixed empty results, completed pending exclusion, wrong identity rejection, exact pre-create match.');
