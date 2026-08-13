
const source=$('Apply V7 Selective Review').item.json;
const fail=function(reason,diagnostic){return [{json:{...source,route:'quarantine',quarantineFields:{
  'Quarantine ID':'quarantine-'+source.idempotencyKey,
  'Idempotency Key':source.idempotencyKey,
  'Source Record ID':source.sourceRecordId,
  'Automation Key':source.automationKey,
  'Call Type':source.callType,
  'Assigned Rep Email':source.repEmail,
  'Resolved Rep Label':source.resolvedRepName||'',
  'Reason':reason,
  'Diagnostic JSON':JSON.stringify({meetingStartAt:source.meetingStartAt,sourceRecordId:source.sourceRecordId,...(diagnostic||{})}).slice(0,90000),
  'Scorer Version':source.scorerVersion,
  'Quarantined At':new Date().toISOString(),
  'Resolved':'false'
}}}];};
const assessment=source.finalAssessment;
if(!assessment||typeof assessment!=='object') return fail('v7_model_response_invalid',{message:String(source.materialReviewParseError||source.materialReviewError||source.providerError||'assessment unavailable'),repairAttempted:Boolean(source.needsRepair)});
const reliability=String(assessment?.transcript_reliability?.grade||'');
if(!['gradeable','partially_gradeable','not_gradeable'].includes(reliability)) return fail('v7_invalid_reliability_grade',{reliability});
if(reliability==='not_gradeable') return fail('v7_transcript_not_gradeable',{reason:String(assessment?.transcript_reliability?.reason||''),issues:assessment?.transcript_reliability?.issues||[]});
const opportunityClass=String(assessment?.opportunity?.classification||'unknown');
if(!['viable','limited','not_currently_closable','unknown'].includes(opportunityClass)) return fail('v7_invalid_opportunity_classification',{opportunityClass});
const definitions=Array.isArray(source.dimensionDefinitions)?source.dimensionDefinitions:[];
const requiredKeys=definitions.map(function(row){return row.key;});
const byKey=new Map((Array.isArray(assessment.dimensions)?assessment.dimensions:[]).map(function(row){return [String(row?.key||''),row];}));
if(requiredKeys.some(function(key){return !byKey.has(key);})) return fail('v7_missing_dimension',{missing:requiredKeys.filter(function(key){return !byKey.has(key);})});
const normalize=function(value){return String(value||'').toLowerCase().replace(/\s+/g,' ').replace(/[“”]/g,'"').replace(/[‘’]/g,"'").trim();};
const transcriptNorm=normalize(source.transcript);
const timestampOk=function(value){return /\b(?:\d{1,2}:)?\d{1,2}:\d{2}(?:\.\d+)?\b/.test(String(value||''));};
const allSpeakers=new Set((source.allSpeakerLabels||[]).map(normalize));
const evidenceOk=function(row){const quote=normalize(row?.quote);return timestampOk(row?.timestamp)&&allSpeakers.has(normalize(row?.speaker))&&quote.length>=8&&transcriptNorm.includes(quote);};
const validEvidence=function(rows){return (Array.isArray(rows)?rows:[]).filter(evidenceOk).map(function(row){return {timestamp:String(row.timestamp||''),speaker:String(row.speaker||''),quote:String(row.quote||'')};});};
const statusPoints={exceptional:100,strong:84,competent:68,partial:45,weak:20,missed:0,harmful:0};
const scoredStatuses=new Set(Object.keys(statusPoints));
const coverageValues=new Set(['complete','mostly_complete','partial','missed']);
const specificityValues=new Set(['tailored','specific','generic','absent']);
const gapValues=new Set(['none','minor','major','harmful']);
const deriveStatus=function(requested,coverage,specificity,materialGap,confidence,evidence,counterevidence){
  if(materialGap==='harmful'||requested==='harmful') return 'harmful';
  if(coverage==='missed'||requested==='missed') return 'missed';
  if(materialGap==='major') return coverage==='partial'?'weak':'partial';
  if(coverage==='partial') return requested==='weak'?'weak':'partial';
  if(coverage==='mostly_complete'||materialGap==='minor'||specificity==='generic') return 'competent';
  if(coverage==='complete'&&materialGap==='none'&&['specific','tailored'].includes(specificity)&&confidence==='high'&&!counterevidence.length){
    if(requested==='exceptional'&&evidence.length>=2) return 'exceptional';
    return 'strong';
  }
  if(coverage==='complete'&&materialGap==='none'&&specificity!=='absent') return 'competent';
  if(specificity==='absent') return 'missed';
  return scoredStatuses.has(requested)?requested:'not_observable';
};
const dimensions=[];
const warnings=[];
let weighted=0;
let denominator=0;
let applicableCount=0;
for(const definition of definitions){
  const raw=byKey.get(definition.key)||{};
  let applicability=String(raw.applicability||'applicable');
  if(!['applicable','not_applicable','not_observable'].includes(applicability)) applicability='applicable';
  const rawCriteria=new Map((Array.isArray(raw.criteria)?raw.criteria:[]).map(function(c){return [String(c?.id||''),c];}));
  const criteria=[];
  let criterionWeighted=0;
  let criterionDenominator=0;
  for(const criterionDef of (definition.criteria||[])){
    const rawCriterion=rawCriteria.get(criterionDef.id)||{};
    const requestedStatus=String(rawCriterion.status||'not_observable');
    let status=requestedStatus;
    const confidence=String(rawCriterion.confidence||'low');
    const evidence=validEvidence(rawCriterion.evidence);
    const counterevidence=validEvidence(rawCriterion.counterevidence);
    const coverage=coverageValues.has(String(rawCriterion.coverage||''))?String(rawCriterion.coverage):requestedStatus==='missed'?'missed':['partial','weak'].includes(requestedStatus)?'partial':['exceptional','strong'].includes(requestedStatus)?'complete':requestedStatus==='competent'?'mostly_complete':'not_observable';
    const specificity=specificityValues.has(String(rawCriterion.specificity||''))?String(rawCriterion.specificity):['exceptional','strong'].includes(requestedStatus)?'specific':requestedStatus==='competent'?'generic':['partial','weak'].includes(requestedStatus)?'generic':requestedStatus==='missed'?'absent':'not_observable';
    const materialGap=gapValues.has(String(rawCriterion.material_gap||''))?String(rawCriterion.material_gap):requestedStatus==='harmful'?'harmful':['weak','missed'].includes(requestedStatus)?'major':requestedStatus==='partial'?'minor':'none';
    if(!['exceptional','strong','competent','partial','weak','missed','harmful','not_applicable','not_observable'].includes(status)) status='not_observable';
    if(['exceptional','strong','competent','partial','weak','missed','harmful'].includes(status)&&(!evidence.length||confidence==='low')){
      warnings.push(definition.key+'.'+criterionDef.id+': excluded because '+(!evidence.length?'exact evidence did not validate':'confidence was low')+'.');
      status='not_observable';
    }
    if(scoredStatuses.has(status)) status=deriveStatus(status,coverage,specificity,materialGap,confidence,evidence,counterevidence);
    const cWeight=Number(criterionDef.weight)||0;
    const criterionPoints=Object.prototype.hasOwnProperty.call(statusPoints,status)?statusPoints[status]:null;
    if(criterionPoints!==null){
      criterionWeighted+=criterionPoints*cWeight;
      criterionDenominator+=cWeight;
    }
    criteria.push({id:criterionDef.id,label:criterionDef.label,weight:cWeight,status,requestedStatus,coverage,specificity,materialGap,consensusPoints:criterionPoints,primaryStatus:String(rawCriterion.primaryStatus||''),secondStatus:String(rawCriterion.secondStatus||''),confidence,reason:String(rawCriterion.reason||''),evidence,counterevidence});
  }
  if(applicability==='not_applicable'){
    for(const criterion of criteria) if(!['not_applicable','not_observable'].includes(criterion.status)) applicability='applicable';
  }
  if(source.callType==='Call 2+'&&definition.key==='contract_payment_onboarding'){
    const facts=assessment.decision_facts?.transaction||{};
    const transactionEvidence=validEvidence(facts.evidence);
    const transactionReached=transactionEvidence.length>0&&(facts.payment_completed===true||facts.deposit_confirmed===true||facts.agreement_confirmed===true);
    if(!transactionReached&&opportunityClass!=='viable') applicability='not_applicable';
    if(transactionReached) applicability='applicable';
  }
  let points=null;
  let rating='not_scored';
  if(applicability==='applicable'&&criterionDenominator>=0.50){
    points=Math.round((criterionWeighted/criterionDenominator)*10)/10;
    rating=points>=95?'exceptional':points>=82?'strong':points>=65?'competent':points>=42?'partial':points>=18?'weak':'missed_or_harmful';
    weighted+=points*Number(definition.weight||0);
    denominator+=Number(definition.weight||0);
    applicableCount+=1;
  }else if(applicability==='applicable'){
    warnings.push(definition.key+': excluded because fewer than 50% of criterion weights had validated evidence.');
    applicability='not_observable';
  }
  dimensions.push({key:definition.key,label:definition.label,weight:Number(definition.weight)||0,applicability,rating,points,controllability:'rep_controlled',confidence:criterionDenominator>=0.75?'high':criterionDenominator>=0.30?'medium':'low',reason:String(raw.reason||''),evidence:criteria.flatMap(function(c){return c.evidence;}).slice(0,12),counterevidence:criteria.flatMap(function(c){return c.counterevidence;}).slice(0,12),criteria,criterionDenominator:Math.round(criterionDenominator*1000)/1000});
}
const minimumDimensions=source.callType==='Call 1'?4:5;
if(applicableCount<minimumDimensions||denominator<0.55) return fail('v7_insufficient_valid_dimensions',{reliability,applicableCount,minimumDimensions,weightDenominator:denominator,warnings});
const rawComposite=Math.round((weighted/denominator)*10)/10;
const facts=assessment.decision_facts&&typeof assessment.decision_facts==='object'?assessment.decision_facts:{};
const follow=facts.follow_up&&typeof facts.follow_up==='object'?facts.follow_up:{};
const transaction=facts.transaction&&typeof facts.transaction==='object'?facts.transaction:{};
const followEvidence=validEvidence(follow.evidence);
const transactionEvidence=validEvidence(transaction.evidence);
let outcomeClass=String(assessment?.outcome?.classification||'unknown');
if(source.callType==='Call 2+'){
  const sale=transactionEvidence.length>0&&transaction.payment_completed===true&&transaction.agreement_confirmed===true;
  const deposit=transactionEvidence.length>0&&transaction.deposit_confirmed===true;
  const concrete=followEvidence.length>0&&(follow.agreed_time===true||(follow.specific_action===true&&String(follow.owner||'').trim()&&String(follow.deadline||'').trim()));
  if(sale) outcomeClass='sale';
  else if(deposit) outcomeClass='deposit';
  else if(concrete) outcomeClass='concrete_follow_up';
  else if(!['intentional_rejection','lost'].includes(outcomeClass)) outcomeClass='unknown';
}else outcomeClass='unknown';
const outcome={...(assessment.outcome&&typeof assessment.outcome==='object'?assessment.outcome:{}),classification:outcomeClass,evidence:validEvidence(assessment?.outcome?.evidence)};
const validateFindings=function(rows){return (Array.isArray(rows)?rows:[]).flatMap(function(row){const label=String(row?.label||'').trim();const evidence=validEvidence(row?.evidence);return label&&evidence.length?[{label,reason:String(row?.reason||''),evidence}]:[];});};
const rawFindings=assessment.findings&&typeof assessment.findings==='object'?assessment.findings:{};
const strengths=validateFindings(rawFindings.strengths);
const improvements=validateFindings(rawFindings.improvements);
const allowedRisks=new Set(['deception','coercion','clear_refusal_ignored','material_terms_misrepresented','other']);
const criticalFindings=(Array.isArray(rawFindings.critical_findings)?rawFindings.critical_findings:[]).flatMap(function(row){
  const label=String(row?.label||'').trim();
  const riskType=String(row?.risk_type||'');
  const repEvidence=validEvidence(row?.rep_evidence||row?.evidence);
  const reactionEvidence=validEvidence(row?.prospect_reaction_evidence);
  if(!label||!allowedRisks.has(riskType)||String(row?.material_impact||'')!=='demonstrated'||!repEvidence.length||!reactionEvidence.length) return [];
  return [{label,risk_type:riskType,material_impact:'demonstrated',reason:String(row?.reason||''),evidence:repEvidence,prospect_reaction_evidence:reactionEvidence}];
});
const criticalScoreCap=criticalFindings.length?59:100;
const composite=Math.min(rawComposite,criticalScoreCap);
let deterministicDisposition=String(assessment?.opportunity?.correct_disposition||'unknown');
if(source.callType==='Call 1'){
  deterministicDisposition=opportunityClass==='viable'?'advance':opportunityClass==='limited'?'follow_up':opportunityClass==='not_currently_closable'?'decline':'unknown';
}
const deterministicOpportunity={...(assessment.opportunity&&typeof assessment.opportunity==='object'?assessment.opportunity:{}),correct_disposition:deterministicDisposition};
const finalBand=composite<40?'Unacceptable':composite<60?'Needs Improvement':composite<75?'Developing':composite<90?'Meets Expectations':'Excellent';
const now=new Date().toISOString();
const assessmentId='assessment-'+source.idempotencyKey;
const concernStatuses=new Set(['partial','weak','missed','harmful']);
const lowDimensions=dimensions.filter(function(row){return row.points!==null&&row.points<65;}).sort(function(a,b){return a.points-b.points;});
const derivedImprovements=lowDimensions.slice(0,3).map(function(row){const weakCriteria=row.criteria.filter(function(c){return concernStatuses.has(c.status);}).sort(function(a,b){return (a.consensusPoints??101)-(b.consensusPoints??101);});const evidence=weakCriteria.flatMap(function(c){return c.evidence;}).slice(0,3);return {label:row.label,reason:weakCriteria[0]?.reason||row.reason||'This dimension fell below the competent execution anchor.',evidence,observations:weakCriteria.map(function(c){return {criterion:c.label,status:c.status,reason:c.reason};})};});
const supportedImprovements=derivedImprovements.length?derivedImprovements:improvements;
const behaviourChecks=dimensions.flatMap(function(dimension){return dimension.criteria.filter(function(c){return concernStatuses.has(c.status);}).map(function(c){return {name:c.label,status:c.status,dimension:dimension.label,reason:c.reason,evidence:c.evidence.slice(0,2)};});});
const mainFinding=criticalFindings[0]?.label||supportedImprovements[0]?.label||strengths[0]?.label||String(rawFindings.main_finding||'No supported priority finding.');
const context={
  transcript_reliability:assessment.transcript_reliability,
  opportunity:deterministicOpportunity,
  outcome,
  decision_facts:facts,
  external_factors:Array.isArray(assessment.external_factors)?assessment.external_factors.map(String):[],
  findings:{main_finding:mainFinding,strengths,improvements:supportedImprovements,critical_findings:criticalFindings},
  call_context:assessment.call_context||{},
  material_adjudication:{required:Boolean(source.materialReviewRequired),applied:Boolean(source.adjudicationApplied),reason:String(source.materialReviewReason||''),error:String(source.materialReviewError||''),rationale:String(source.adjudicationResponse?.rationale||'')},
  validation:{status:'verified_v7_1_structured_criteria',repairAttempted:Boolean(source.needsRepair),warnings,applicableCount,minimumDimensions,weightDenominator:denominator,criterionPoints:statusPoints,structuredDerivation:'coverage+specificity+material_gap+confidence+evidence',outcomeDerivedDeterministically:true,call1DispositionDerivedDeterministically:true,criticalGate:'selective_verifier+risk+rep_evidence+demonstrated_reaction',rawComposite,criticalScoreCap},
  attribution:{assignedRepEmail:source.repEmail,assignedRepName:source.repName,resolvedRepEmail:source.resolvedRepEmail,resolvedRepName:source.resolvedRepName,substituted:Boolean(source.attributionSubstituted),method:source.speakerResolutionMethod,confidence:source.speakerResolutionConfidence,allowedSpeakerLabels:source.resolvedSpeakerLabels,diagnostic:source.speakerResolutionDiagnostic},
  calibration:{round:String(source.calibrationRound||''),sampleReason:String(source.sampleReason||''),sourceV6:source.sourceV6||{},sourceV5:source.sourceV5||{}}
};
const scoreFields={
  'Assessment ID':assessmentId,'Idempotency Key':source.idempotencyKey,'Source Base ID':source.sourceBaseId,'Source Table ID':source.sourceTableId,'Source Record ID':source.sourceRecordId,'Automation Key':source.automationKey,'Zoom Meeting UUID':source.zoomMeetingUuid,'Recording File ID':source.recordingFileId,'Transcript Google Doc ID':source.docId,'Transcript URL':source.transcriptUrl,'Meeting Start At':source.meetingStartAt,'Show Name':source.showName,'Show Family':source.showName,'Call Type':source.callType,'Call Stage':source.callType==='Call 1'?'progression_decision':'execution_and_outcome','Scored Rep ID':source.resolvedRepEmail,'Scored Rep Email':source.resolvedRepEmail,'Scored Rep Label':source.resolvedRepName,'Airtable Rep Email':source.repEmail,'Airtable Rep Name':source.repName,'Attribution Substituted':String(Boolean(source.attributionSubstituted)),'Speaker Resolution Method':source.speakerResolutionMethod,'Speaker Resolution Confidence':source.speakerResolutionConfidence,'Status':'scored','Composite Score':composite,'Display Band':finalBand,'Dimensions JSON':JSON.stringify(dimensions),'Behaviour Checks JSON':JSON.stringify(behaviourChecks).slice(0,90000),'Critical Events JSON':JSON.stringify(criticalFindings),'Call Context JSON':JSON.stringify(context).slice(0,90000),'Observations JSON':JSON.stringify(supportedImprovements).slice(0,90000),'Evidence JSON':JSON.stringify(dimensions.flatMap(function(row){return row.evidence;})).slice(0,90000),'Raw Model Response JSON':JSON.stringify({assessment:source.finalAssessment,primaryAssessment:source.primaryParsed,repairResponse:source.repairResponse,materialReview:source.adjudicationResponse}).slice(0,90000),'Applicable Dimensions':applicableCount,'Weight Denominator':denominator,'Internal Inconsistency':'false','Scorer Version':source.scorerVersion,'Prompt Version':source.promptVersion,'Rubric Version':source.rubricVersion,'Weights Version':source.weightsVersion,'Band Points Version':source.bandPointsVersion,'Model':source.model,'Model Params Hash':'v7.1-structured-exceptional100-strong84-competent68-partial45-weak20-missed0-temperature0-selective-verifier','Config Version':source.configVersion,'Scored At':now,'Created At':now
};
const usage=[source.primaryResponse?.usage,source.repairResponse?.usage,source.materialReviewProviderResponse?.usage].reduce(function(sum,row){return {prompt_tokens:sum.prompt_tokens+(Number(row?.prompt_tokens)||0),completion_tokens:sum.completion_tokens+(Number(row?.completion_tokens)||0),total_tokens:sum.total_tokens+(Number(row?.total_tokens)||0),prompt_cache_hit_tokens:sum.prompt_cache_hit_tokens+(Number(row?.prompt_cache_hit_tokens)||0),prompt_cache_miss_tokens:sum.prompt_cache_miss_tokens+(Number(row?.prompt_cache_miss_tokens)||0)};},{prompt_tokens:0,completion_tokens:0,total_tokens:0,prompt_cache_hit_tokens:0,prompt_cache_miss_tokens:0});
return [{json:{...source,route:'scored',assessmentId,providerUsage:usage,scoreFields}}];
