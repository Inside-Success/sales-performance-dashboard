import { coachingSections, withoutOptionalPolishLabel } from './coaching-presentation.js';

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
  const sections = coachingSections(report);
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
