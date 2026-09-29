import { coachingSections, coachingItems, coachingText, coachingEvidence, withoutOptionalPolishLabel } from './coaching-presentation.js';

// Reassemble only the recent audited format; never reinterpret older full-section reports.
export function isRecentCoachingReport(report) {
 const version=report.source_payload?.coaching_version || '';
 if(version && !/2026-09-(?:08|24|30)/.test(version))return false;
 return /2026-09-(?:08|24|30)/.test(version) || /(?:^|\n)(?:Possible effect|Better action|Why it matters|Next time):/.test(coachingText(report.what_to_improve));
}
export function groupRecentImprovements(value) {
 const groups=[];
 for(const item of coachingItems(value)) {
  const continuation=/^(?:Possible effect|Better action|Why it matters|Next time):/i.test(item);
  if(continuation && groups.length) {
   const previous=groups[groups.length-1];
   if(!previous.split('\n').includes(item))groups[groups.length-1]=previous+'\n'+item;
  } else groups.push(item);
 }
 return groups;
}

// Dashboard-only layout: keep distinct tips in What to improve, without a repeat card.
function actionKey(value) {
  return String(value)
    .replace(/^\s*(?:(?:\d+[.)]|optional polish:|better action:|next time:)\s*)+/i, '')
    .replace(/\[(?:\d{1,2}:\d{2}:\d{2}(?:\.\d+)?(?:,\s*)?)+\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.!?]+$/, '')
    .toLowerCase();
}

export function dashboardCoachingSections(report) {
  const recent=isRecentCoachingReport(report);
  const display=recent?{...report,what_to_improve:groupRecentImprovements(report.what_to_improve),what_id_polish:groupRecentImprovements(report.what_id_polish||report.biggest_fix),biggest_fix:undefined}:report;
  let sections = coachingSections(display);
  // Recent flat reports already contain these audited sections. Expose them without
  // generating new advice or repeating the same concerns in a second card.
  if (recent) {
    const close = sections.find(section => section.key === 'close');
    if (close && /Observed concerns:|Agreed next steps:/.test(close.items.join('\n'))) {
      const source = close.items.join('\n');
      const concerns = source.match(/Observed concerns:\s*([\s\S]*?)(?=Agreed next steps:|$)/)?.[1];
      const nextSteps = source.match(/Agreed next steps:\s*([\s\S]*)$/)?.[1];
      const clean = value => coachingItems(value).filter(item => item.trim());
      const savedConcerns = sections.find(section => section.key === 'objections')?.items || [];
      const seen = new Set();
      const combined = [...clean(concerns), ...savedConcerns].filter(item => {
        const key = coachingEvidence(item).text.replace(/\s+/g,' ').toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key); return true;
      });
      const remainder = source.split(/Observed concerns:|Agreed next steps:/)[0].trim();
      sections = sections.filter(section => !['close','objections'].includes(section.key));
      if (remainder) sections.push({...close,items:[remainder]});
      if (combined.length) sections.push({key:'objections',title:'Buyer concerns',items:combined});
      if (clean(nextSteps).length) sections.push({key:'next-steps',title:'Agreed next steps',items:clean(nextSteps)});
    }
  }
  const next = sections.find(section => section.key === 'next');
  if (!next) return sections;

  const visible = sections.filter(section => section.key !== 'next');
  const improvementIndex = visible.findIndex(section => section.key === 'improvements');
  const improvements = improvementIndex < 0 ? [] : visible[improvementIndex].items;
  const seenActions = new Set();

  for (const item of improvements) {
    const actionLines = [...item.matchAll(/(?:^|\n)\s*(?:Better action|Next time):\s*([^\n]+)/gi)];
    if (actionLines.length) {
      for (const match of actionLines) seenActions.add(actionKey(match[1]));
    } else if (!item.includes('\n')) {
      seenActions.add(actionKey(item));
    }
  }

  const distinctTips = [];
  for (const tip of next.items) {
    const key = actionKey(tip);
    if (!key || seenActions.has(key)) continue;
    seenActions.add(key);
    distinctTips.push('Next time: ' + withoutOptionalPolishLabel(tip));
  }

  if (distinctTips.length) {
    if (improvementIndex >= 0) {
      visible[improvementIndex] = {
        ...visible[improvementIndex],
        items: [...improvements, ...distinctTips],
      };
    } else {
      visible.splice(visible[0]?.key === 'outcome' ? 1 : 0, 0, {
        key: 'improvements',
        title: 'What to improve',
        items: distinctTips,
      });
    }
  }

  return visible;
}
