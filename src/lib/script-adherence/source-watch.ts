import {createHash} from 'node:crypto';
import {neon} from '@neondatabase/serverless';
import sources from './source-manifest.json';
export {sources};
// Read only the explicitly reviewed script tab. Preserve prose and link destinations;
// ignore formatting, suggestion metadata and commentary tabs.
export function sourceText(document:unknown,tabId:string):string{
 const d=document as {documentId?:string;tabs?:unknown[]};
 const find=(tabs:unknown[]):Record<string,unknown>|undefined=>{
  for(const raw of tabs){const t=raw as Record<string,unknown>,p=t.tabProperties as {tabId?:string}|undefined;
   if((p?.tabId??t.tabId)===tabId)return (t.documentTab??t) as Record<string,unknown>;
   const child=find((t.childTabs??[]) as unknown[]);if(child)return child;
  }
 };
 const tab=find(d.tabs??[]);if(!tab?.body)throw Error('Reviewed script tab unavailable');
 const links=new Set<string>();
 const walk=(v:unknown):string=>{
  if(Array.isArray(v))return v.map(walk).join('');
  if(!v||typeof v!=='object')return '';
  const o=v as Record<string,unknown>;
  if(o.textRun){const r=o.textRun as {content?:string;textStyle?:{link?:{url?:string}}};if(r.textStyle?.link?.url)links.add(r.textStyle.link.url);return r.content??'';}
  return Object.values(o).map(walk).join('');
 };
 const text=walk(tab.body).normalize('NFC').replace(/\s+/g,' ').trim();
 if(text.length<100)throw Error('Script text incomplete');
 return text+'\n'+[...links].sort().join('\n');
}
export const sourceHash=(text:string)=>createHash('sha256').update(text).digest('hex');
export async function recordSourceCheck(documentId:string,document:unknown){
 const spec=sources.find(s=>s.documentId===documentId);if(!spec)throw Error('Unknown script source');
 let hash:string|null=null,error:string|null=null;
 try{if((document as {documentId?:string})?.documentId!==documentId)throw Error('Document identity mismatch');hash=sourceHash(sourceText(document,spec.tabId));}catch{error='Script source could not be read completely';}
 const sql=neon(process.env.DATABASE_URL!);
 await sql`insert into script_adherence_source_checks(document_id,observed_hash,expected_hash,error,checked_at) values(${documentId},${hash},${spec.hash},${error},now()) on conflict(document_id) do update set observed_hash=coalesce(excluded.observed_hash,script_adherence_source_checks.observed_hash),expected_hash=excluded.expected_hash,error=excluded.error,checked_at=excluded.checked_at`;
 return {checked:!error,changed:hash!==null&&hash!==spec.hash};
}
