import {getEncoding} from 'js-tiktoken';
// Conservative estimate, not a claim of an exact Terra tokenizer. Both common
// OpenAI encodings, 30% headroom and framing allowance; fixed 16k output reserve.
let encodings:ReturnType<typeof getEncoding>[]|undefined;
export function inputTokenEstimate(text:string){
 encodings??=[getEncoding('o200k_base'),getEncoding('cl100k_base')];
 // Bound individual encoding work even for hostile no-whitespace passages.
 const chunks=text.match(/[\s\S]{1,2000}/gu)??[];
 return Math.ceil(Math.max(...encodings.map(e=>chunks.reduce((n,c)=>n+e.encode(c,[],[]).length,0)))*1.3)+4096;
}
export function fitsContext(model:string,text:string){
 if(model!=='gpt-6.1-terra')return Buffer.byteLength(text)+4096<=220000;
 if(Buffer.byteLength(text)>800000)return false;
 // Small calls pass without tokenization; one UTF-8 byte is a conservative upper bound.
 if(Buffer.byteLength(text)+4096<=160000)return true;
 return inputTokenEstimate(text)<=160000;
}
