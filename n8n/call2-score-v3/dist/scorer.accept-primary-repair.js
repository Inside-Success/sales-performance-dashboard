function one(name){const a=$(name).all();if(a.length!==1)throw Error('Expected one aligned scoring item: '+name);return a[0].json;}
function input(){const a=$input.all();if(a.length!==1)throw Error('Expected one scoring item');return a[0].json;}

const r=input(),original=one('Check Primary Structure').raw;
const costs={};for(const key of ['input_cost_usd','cache_write_cost_usd','cache_read_cost_usd','output_cost_usd','total_cost_usd'])costs[key]=Number(original.costs?.[key]||0)+Number(r.costs?.[key]||0);
return [{json:{...r,costs,primary_format_repair:true}}];
