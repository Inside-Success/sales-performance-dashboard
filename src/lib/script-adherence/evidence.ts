export type EvidenceTurn={id:string;timestamp:string;text:string};
export function indexTranscript(transcript:string):EvidenceTurn[]{
  const out:EvidenceTurn[]=[];
  const lines:string[]=[];
  for(const line of transcript.split("\n")){
    if(!line.trim())continue;
    if(/^\[[^\]]+\]/.test(line))lines.push(line);
    else if(lines.length)lines[lines.length-1]+=" "+line.trim();
    else throw Error("Unindexed transcript prefix");
  }
  for(const line of lines){
    const match=line.match(/^\[([^\]]+)\]\s*(.*)$/);if(!match)continue;
    // Split long playback monologues at sentence boundaries, retaining exact text.
    // Never drop a passage or manufacture a more precise timestamp.
    let remaining=match[2];
    while(remaining){let end=remaining.length;if(end>900){end=remaining.lastIndexOf(". ",900);if(end<200)end=remaining.lastIndexOf(" ",900);if(end<1)end=900;else end++;}
      const text=remaining.slice(0,end).trim();if(text)out.push({id:`T${String(out.length+1).padStart(4,"0")}`,timestamp:match[1],text});remaining=remaining.slice(end).trim();}
  }
  return out;
}
export function indexedText(turns:EvidenceTurn[]){return turns.map(t=>`[${t.id}] [${t.timestamp}] ${t.text}`).join("\n");}
export function resolveEvidence(id:string,turns:EvidenceTurn[]){
  if(!id)return {quote:"",timestamp:""};const turn=turns.find(t=>t.id===id);if(!turn)throw Error("Unknown evidence reference");return {quote:turn.text,timestamp:turn.timestamp};
}
