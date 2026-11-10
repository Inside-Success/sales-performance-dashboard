export const VERSION: string;
export function providerErrors(stage:string,value:unknown):string[];
export function providerStage(stage:string):boolean;

export function orderedObjections<T>(report: {presentation?: string; objections: T[]}, blocks: {id: string}[]): T[];
