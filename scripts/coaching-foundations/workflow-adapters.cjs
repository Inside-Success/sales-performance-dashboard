// Offline only: build version-aware document readers over an explicitly supplied baseline.
// No n8n API, activation, credential or delivery client exists in this builder.
const esbuild=require('esbuild');const path=require('node:path');
function bundle(){return esbuild.buildSync({stdin:{contents:"module.exports={...require('./src/lib/foundations-record.cjs'),...require('./scripts/coaching-foundations/document-format.cjs')}",resolveDir:path.resolve(__dirname,'../..')},bundle:true,write:false,format:'iife',globalName:'FOUNDATIONS',platform:'browser',target:'es2022'}).outputFiles[0].text;}
function adaptDocumentNode(node,channel){
 const next=structuredClone(node);let code=next.parameters?.jsCode;
 if(typeof code!=='string'||code.includes('var FOUNDATIONS'))throw Error('Unsupported or already adapted document node');
 const anchor='function coachingSections(report){';
 if(code.split(anchor).length!==2)throw Error('Document section anchor drift');
 code=code.replace(anchor,anchor+`\n if(report.coaching_version===FOUNDATIONS.GENERATION){return FOUNDATIONS.sections(report,report.reviewed_coaching_v3?.source_id||'',${JSON.stringify(channel)});}\n`);
 if(channel==='official'){
  const before="const report={reviewed_coaching_v2:";
  if(code.split(before).length!==2)throw Error('Official document source anchor drift');
  code=code.replace(before,"const report={coaching_version:$('Performance Agent').itemMatching(0).json.coaching_version,reviewed_coaching_v3:$('Performance Agent').itemMatching(0).json.reviewed_coaching_v3||null,reviewed_coaching_v2:");
 }
 const label="(report.reviewed_coaching_v2?'Enhanced':'Legacy')";
 if(code.split(label).length!==2)throw Error('Document generation anchor drift');
 code=code.replace(label,"(report.coaching_version===FOUNDATIONS.GENERATION?'Enhanced':'Legacy')");
 const docAnchor='function coachingDocRequests(sections,header){';
 const callAnchor='coachingDocRequests(coachingSections(report),header)';
 if(code.split(docAnchor).length!==2||code.split(callAnchor).length!==2)throw Error('Document format anchor drift');
 code=code.replace(docAnchor,'function coachingDocRequests(sections,header,isFoundations){if(isFoundations)return FOUNDATIONS.docRequests(sections,header);');
 code=code.replace(callAnchor,'coachingDocRequests(coachingSections(report),header,report.coaching_version===FOUNDATIONS.GENERATION)');
 next.parameters.jsCode=bundle()+'\n'+code;
 new Function('$json','$',next.parameters.jsCode);
 return next;
}
function build(baselines){
 const out={};for(const [id,name,channel] of [['L8Nn7xncA9ZPDdWA','Build PDF HTML','official'],['BMRrGxHyXMcgO6j3','Build Google Doc','manual']]){
  const w=structuredClone(baselines[id]);if(!w)throw Error('Missing verified baseline');
  const i=w.nodes.findIndex(n=>n.name===name);if(i<0)throw Error('Missing document reader');w.nodes[i]=adaptDocumentNode(w.nodes[i],channel);out[id]=w;
 }return out;
}
module.exports={bundle,adaptDocumentNode,build};
