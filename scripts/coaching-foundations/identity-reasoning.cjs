// Opt-in source identity boundary; no network or production defaults.
const prior=require('./interaction-reasoning.cjs');
const record=require('../../src/lib/foundations-record.cjs');
const VERSION='interaction-identity-v1';
const IDENTITY=`SOURCE IDENTITY RESPONSIBILITY:
Add offer_identity:{family:"main_istv|next_level_ceo|reality|mixed|unknown",show:string,reason:string,evidence:[{id,text}]} to the analysis. Identify the offer actually under discussion, not a celebrity example, comparison, past appearance, video producer biography or rejected alternative. Generic Inside Success branding, price/tier and a celebrity name cannot establish a family. Documentary format alone cannot distinguish regular documentary from Next Level CEO. Use unknown when the source does not establish that distinction. Unknown is valid evidence restraint, not a report exclusion. Mixed means multiple live offers are genuinely being considered, not incidental mentions. Explicit current-show identification or clear current reality-format/competition description can resolve a family. Consider conflicting metadata and the entire ending, not a keyword count. Evidence contains short exact excerpts from supplied T blocks; metadata alone cannot resolve a family. For a resolved family supply at least one direct identifying source excerpt; explain why it identifies the current offer. Use show="Unknown" if the specific name is not established. Never normalize a possibly mistranscribed celebrity into a show name.`;
const ANALYST_SYSTEM=prior.ANALYST_SYSTEM.replaceAll(prior.VERSION,VERSION)+'\n'+IDENTITY;
function analystSystem(options){if(!options.identityCatalog)return ANALYST_SYSTEM;const c=require('./identity-catalog.cjs');if(options.identityCatalog!==c.VERSION)throw Error('Unknown identity catalog');return ANALYST_SYSTEM+'\n'+c.TEXT;}
function validateAnalysis(a,blocks){
 a=structuredClone(a);
 prior.validateAnalysis({...a,version:prior.VERSION},blocks);
 const i=a.offer_identity;
 if(a.version!==VERSION||!i||!['main_istv','next_level_ceo','reality','mixed','unknown'].includes(i.family)||typeof i.show!=='string'||!i.show.trim()||typeof i.reason!=='string'||!i.reason.trim()||!Array.isArray(i.evidence)||i.evidence.length>12)throw Error('Invalid source identity');
 if(i.family!=='unknown'&&!i.evidence.length)throw Error('Identity requires direct source evidence');
 const issues=[];
 i.evidence=i.evidence.map((q,index)=>{try{return require('./source-quote.cjs').resolve(q,blocks);}catch(error){issues.push({path:'offer_identity.evidence.'+index,block_id:q?.id,message:error.message});return q;}});
 if(issues.length){const error=new Error('Unbound identity evidence');error.code='ANALYST_IDENTITY_EVIDENCE';error.issues=issues;throw error;}
 return a;
}
const SCOPE=`OFFER IDENTITY AUTHORITY:
The source identity below governs policy applicability, not the sales philosophy. Verify it against the full call. Do not silently choose another family from prices, generic branding, a celebrity name, or prior report labels. If direct source evidence contradicts the bound identity, report the conflict for a hold; do not conceal it to produce an accepted report. Distinguish historical examples and alternative offers from the current offer. Keep report.offer_family equal to the bound family. This decision is private metadata, not a new report section.`;
const LIMITED=`LIMITED OFFER KNOWLEDGE: The current family is unresolved or mixed; family-specific governed facts have been withheld. Return offer_family as bound below. Coach the interaction from the complete source: needs, questions, constructive alternatives, rep responses, recovery, selling judgment, actual payment and commitments. You may faithfully describe quoted amounts/claims as what the participants said, but must not certify or correct specific prices, benefits, discounts, deadlines, rights, deposits, guarantees or contractual consequences by importing a presumed family rule. Do not invent policy, or remove meaningful buyer needs. Where an unresolved term materially affects the decision, recommend verifying that term with the appropriate source instead of asserting the answer. Do not turn this into a generic report-wide disclaimer. Familiar rules/examples in the retained author prompt are not authority to fill missing offer facts. Lack of offer identity alone is not grounds for exclusion or withholding otherwise useful, source-supported coaching.`;
function bind(state){
 const identity=state.analysis.offer_identity,limited=['unknown','mixed'].includes(identity.family);
 const open='\n<governed_offer_knowledge>\n',close='\n</governed_offer_knowledge>\n';
 let system=state.system;
 if(limited){const at=system.indexOf(open),end=system.indexOf(close);if(at<0||end<at||system.split(open).length!==2||system.split(close).length!==2)throw Error('Missing scoped knowledge boundary');system=system.slice(0,at)+system.slice(end+close.length);}
 // Fixed field order survives JSONB receipt roundtrips and preserves the normal
 // original analyst schema order. Object insertion order is not source evidence.
 const identityText=JSON.stringify({family:identity.family,show:identity.show,reason:identity.reason,evidence:identity.evidence.map(({id,text})=>({id,text}))});
 system+='\n'+SCOPE+'\n'+(limited?LIMITED:'Apply only the bound family and explicitly supported alternative-offer conditions from the governed sources.')+'\nBOUND SOURCE IDENTITY:\n'+identityText;
 const prepared=record.prepare({sourceId:state.prepared.sourceId,blocks:state.prepared.blocks,policyRevision:state.prepared.policyRevision+':identity:'+record.digest(identity),policyText:system});
 prepared.knowledgeManifest={...state.prepared.knowledgeManifest,identity:{version:VERSION,...identity,limited,...(state.reasoning?.identityCatalog?{catalog:state.reasoning.identityCatalog,catalog_digest:record.digest(require('./identity-catalog.cjs').TEXT)}:{}),original_policy_hash:state.prepared.policyHash}};
 return {...state,system,prepared};
}
function assertReport(report,analysis){if(report.offer_family!==analysis.offer_identity.family)throw Error('Report identity differs from source-bound policy');}
function materializeReview(draft,audit,analysis,blocks){const out=prior.materializeReview(draft,audit,analysis,blocks);assertReport(out.corrected_report||draft,analysis);return out;}
function editGuidance(a){return prior.editGuidance(a)+'\nCheck the bound show identity independently against the complete source. A genuine direct-source contradiction must be held, not normalized away. In limited knowledge mode check every recommendation for unsupported family-specific facts, without deleting source-grounded selling advice. Tighten repeated explanation within each insight; preserve every necessary distinction, not a word-count target.';}
module.exports={VERSION,ANALYST_SYSTEM,analystSystem,validateAnalysis,editGuidance,materializeReview,bind,assertReport};
