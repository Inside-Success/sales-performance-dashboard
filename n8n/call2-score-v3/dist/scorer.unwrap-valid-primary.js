function one(name){const a=$(name).all();if(a.length!==1)throw Error('Expected one aligned scoring item: '+name);return a[0].json;}
function input(){const a=$input.all();if(a.length!==1)throw Error('Expected one scoring item');return a[0].json;}
return [{json:input().raw}];