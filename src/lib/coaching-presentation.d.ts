export type CoachingDisplayReport = {
 one_line_verdict?: unknown; biggest_strength?: unknown; biggest_fix?: unknown; what_id_polish?: unknown;
 coaching_tip?: unknown; rudys_note?: unknown; what_went_well?: unknown; what_to_improve?: unknown;
 why_no_close?: unknown; what_made_this_close_work?: unknown; objections_surfaced?: unknown;
};
export function coachingText(value: unknown): string;
export function coachingItems(value: unknown): string[];
export function uniqueCoachingItems(values: unknown[]): string[];
export function coachingClose(report: CoachingDisplayReport): {title:string;text:string};
export function coachingSections(report: CoachingDisplayReport): {key:string;title:string;items:string[]}[];
export function coachingEvidence(value: unknown): {text:string;evidence:string[]};
