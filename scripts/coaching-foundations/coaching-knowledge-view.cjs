// Explicit coaching-only projection. Original source stays in receipts, never overwritten.
const {digest}=require('../../src/lib/coaching-canonical.cjs');
const rules=require('./coaching-knowledge-rules.json');
const VERSION='coaching-facts-2026-11-11-v1';
function project(text){
 if(typeof text!=='string')throw Error('Missing knowledge text');
 const edits=[];
 const visible=text.split(/\r?\n/).map(line=>{
  const rule=rules.find(r=>r.before===line);
  if(rule){edits.push({before:digest(line),after:digest(rule.after)});return rule.after;}
  // Do not guess how to rewrite a newly introduced evaluator command.
  if(/(?:→\s*(?:not a |do not )?flag|\bflag it\b|\bflag only\b|\bdo not flag\b|\bcompliance evaluation\b)/i.test(line))throw Error('Unreviewed evaluator instruction in coaching knowledge');
  return line;
 }).filter(Boolean).join('\n');
 return {text:visible,manifest:{version:VERSION,rules_hash:digest(rules),source_hash:digest(text),view_hash:digest(visible),edits}};
}
module.exports={project,VERSION};
