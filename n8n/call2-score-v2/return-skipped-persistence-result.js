const row = $json || {};
return [{json:{...row,persisted:false,skipped:true,route:row.route || (row.shouldCreate === false ? 'already_exists' : 'not_scored')}}];
