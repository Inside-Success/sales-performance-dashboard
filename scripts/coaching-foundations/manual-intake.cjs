const {replaceOnce}=require('./parent-workflows.cjs');

const HEADING='MANUAL COACHING ELIGIBILITY';
const SCOPE=`${HEADING} — applies to this manual submission for every show and input type.
Manual feedback is for substantive sales interactions from Call 2 onward. Exclude an initial casting/discovery-only interaction that gathers story, fit or qualifications and ends at internal review, greenlight pending, or booking a future sales call. This includes Reality and Next Level CEO. The official workflow has its own eligibility rules. Judge the entire conversation, including the ending and any real pivot: labels like "casting", introductory questions, an earlier call mentioned in passing, a follow-up booked, or the absence of price, payment or a close are insufficient on their own. A substantive offer, buying decision, selling exchange or a genuine post-greenlight continuation must be assessed on its actual merits, including when the meeting title says Call 1. Unknown offer identity is not an exclusion.
Writer: For a supported exclusion use status="excluded", a specific concise reason, and outcome evidence_ids for what the rep actually did and where the call ended. Keep objections, lessons, next_steps, focus_id and summary empty as required by the report contract.
Reviewer: Check eligibility independently before reviewing prose. If a completed draft is ineligible, return the exceptional envelope {pass:false,findings:[{issue,evidence_ids}],corrected_report:<complete excluded report>}. This overrides only the usual edit-envelope format for that case. Preserve offer_family, show and presentation exactly. Use exact source block IDs for the casting purpose and disposition, clear coaching-only fields (including coverage), and describe the observed ending. The core independently adjudicates that reversal. If an excluded draft clearly contains substantive selling, withhold approval using a source-backed finding. For eligible calls use the normal reviewer envelope and preserve all material objections.`;

function updateManualWorkflow(workflow){
 const next=structuredClone(workflow);
 const node=next.nodes.find(n=>n.name==='MM Manual Build Structured Coaching');
 const anchor='const knowledgeTemplate=';
 const end=';\nconst knowledge=';
 if(next.id!=='BMRrGxHyXMcgO6j3'||!node||node.parameters.jsCode.split(anchor).length!==2||
    node.parameters.jsCode.split(end).length!==2)throw Error('Manual coaching template anchor drift');
 const code=node.parameters.jsCode,start=code.indexOf(anchor)+anchor.length,stop=code.indexOf(end,start);
 const template=JSON.parse(code.slice(start,stop));
 if(template.foundation.includes(HEADING))throw Error('Manual eligibility already set');
 template.foundation+='\n\n'+SCOPE;
 node.parameters.jsCode=code.slice(0,start)+JSON.stringify(template)+code.slice(stop);
 return next;
}

function useResolvedTranscripts(workflow){
 const next=structuredClone(workflow);
 const route=next.connections['Has Transcript']?.main;
 if(route?.[1]?.length!==1||route[1][0].node!=='Fetch Zoom Page')throw Error('Manual Zoom branch drift');
 route[1][0].node='Build Needs Transcript Callback';
 const callback=next.nodes.find(n=>n.name==='Build Needs Transcript Callback');
 callback.parameters.jsCode=replaceOnce(callback.parameters.jsCode,
  'The Zoom link did not expose a downloadable transcript to the workflow.',
  'The Zoom recording has no accessible transcript or a unique match in the archive.');
 return next;
}

module.exports={SCOPE,updateManualWorkflow,useResolvedTranscripts};
