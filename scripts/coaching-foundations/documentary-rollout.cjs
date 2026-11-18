const {digest}=require('../../src/lib/coaching-canonical.cjs');

const REVISION='2026-11-18-documentary-views-v1';
const GUIDANCE=`November 17, 2026 standalone Documentary Call 2 rollout. This scoped update supersedes older trailer-only view descriptions for the revised presentations. When the call uses the revised $8,000 Lite or $12,000 Standard standalone Documentary offer, both final presentations describe one million combined promotional views. Lite describes combined promotion across socials, email and ads with tracking. Standard describes combined promotion across show, trailer and associated content, including paid promotion. This is a combined metric. Do not represent it as a count per asset or platform, unique people, organic-only traffic, followers, leads, revenue, guaranteed third-party placement or guaranteed publication. Distinguish reading an applicable agreement from improvising terms. Judge the rep against the particular tier, agreement, and offer actually in effect for the call. A correctly scoped statement from the revised offer does not warrant corrective coaching solely because older guidance mentions 100,000 trailer views. If offer version or buyer-specific terms are genuinely unclear, coach on confirming scope without implying a false promise. The rollout excludes Reality, the documentary bundled with Reality, and Daymond John / Next Level CEO. The two revised presentations cover Lite and Standard. Standalone Documentary VIP is paused for this rollout. Do not apply the rollout retroactively to older agreements.

Final Lite presentation: https://drive.google.com/file/d/11zplk1i0YrdHrJjjI56d6g2BrnMXftkX/view
Final Standard presentation: https://drive.google.com/file/d/1SYQP967oFbNGkUgsqE3OmJchYBprk2km/view
Leadership scope and rollout: https://istvoffical.slack.com/archives/C09AF0NQJE7/p1794932002015789`;

function updateTemplate(template){
 const layer=template.layers.find(source=>source.id==='november-source-updates');
 if(!layer||digest(layer.text)!==layer.digest)throw Error('Unverified November knowledge layer');
 if(layer.revision===REVISION){
  if(!layer.text.endsWith(GUIDANCE))throw Error('Unexpected Documentary rollout contents');
  return template;
 }
 if(layer.revision!=='2026-11-05-v1')throw Error('November knowledge revision has changed');
 const text=layer.text+'\n\n'+GUIDANCE;
 const next={...layer,text,digest:digest(text),revision:REVISION};
 return {...template,layers:template.layers.map(source=>source===layer?next:source)};
}

function updateNodeCode(code){
 const anchor='const knowledgeTemplate=';
 const end=';\nconst knowledge=';
 if(code.split(anchor).length!==2||code.split(end).length!==2)throw Error('Knowledge binding anchor changed');
 const start=code.indexOf(anchor)+anchor.length;
 const stop=code.indexOf(end,start);
 if(stop<start)throw Error('Invalid knowledge binding');
 return code.slice(0,start)+JSON.stringify(updateTemplate(JSON.parse(code.slice(start,stop))))+code.slice(stop);
}
module.exports={REVISION,GUIDANCE,updateTemplate,updateNodeCode};
