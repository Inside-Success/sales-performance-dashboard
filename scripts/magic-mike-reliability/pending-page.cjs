// A bounded Airtable keyset page. Alternate recent calls and the historical backlog.
function pendingPage(baseFilter, accountSlot, state, now = new Date()) {
  const recent = now.getUTCHours() % 2 === 0;
  const slot = accountSlot + (recent ? ':recent' : ':history');
  const cursor = state[slot] || {};
  const conditions = [baseFilter];
  if (recent) conditions.push("IS_AFTER({Ingested At},DATETIME_PARSE('" + new Date(now.getTime()-48*3600000).toISOString() + "'))");
  if (cursor.date) {
    const excluded = (cursor.ids || []).filter(x=>/^rec[A-Za-z0-9]+$/.test(x));
    const sameDate = "AND({Ingested At}=DATETIME_PARSE('"+cursor.date+"'),NOT(OR("+excluded.map(x=>"RECORD_ID()='"+x+"'").join(',')+")))";
    conditions.push("OR(IS_AFTER({Ingested At},DATETIME_PARSE('"+cursor.date+"')),"+sameDate+")");
  }
  return { pendingFilter: 'AND('+conditions.join(',')+')', pendingSlot: slot, recent };
}
function advancePendingPage(rows, slot, state) {
  if (!rows.length) { delete state[slot]; return; }
  const last=rows.at(-1).json;const value=(last.fields || last)['Ingested At'];
  if (!value || !Number.isFinite(Date.parse(value))) throw new Error('Pending cursor requires a valid Ingested At');
  const date=new Date(value).toISOString();const prior=state[slot];
  const ids=rows.filter(x=>new Date((x.json.fields || x.json)['Ingested At']).toISOString()===date).map(x=>x.json.id);
  state[slot]={date,ids:[...new Set([...(prior?.date===date ? prior.ids : []),...ids])]};
}
module.exports={pendingPage,advancePendingPage};
