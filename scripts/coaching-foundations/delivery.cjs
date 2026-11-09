// All surfaces derive from one accepted record. No external writes in this module.
const record=require('../../src/lib/foundations-record.cjs');
const escape=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function documents(payload,sourceId,channel){
 const loaded=record.read(payload,sourceId,channel);if(!loaded)throw Error('Not a foundations report');
 const sections=record.sections(payload,sourceId,channel);
 const html='<!doctype html><html><head><meta charset="utf-8"><title>Call coaching</title><style>body{font:16px/1.6 Arial,sans-serif;color:#17202a;max-width:820px;margin:40px auto;padding:0 24px}h1{font-size:28px}h2{font-size:21px;margin-top:30px}article{white-space:pre-wrap;break-inside:avoid;margin-bottom:20px}@media print{body{margin:16mm;font-size:11pt}}</style></head><body><h1>Call coaching</h1>'+sections.map(s=>'<section><h2>'+escape(s.title)+'</h2>'+s.items.map(t=>'<article>'+escape(t)+'</article>').join('')+'</section>').join('')+'</body></html>';
 const text=sections.map(s=>s.title+'\n'+s.items.join('\n\n')).join('\n\n');
 return {markdown:loaded.markdown,html,googleDocsRequests:[{insertText:{location:{index:1},text}}],text,reportDigest:payload.reviewed_coaching_v3.digest};
}
module.exports={documents};
