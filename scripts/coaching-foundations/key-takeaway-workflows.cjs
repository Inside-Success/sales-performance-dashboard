// Scoped presentation update over fresh live snapshots; no network or activation.
const {replaceRuntime,replaceDocumentRuntime}=require('./production-upgrade.cjs');
const {bundle}=require('./n8n-workflow.cjs');
const {replaceOnce}=require('./parent-workflows.cjs');
const OLD='summary contains exactly two nonempty lines separated by a newline: a short, truthful hook about the useful learning opportunity, then a plain-language subheadline explaining what the rep can learn here.';
const NEW='summary is one clear, call-specific takeaway in one short paragraph, normally one sentence. State the most useful lesson directly, preserving any essential qualification. The renderer supplies the fixed heading Key takeaway. Do not include a headline, subheadline, section label, or a second sentence merely saying what the rep can learn.';
function patch(baseline,{core=false}={}){
 const w=structuredClone(baseline);
 for(const n of w.nodes){let c=n.parameters?.jsCode;if(!c)continue;
  if(core&&['Start','Advance'].includes(n.name)){
   const marker='function envelope(t)',i=c.indexOf(marker);if(i<0||c.indexOf(marker,i+1)>=0)throw Error('Core envelope drift');c=bundle()+'\n'+c.slice(i);
  }else if(c.includes('const structuredClone=value=>JSON.parse(JSON.stringify(value));'))c=replaceRuntime(c);
  else if(c.startsWith('var FOUNDATIONS = (() => {'))c=replaceDocumentRuntime(c);
  if(['MM Build Coaching Request','MM Manual Build Structured Coaching'].includes(n.name)){
   const lines=c.match(/^const knowledgeTemplate=.*;$/gm);if(lines?.length!==1)throw Error('Template drift');
   const template=JSON.parse(lines[0].slice('const knowledgeTemplate='.length,-1));
   template.foundation=replaceOnce(template.foundation,OLD,NEW);
   template.foundation=replaceOnce(template.foundation,'Exactly two lines: truthful learning hook then plain subheadline; empty for excluded calls','One clear call-specific takeaway paragraph; empty for excluded calls');
   c=c.replace(lines[0],()=>`const knowledgeTemplate=${JSON.stringify(template)};`);
  }
  n.parameters.jsCode=c;
 }
 return w;
}
module.exports={patch,OLD,NEW};
