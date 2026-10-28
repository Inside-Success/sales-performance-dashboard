export const OBJECTION_VERSION: string;
export const OBJECTION_SCHEMA_VERSION: string;
export const OBJECTION_CATEGORIES: Record<string,string>;
export type ObjectionEvidence = {evidence_ids:string[];counterevidence_ids?:string[]};
export type ObjectionReport = {
 version:'objection-coaching-v2';source_id:string;show:string;offer_family:string;
 evidence_quality:'sufficient'|'limited';summary:string;
 outcome:ObjectionEvidence & {payment:'confirmed'|'not_confirmed'|'unclear';summary:string};
 objections:(ObjectionEvidence & {category:string;title:string;concern:string;response:string;handling:'handled_well'|'could_be_handled_better'|'not_enough_evidence';resolution:'resolved'|'partly_resolved'|'unresolved'|'unclear';assessment:string;recommendation:string;suggested_words:string})[];
 no_objections_reason:string;not_raised:string[];
 improvements:(ObjectionEvidence & {title:string;observation:string;why_it_matters:string;action:string})[];
 strengths:(ObjectionEvidence & {title:string;observation:string;why_it_matters:string})[];
 next_steps:(ObjectionEvidence & {kind:'agreed'|'recommended';observation:string})[];
 evidence_times?:Record<string,string>;provenance?:Record<string,unknown>;
};
export function objectionErrors(report:unknown,blocks?:{id:string;timestamp?:string|null;text?:string}[]):string[];
export function assertObjectionReport(report:unknown,blocks?:{id:string;timestamp?:string|null;text?:string}[]):ObjectionReport;
export function objectionSections(report:ObjectionReport,blocks?:{id:string;timestamp?:string|null;text?:string}[]):{key:string;title:string;items:string[]}[];
export function readObjectionCoaching(payload:unknown,sourceId?:string|null):ObjectionReport|null;
export function renderObjectionReport(report:ObjectionReport,blocks:{id:string;timestamp?:string|null;text?:string}[],sourceId:string,provenance?:Record<string,unknown>):Record<string,unknown>;

export function objectionProviderStage(stage:string):boolean;
export function objectionProviderErrors(stage:string,value:unknown):string[];

export function normalizeObjectionReport(value:unknown):unknown;
