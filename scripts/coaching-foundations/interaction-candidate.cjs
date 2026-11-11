// Explicit lab composer; retained author source and governed facts remain pinned.
const fs=require('node:fs'),path=require('node:path');
const base=require('./prompts.cjs'),layered=require('./layered-candidate.cjs'),selection=require('./lesson-selection.cjs');
const {digest}=require('../../src/lib/coaching-canonical.cjs');
function compose(source,layers){
 const built=base.compose(source,layers);let system=built.system;
 // Remove the obsolete lab schema/adapter, keeping the current v3 contract only.
 const start=system.indexOf('REPORT ADAPTER:'),end=system.indexOf(selection.LESSON_SELECTION,start);
 if(start<0||end<start)throw Error('Unknown adapter boundary');
 system=system.slice(0,start)+system.slice(end);
 for(const boundary of [base.PRESENTATION,selection.COACHING_SCOPE])if(system.split(boundary).length!==2)throw Error('Unrecognized interaction instruction boundary');
 const modules=layered.IDS.map(id=>({id,text:fs.readFileSync(path.join(__dirname,'layers',id+'.md'),'utf8')}));
 // Authority and four owning modules replace the presentation slot, not append a second layout.
 system=system.replace(base.PRESENTATION,[layered.AUTHORITY,...modules.map(x=>x.text),layered.PRESENTATION].join('\n'));
 const old='For sound or uncertain handling, keep corrective advice and example empty. Teaching may explain the sound move or a conditional trade-off, but cannot imply a correction unsupported by evidence.';
 if(system.split(old).length!==2)throw Error('Unknown sound-handling adapter');
 system=system.replace(old,'For sound or uncertain objection handling, teaching and example are empty. A distinct useful principle may appear as a lesson without implying a rep defect.');
 // Resolve the known scope conflict at its origin; do not require demonstrated causation.
 system=system.replace(selection.COACHING_SCOPE,selection.COACHING_SCOPE.replace('When the full exchange shows that a materially inaccurate representation shaped the buyer\'s understanding, decision, or next step, coach that demonstrated interaction:', 'When a materially inaccurate representation creates a consequential expectation in this interaction, coach the supported representation without asserting it caused the decision:'));
 system=system.replaceAll('"presentation":"tyler-review-v1"','"presentation":"tyler-review-v2"').replace('Two-sentence coaching snapshot; empty for excluded calls','Exactly two lines: truthful learning hook then plain subheadline; empty for excluded calls');
 const editorial=fs.readFileSync(path.join(__dirname,'layers/editorial.md'),'utf8');system+='\n'+editorial;
 const manifest={revision:'interaction-coaching-v1',source:built.manifest.source_sha256,modules:modules.map(x=>({id:x.id,digest:digest(x.text)})),system:digest(system),adaptations:['single-current-report-contract','single-current-presentation','sound-handling-no-hidden-advice','no-causal-proof-required-for-material-misrepresentation','source-map-before-selection']};
 return {system,manifest,knowledgeTemplate:{...require('./knowledge.cjs').template(system,layers),coachingView:require('./coaching-knowledge-view.cjs').VERSION},reasoning:{version:'interaction-reasoning-v1',analyst:true}};
}
module.exports={compose};
