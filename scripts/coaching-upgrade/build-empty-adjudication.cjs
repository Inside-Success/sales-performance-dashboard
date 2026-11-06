// Offline, scoped follow-up to the November 5 repair contract.
const fs=require('node:fs');
const {replaceFunction}=require('./build-repair-contract.cjs');
const {safetyL1Decisions,safetyScreenContract}=require('./repair-contract.cjs');
function buildEmptyAdjudication(baselines){
 const result={};
 for(const id of ['L8Nn7xncA9ZPDdWA','BMRrGxHyXMcgO6j3']){
  const w=structuredClone(baselines[id]);let validators=0,screens=0;
  for(const node of w.nodes){
   let code=node.parameters?.jsCode;if(!code)continue;
   if(code.includes('function safetyL1Decisions(')){code=replaceFunction(code,'safetyL1Decisions',safetyL1Decisions.toString());validators++;}
   if(node.name.endsWith('Build Safety Screen Request')){
    code=replaceFunction(code,'buildDeepSeekPrompt',safetyScreenContract.toString()+`\nfunction buildDeepSeekPrompt(state,hits){const prompt=buildDeepSeekPromptBeforeRepairContract(state,hits);return state.coaching_version==='magic-mike-objection-coaching-2026-10-29'?safetyScreenContract(prompt):prompt;}`);screens++;
   }
   new (Object.getPrototypeOf(async function(){}).constructor)('$json','$',code);
   node.parameters.jsCode=code;
  }
  if(validators!==2||screens!==1)throw Error('Unexpected embedded safety contract count '+id);
  result[id]=w;
 }
 return result;
}
module.exports={buildEmptyAdjudication};
if(require.main===module)fs.writeFileSync(process.argv[3],JSON.stringify(buildEmptyAdjudication(JSON.parse(fs.readFileSync(process.argv[2])))));
