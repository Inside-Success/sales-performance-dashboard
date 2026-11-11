// Resolve formatting differences to an original contiguous source span. Never
// fuzzy-match words, punctuation, numbers or omissions. Provider receipts stay raw.
function indexed(text){
 const chars=[],starts=[],ends=[];
 for(let start=0;start<text.length;start++){
  const c=text[start],offset=start+1;
  const n=/\s/u.test(c)?' ':c.replace(/[A-Z]/g,x=>x.toLowerCase()).replace(/[‘’]/g,"'").replace(/[“”]/g,'"');
  if(n===' '&&chars.at(-1)===' '){ends[ends.length-1]=offset;continue;}
  chars.push(n);starts.push(start);ends.push(offset);
 }
 return {text:chars.join(''),starts,ends};
}
function resolve(q,blocks){
 const matches=blocks.filter(b=>b.id===q?.id);
 if(matches.length!==1||typeof matches[0].text!=='string'||typeof q?.text!=='string'||!q.text.trim())throw Error('Quotation is not source-bound');
 const source=matches[0].text,needle=q.text.trim();
 if(source.includes(needle))return {id:q.id,text:needle};
 const hay=indexed(source),wanted=indexed(needle).text;
 const at=hay.text.indexOf(wanted);
 if(at<0||hay.text.indexOf(wanted,at+1)!==-1)throw Error('Quotation is absent or ambiguous in source');
 // Normalization above is one code point per character except whitespace.
 // Use UTF-16 units for the index map as String#indexOf returns UTF-16 offsets.
 return {id:q.id,text:source.slice(hay.starts[at],hay.ends[at+wanted.length-1])};
}
module.exports={resolve};
