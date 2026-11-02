export function parseFilters(raw:Record<string,string|string[]|undefined>){
 const single=(key:string)=>typeof raw[key]==='string'?raw[key] as string:'';
 const day=(key:string)=>{const value=single(key);if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return '';const d=new Date(value+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value?value:'';};
 return {from:day('from'),to:day('to'),show:single('show').slice(0,150),stage:['call_1','call_2','followup','other','unknown'].includes(single('stage'))?single('stage'):''};
}
