const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const release=require('./release-contract.cjs'),contract=require('./apply.cjs');
test('published application preserves the tested correction contract',()=>{for(const key of ['prepare','apply'])assert.equal(release[key].toString(),contract[key].toString());});
test('all embedded production stages compile',()=>{for(const f of ['build-bounded','prepare-affected','accept-reassessment','finalize-bounded','check-primary-structure','accept-primary-repair','unwrap-primary'])assert.doesNotThrow(()=>new Function('$input','$','$json',fs.readFileSync(path.join(__dirname,f+'.js'),'utf8')));});
test('primary structural recovery is bounded to malformed successful responses',()=>{
 const code=fs.readFileSync(path.join(__dirname,'check-primary-structure.js'),'utf8');const run=raw=>new Function('$input','$',code)({all:()=>[{json:raw}]},()=>({all:()=>[{json:{provider_request:{system:'rubric',request_id:'one'}}}]}))[0].json;
 assert.equal(run({ok:true,model_text:'{'}).needs_repair,true);assert.equal(run({ok:false,error:'timeout'}).needs_repair,false);
 const x=run({ok:true,parsed_json:{}});assert.equal(x.provider_request.request_id,'one-format-repair');
 assert.throws(()=>new Function('$input','$',code)({all:()=>[]},()=>({all:()=>[]})),/Expected one/);
});
