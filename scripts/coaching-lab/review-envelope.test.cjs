const {test}=require('node:test'),assert=require('node:assert/strict');
const {bindInput,accept,preview}=require('./review-envelope.cjs');
const {schema}=require('./contract.cjs');
const blocks=[{id:'T0001',text:'Buyer: I will decide tomorrow.'}];
const draft={...schema,status:'completed',offer_family:'reality',show:'Test',outcome:{payment:'not_confirmed',text:'A decision is pending.',evidence_ids:['T0001']},objections:[],lessons:[],next_steps:[],focus_id:''};
const audit={pass:true,findings:[],corrected_report:null};
const receipt=(id,body)=>({ok:true,request_id:id,provider_response_id:'response-'+id,parsed_json:body,usage:{input_tokens:1},costs:{total_cost_usd:0.01},stop_reason:'stop'});
function input(channel='official'){return {binding:bindInput({sourceId:'source',blocks,policyHash:'policy',promptHash:'prompt',channel}),blocks,draft,audit,writerReceipt:receipt('writer',draft),reviewReceipt:receipt('review',audit),expectedWriterRequest:'writer',expectedReviewRequest:'review'};}
test('manual and official previews use the same reviewed object without implying delivery acceptance',()=>{
 const a=accept(input()),b=accept(input('manual'));assert.equal(preview(a,blocks),preview(b,blocks));assert.equal(a.acceptedForDelivery,false);assert.equal(a.readyForSafety,true);
 a.report.outcome.text='Paid';assert.throws(()=>preview(a,blocks),/Stale/);
});
test('wrong source, wrong receipt, truncation and post-receipt mutations are held',()=>{
 const x=input();assert.throws(()=>accept({...x,blocks:[{id:'T0001',text:'Different call'}]}),/Source/);
 assert.throws(()=>accept({...x,expectedReviewRequest:'other'}),/receipt/);
 assert.throws(()=>accept({...x,reviewReceipt:{...x.reviewReceipt,stop_reason:'length'}}),/receipt/);
 assert.throws(()=>accept({...x,draft:{...draft,show:'Other'}}),/content/);
 const flipped={pass:false,findings:[{issue:'Not enough evidence',evidence_ids:['T0001']}],corrected_report:{...draft,status:'excluded',exclusion_reason:'Unusable'}};
 assert.throws(()=>accept({...x,audit:flipped,reviewReceipt:receipt('review',flipped)}),/Eligibility/);
});
