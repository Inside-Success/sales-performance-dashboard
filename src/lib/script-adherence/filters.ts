export function parseFilters(raw:Record<string,string|string[]|undefined>){
 const single=(key:string)=>typeof raw[key]==='string'?raw[key] as string:'';
 const day=(key:string)=>/^\d{4}-\d{2}-\d{2}$/.test(single(key))?single(key):'';
 return {from:day('from'),to:day('to'),show:single('show').slice(0,150),stage:['call_1','call_2','followup','other','unknown'].includes(single('stage'))?single('stage'):''};
}
