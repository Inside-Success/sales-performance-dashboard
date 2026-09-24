import type { CoachingDisplayReport } from './coaching-presentation';

export function dashboardCoachingSections(report: CoachingDisplayReport): {
  key: string;
  title: string;
  items: string[];
}[];
