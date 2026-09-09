const inputs = $('Build Immutable Call 2 Score Record').all();
if(inputs.length !== 1) throw new Error('Expected one immutable score record');
const built = inputs[0].json;
return [{ json: { ...built, shouldCreate: !$json.id, existingRecordId: $json.id || null } }];
