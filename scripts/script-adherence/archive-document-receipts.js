// One receipt per paired document request. Never infer source identity from item order.
function contents(elements) {
 return (elements || []).map(e => e.paragraph ? (e.paragraph.elements || []).map(p => p.textRun?.content || '').join('') : e.table ? (e.table.tableRows || []).map(r => (r.tableCells || []).map(c => contents(c.content)).join('\n')).join('\n') : e.sectionBreak ? '' : '').join('');
}
function tabs(items) { return (items || []).map(t => contents(t.documentTab?.body?.content) + tabs(t.childTabs)).join('\n'); }
return $input.all().map((item, i) => {
 const source = $('Archive document requests').itemMatching(i).json;
 const doc = item.json;
 const text = doc.tabs?.length ? tabs(doc.tabs) : contents(doc.body?.content);
 const error = doc.error || doc.documentId !== source.record.docId || !text ? 'Archived document could not be read completely' : undefined;
 return {json: {operation: 'archive', id: source.id, owner: String($execution.id), record: source.record, text: error ? '' : text, ...(error ? {error} : {})}, pairedItem: {item:i}};
});
