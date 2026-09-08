// Pure text boundaries for coaching safety processing. No policy or model changes.
function coachingSentenceSpans(value) {
 const text=String(value||''),spans=[];let start=0;
 const push=end=>{let a=start,b=end;while(a<b&&/\s/.test(text[a]))a++;while(b>a&&/\s/.test(text[b-1]))b--;if(b>a)spans.push({start:a,end:b,text:text.slice(a,b)});start=end;};
 for(let i=0;i<text.length;i++){
  if(text[i]==='['){const citation=text.slice(i).match(/^\[(?:\d{1,2}:\d{2}:\d{2}(?:\.\d+)?(?:,\s*)?)+\]/);if(citation){i+=citation[0].length-1;continue;}}
  if(text[i]==='\n'){push(i);start=i+1;continue;}
  if(!/[.!?]/.test(text[i])||i+1<text.length&&!/\s/.test(text[i+1]))continue;
  if(/^\s*\d+[.)]$/.test(text.slice(start,i+1)))continue;
  let end=i+1;
  const attached=text.slice(end).match(/^[ \t]*(\[(?:\d{1,2}:\d{2}:\d{2}(?:\.\d+)?(?:,\s*)?)+\])/);
  if(attached)end+=attached[0].length;
  push(end);i=end-1;
 }
 push(text.length);return spans;
}
function splitSentences(text){return coachingSentenceSpans(text).map(s=>s.text.replace(/^\d+[.)]\s+/,'')).filter(s=>s.length>=8);}
function dedupeRepeatedSentencesText(value){
 const text=String(value||''),seen=new Map(),remove=[];
 const pattern=/\[(?:\d{1,2}:\d{2}:\d{2}(?:\.\d+)?(?:,\s*)?)+\]/g;
 for(const span of coachingSentenceSpans(text)){
  if(span.text.length<8)continue;
  const key=span.text.replace(/^\d+[.)]\s+/,'').replace(pattern,'').replace(/\s+/g,' ').trim().toLowerCase();
  const previous=seen.get(key);const citations=span.text.match(pattern)||[];
  if(previous){
   const old=previous.text.match(pattern)||[];
   if(citations.every(c=>old.includes(c))){remove.push(span);continue;}
   if(old.every(c=>citations.includes(c)))remove.push(previous);
  }
  seen.set(key,span);
 }
 let out=text;for(const span of remove.sort((a,b)=>b.start-a.start))out=out.slice(0,span.start)+out.slice(span.end);
 return out.replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
}
function coachingRepairAfter(before,after){
 const citation=/\[(?:\d{1,2}:\d{2}:\d{2}(?:\.\d+)?(?:,\s*)?)+\]/g;
 const original=String(before).match(citation)||[];
 const prose=String(after).replace(citation,'').replace(/[ \t]{2,}/g,' ').trim();
 return prose+(prose&&original.length?' '+[...new Set(original)].join(' '):'');
}
module.exports={coachingSentenceSpans,splitSentences,dedupeRepeatedSentencesText,coachingRepairAfter};
