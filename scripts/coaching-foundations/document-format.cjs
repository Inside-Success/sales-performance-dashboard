// Native Docs layout: one bullet per insight, with its supporting explanation kept together.
function docRequests(sections,header){
 let text='';const ranges=[],bullets=[];
 function add(value,style='NORMAL_TEXT',keep=false){const start=1+text.length;text+=value+'\n';ranges.push({start,end:1+text.length,style,keep});return start;}
 for(const h of header)add(h.text,h.style,true);
 for(const s of sections){
  add(s.title,'HEADING_2',true);
  for(const item of s.items){
   const lines=item.split(/\n+/).filter(Boolean),start=1+text.length;
   lines.forEach((line,i)=>add(line,'NORMAL_TEXT',i<lines.length-1));
   if(s.key!=='outcome'&&lines.length)bullets.push({start,end:1+text.length,headingEnd:start+lines[0].length});
  }
 }
 const requests=[{insertText:{location:{index:1},text}}];
 for(const r of ranges)requests.push({updateParagraphStyle:{range:{startIndex:r.start,endIndex:r.end},paragraphStyle:{namedStyleType:r.style,keepWithNext:r.keep,avoidWidowAndOrphan:true,spaceAbove:{magnitude:r.style==='HEADING_2'?14:0,unit:'PT'},spaceBelow:{magnitude:r.keep?3:9,unit:'PT'}},fields:'namedStyleType,keepWithNext,avoidWidowAndOrphan,spaceAbove,spaceBelow'}});
 for(const b of bullets){requests.push({createParagraphBullets:{range:{startIndex:b.start,endIndex:b.headingEnd},bulletPreset:'BULLET_DISC_CIRCLE_SQUARE'}});if(b.headingEnd>b.start)requests.push({updateTextStyle:{range:{startIndex:b.start,endIndex:b.headingEnd},textStyle:{bold:true},fields:'bold'}});}
 return {requests,text};
}
module.exports={docRequests};
