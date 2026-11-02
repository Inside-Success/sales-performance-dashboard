import type {ScriptId} from './rubric';

// Reporting cutoff agreed by Tyler, Mike and Rich, October 27, at 25:01.
// This is NOT a claim that the video was first published on September 29.
export const REALITY_VIDEO_1_POLICY = {
  assessedFrom: '2026-09-29',
  source: 'https://docs.google.com/document/d/1r2A-taelSPepc8txkwUL8wiIKZNK3ocR_os27t-hbXM/edit',
  reason: 'Video 1 is assessed from September 29, 2026, the reporting cutoff agreed by sales leadership. Earlier calls are excluded from this action’s rate.',
};
export function miamiDate(value:string):string|null {
  const d=new Date(value);
  return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(d):null;
}
export function historicalRequirement(script:ScriptId,id:string,startedAt?:string):'assess'|'outside_window'|'unknown_date' {
  if(script!=='reality_call_1'||id!=='video_1')return 'assess';
  // Old callers without a date cannot silently penalize historical calls.
  const day=startedAt?miamiDate(startedAt):null;
  if(!day)return 'unknown_date';
  return day<REALITY_VIDEO_1_POLICY.assessedFrom?'outside_window':'assess';
}
