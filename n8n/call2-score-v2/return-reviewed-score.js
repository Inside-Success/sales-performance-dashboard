function singleInput(){const rows=$input.all();if(rows.length!==1)throw new Error('Expected one scoring input');return rows[0].json;}
function single(name){const rows=$(name).all();if(rows.length!==1)throw new Error('Expected one aligned scoring item: '+name);return rows[0].json;}
const input=singleInput();if(!input.final_result?.current_call_score)throw new Error('Missing final reviewed scoring result');return [{json:input.final_result}];
