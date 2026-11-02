// Correct only explicit full-name role evidence against the configured closer roster.
// Never fuzzy-match a prospect, infer a rep from a title, or rewrite source metadata.
export function observedRep(transcript:string,sourceRep:string,roster:string[]){
 const norm=(s:string)=>s.toLowerCase().replace(/\s+/g,' ').trim();
 const names=new Map(roster.map(n=>[norm(n),n])),counts=new Map<string,number>(),roles=new Set<string>();
 for(const line of transcript.split('\n')){const m=line.match(/^\[[^\]]+\]\s*([^:]{1,150}):\s*(.*)$/);if(!m)continue;const name=names.get(norm(m[1]));if(!name)continue;counts.set(name,(counts.get(name)||0)+1);if(/(?:i(?:'m| am).{0,50}casting|my name.{0,60}casting|call.{0,30}recorded.{0,60}(?:okay|ok|consent|agree))/i.test(m[2]))roles.add(name);}
 const explicit=[...roles].filter(n=>(counts.get(n)||0)>=3);
 if(explicit.length>1)return {rep:'Multiple reps',sourceRep,reason:'Multiple configured closers identify themselves in the call'};
 if(explicit.length===1&&norm(explicit[0])!==norm(sourceRep)&&![...counts.keys()].some(n=>norm(n)===norm(sourceRep)))return {rep:explicit[0],sourceRep,reason:'Explicit live casting-role evidence matches the configured closer roster'};
 return {rep:sourceRep,sourceRep,reason:'Recording host attribution retained'};
}
