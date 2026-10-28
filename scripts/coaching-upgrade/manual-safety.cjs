// The manual workflow has a local repair branch, not another AI stage.
function manualLocalSafetyRepairs(state) {
  const screen=state.safety_screen;
  if(screen?.case_pass!==true||['unsupported_specifics','collisions','additional_safety_hits'].some(k=>!Array.isArray(screen[k])||screen[k].length))throw Error('Enhanced coaching safety hold: substantive repair requires review');
  return (state.repair_targets||[]).map(target=>{
    // Remove only this certification adjective from future-action advice. Never
    // rewrite a historical response, evidence, a numeric term or classification.
    if(target.layer!=='L1'||target.rule!=='certification'||! /^(objections\.\d+\.(recommendation|suggested_words)|next_steps\.\d+\.observation)$/.test(target.path)||typeof target.before!=='string'||! /\bapproved (?:payment )?plan\b/i.test(target.before))throw Error('Enhanced coaching safety hold: unsupported local repair');
    return {id:target.id,operation:'replace',after:target.before.replace(/\b(?:(?:exact|current)\s+)?approved (?=(?:payment )?plan\b)/gi,'current '),reason:'local_certification_wording'};
  });
}
module.exports={manualLocalSafetyRepairs};
