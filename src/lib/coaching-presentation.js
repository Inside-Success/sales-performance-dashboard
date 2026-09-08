// Pure display contract shared by dashboard and generated n8n renderers.
// No policy decisions, model calls, storage writes or fuzzy content deletion.
export function coachingText(value) {
  if (value == null) return '';
  if (Array.isArray(value)) return value.map(coachingText).filter(Boolean).join('\n\n');
  if (typeof value === 'object') return Object.entries(value).map(([k,v]) => `${k.replace(/_/g,' ')}: ${coachingText(v)}`).join('\n');
  return String(value).trim();
}
export function coachingItems(value) {
  if (Array.isArray(value)) return value.flatMap(coachingItems);
  const text=coachingText(value);
  if (!text) return [];
  // Keep each observation/effect/action together; never split on every newline.
  return text.split(/(?:^|\n)\s*\d+[.)]\s+|\s*\|\s*/).map(x=>x.trim()).filter(Boolean);
}
function comparison(value) {
  return coachingText(value).replace(/\[(?:\d{1,2}:\d{2}:\d{2}(?:\.\d+)?(?:,\s*)?)+\]/g,'').replace(/(?:^|\n)\s*\d+[.)]\s+/g,'').replace(/\s+/g,' ').trim().toLowerCase();
}
export function uniqueCoachingItems(values) {
  const items=values.flatMap(coachingItems);
  return items.filter((item,i)=>{
    const key=comparison(item);
    return key && !items.some((other,j)=>j!==i && comparison(other).includes(key) && (comparison(other)!==key || j<i));
  });
}
export function coachingClose(report) {
  const why=coachingText(report.why_no_close), closed=coachingText(report.what_made_this_close_work);
  const noClose=/\b(?:no (?:completed payment was confirmed|close occurred|close happened)|deal did not (?:fully )?close|call did not close|see why no close)\b/i;
  if (closed && !noClose.test(closed)) return {title:'What helped you close',text:closed};
  return {title:'Outcome and next steps',text:why||closed};
}
export function coachingSections(report) {
  const strengths=uniqueCoachingItems([report.what_went_well,report.biggest_strength]);
  const improvements=uniqueCoachingItems([report.what_to_improve,report.what_id_polish||report.biggest_fix]);
  const main=[...strengths,...improvements];
  const extra=uniqueCoachingItems([report.coaching_tip,report.rudys_note]).filter(x=>x!=='Keep the next action clear and confirm what actually completes.' && !main.some(y=>comparison(y).includes(comparison(x))));
  const close=coachingClose(report);
  let outcome=coachingText(report.one_line_verdict);
  const closeParts=close.text.split(/\n\s*\n/).filter(Boolean);
  if(closeParts[0] && comparison(closeParts[0])===comparison(outcome))outcome=closeParts[0];
  const closeRemainder=closeParts.filter(part=>![outcome,...main].some(item=>comparison(item)===comparison(part))).join('\n\n');
  const objections=uniqueCoachingItems([report.objections_surfaced]).filter(x=>!comparison(close.text).includes(comparison(x)));
  return [
    {key:'outcome',title:'Call outcome',items:[outcome].filter(Boolean)},
    {key:'strengths',title:'What you did well',items:strengths},
    {key:'improvements',title:'What to improve',items:improvements},
    {key:'next',title:'Try next time',items:extra},
    {key:'close',title:close.title,items:[closeRemainder].filter(Boolean)},
    {key:'objections',title:'Buyer concerns',items:objections},
  ].filter(s=>s.items.length);
}
export function coachingEvidence(value) {
  const evidence=[];
  const text=coachingText(value).replace('No additional coaching recommendation met the evidence threshold for this report.','No clear change to recommend from this call.').replace(/^Possible effect:/gm,'Why it matters:').replace(/^Better action:/gm,'Next time:').replace(/\[((?:\d{1,2}:\d{2}:\d{2}(?:\.\d+)?(?:,\s*)?)+)\]/g,(_,times)=>{evidence.push(...times.split(/,\s*/).map(t=>t.replace(/\.\d+$/,'')));return '';}).replace(/ +\n/g,'\n').replace(/ {2,}/g,' ').trim();
  return {text,evidence:[...new Set(evidence)]};
}
