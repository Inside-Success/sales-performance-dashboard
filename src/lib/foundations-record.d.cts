export const GENERATION:string;
export function read(payload:unknown,sourceId:string,channel:'official'|'manual'):{report:unknown;markdown:string;policyText:string;sourceBlocks:{id:string;timestamp?:string;text:string}[]|null}|null;
export function sections(payload:unknown,sourceId:string,channel:'official'|'manual'):{key:string;title:string;items:string[]}[]|null;
