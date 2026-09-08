const {test}=require('node:test');const assert=require('node:assert/strict');
const {transcriptBlocks,renderCoaching,applyAudit,applyAuditConsensus,applySingleAudit}=require('./structured-coaching.cjs');
const blocks=transcriptBlocks('[00:01:00.000] Rep: The amount is explained.\n[00:02:00.000] Buyer: Please clarify that amount.');
const analysis=()=>({status:'completed',call_status:'scored',refusal_reason:null,outcome:{payment:'not_confirmed',summary:'No payment confirmed.',evidence_ids:['T0002']},payment_actions:[{action:'Amount explained.',evidence_ids:['T0001']}],strengths:[{observation:'Explained an amount.',why_useful:'Made the offer concrete.',evidence_ids:['T0001']}],improvements:[{priority:'material',observation:'Did not reclarify after the later question; an amount was already explained.',evidence_ids:['T0002'],counterevidence_ids:['T0001'],counterevidence_summary:'The amount was already stated.',possible_effect:'Could leave uncertainty.',better_action:'Clarify the amount.',example:'Invented promise: pay $1 next year.'}],blockers:[],next_steps:[]});
const audit=()=>({outcome_pass:true,rejected_strengths:[],rejected_improvements:[],rejected_examples:[],rejected_blockers:[],rejected_next_steps:[],findings:[],improvement_reviews:[{index:0,verdict:'keep',counterevidence_ids:['T0001'],reason:'Earlier explanation credited.'}]});
test('keeps later clarification distinct from an earlier explanation and excludes hypothetical promises',()=>{
 const r=renderCoaching(applyAudit(analysis(),audit(),blocks),blocks);assert.match(r.what_to_improve,/already explained/);assert.doesNotMatch(JSON.stringify(r),/pay \$1 next year/);assert.equal(r.coaching_tip,'Clarify the amount.');assert.match(r.what_made_this_close_work,/No completed payment/);
});
test('rejects hallucinated source references before rendering',()=>{const a=analysis();a.improvements[0].counterevidence_ids=['T9999'];assert.throws(()=>renderCoaching(a,blocks),/reference/)});
test('auditor can remove an invented fault without losing a supported strength',()=>{const a=audit();a.rejected_improvements=[0];a.improvement_reviews[0].verdict='reject';const r=renderCoaching(applyAudit(analysis(),a,blocks),blocks);assert.match(r.what_to_improve,/No additional coaching recommendation/);assert.match(r.biggest_strength,/Explained an amount/)});
test('fails closed on missing, conflicting or out-of-range audits',()=>{for(const mutate of [a=>a.outcome_pass=false,a=>a.improvement_reviews=[],a=>a.rejected_improvements=[0],a=>a.rejected_strengths=[9]]){const a=audit();mutate(a);assert.throws(()=>applyAudit(analysis(),a,blocks))}});
test('supports manual transcripts without timestamps and does not invent timestamps',()=>{const b=transcriptBlocks('Rep: An offer.\n\nBuyer: A question.');assert.equal(b.length,2);const r=renderCoaching(analysis(),b);assert.doesNotMatch(r.what_to_improve,/00:/)});
test('preserves refusal and rejects inconsistent eligibility states',()=>{const r=renderCoaching({status:'refused',call_status:'call_1',refusal_reason:'Discovery only.'},[]);assert.equal(r.status,'refused');const a=analysis();a.call_status='call_1';assert.throws(()=>renderCoaching(a,blocks))});

test('independent reviews use rejection union and never manufacture a finding',()=>{const a=analysis();a.improvements[0].priority='optional';const first=audit(),second=audit();second.rejected_improvements=[0];second.improvement_reviews[0].verdict='reject';const r=renderCoaching(applyAuditConsensus(a,first,second,blocks),blocks);assert.match(r.what_to_improve,/No additional coaching recommendation/);assert.match(r.biggest_strength,/Explained an amount/);});
test('single review preserves rejection from either redundant representation',()=>{
 for(const field of ['index','verdict']){const a=audit();if(field==='index')a.rejected_improvements=[0];else a.improvement_reviews[0].verdict='reject';const result=applySingleAudit(analysis(),a,blocks);assert.equal(result.improvements.length,0);assert.equal(result.strengths.length,1);}
});
test('single review still fails closed on invalid evidence, incomplete review or wrong outcome',()=>{
 for(const mutate of [a=>a.outcome_pass=false,a=>a.improvement_reviews=[],a=>a.improvement_reviews[0].counterevidence_ids=['T9999'],a=>a.rejected_improvements=[99]]){const a=audit();mutate(a);assert.throws(()=>applySingleAudit(analysis(),a,blocks));}
});
test('a missing strength explanation preserves the cited observation without inventing a benefit',()=>{const a=analysis();delete a.strengths[0].why_useful;const r=renderCoaching(applySingleAudit(a,audit(),blocks),blocks);assert.equal(r.biggest_strength,'Explained an amount. [00:01:00.000]');});
test('factual reviewer can correct an outcome using only valid transcript evidence',()=>{const a=audit();a.outcome_pass=false;a.corrected_outcome={payment:'confirmed',summary:'Rep explicitly confirmed receipt on the call.',evidence_ids:['T0002']};const r=applySingleAudit(analysis(),a,blocks);assert.equal(r.outcome.payment,'confirmed');a.corrected_outcome.evidence_ids=['T9999'];assert.throws(()=>applySingleAudit(analysis(),a,blocks),/correction/);});
test('material-only publication omits optional polish without erasing supported strengths',()=>{const a=analysis();a.improvements[0].priority='optional';const r=renderCoaching(a,blocks,{materialOnly:true});assert.match(r.what_to_improve,/No additional coaching recommendation/);assert.match(r.biggest_strength,/Explained an amount/);assert.equal(a.improvements.length,1);});
test('publication blocks invented payment holds and written delivery commitments but keeps clarification',()=>{
 for(const action of ['Ask for a smaller initial commitment.','Confirm an option to keep the spot active while the buyer consults their team.','Put the timeline commitment in writing in the invoice.']){const a=analysis();a.improvements[0].better_action=action;assert.match(renderCoaching(a,blocks,{excludePolicyChanges:true}).what_to_improve,/No additional coaching recommendation/);}
 assert.match(renderCoaching(analysis(),blocks,{excludePolicyChanges:true}).what_to_improve,/Clarify the amount/);
});

test("an empty recommendation is not a blanket compliance clearance",()=>{const a=analysis();a.improvements=[];const r=renderCoaching(a,blocks);assert.equal(r.what_to_improve,"No additional coaching recommendation met the evidence threshold for this report.");assert.doesNotMatch(r.coaching_tip,/no corrective|no mistake/i);});

test('audit and rendering work without a structuredClone global in a fresh runtime',()=>{
 const vm=require('node:vm'),fs=require('node:fs');const context={module:{exports:{}}};
 vm.runInNewContext(fs.readFileSync(require.resolve('./structured-coaching.cjs'),'utf8'),context);
 const lib=context.module.exports,a=analysis(),review=audit();
 const result=lib.applySingleAudit(a,review,blocks);
 assert.equal(lib.renderCoaching(result,blocks).status,'completed');
 result.outcome.summary='Changed copy';assert.notEqual(a.outcome.summary,result.outcome.summary);
 assert.equal(lib.cloneCoachingJson(undefined),undefined);
 assert.equal(JSON.stringify(lib.cloneCoachingJson({n:null,arr:[1,{ok:true}],text:'é'})),JSON.stringify({n:null,arr:[1,{ok:true}],text:'é'}));
});

test('reviewer can downgrade optional polish but cannot upgrade a writer priority',()=>{
 const blocks=[{id:'T0001',timestamp:'00:00:01',text:'Test'}];
 const analysis={status:'completed',call_status:'scored',outcome:{payment:'not_confirmed',summary:'No payment confirmed.',evidence_ids:['T0001']},payment_actions:[],strengths:[],improvements:[{priority:'material',observation:'A preference.',evidence_ids:['T0001'],counterevidence_ids:[],counterevidence_summary:'Checked',possible_effect:'May help.',better_action:'Clarify.'}],blockers:[],next_steps:[]};
 const audit={outcome_pass:true,rejected_strengths:[],rejected_improvements:[],rejected_examples:[],rejected_blockers:[],rejected_next_steps:[],findings:[],improvement_reviews:[{index:0,verdict:'keep',materiality:'optional',reason:'Preference only',counterevidence_ids:[]}]};
 const output=applySingleAudit(analysis,audit,blocks);
 assert.equal(output.improvements[0].priority,'optional');
 assert.equal(renderCoaching(output,blocks,{materialOnly:true}).what_id_polish,'No additional coaching recommendation met the evidence threshold for this report.');
});
