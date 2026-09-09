const built = $('Build Immutable Call 2 Score Record').first().json;
return [{ json: { ...built, shouldCreate: !$json.id, existingRecordId: $json.id || null } }];
