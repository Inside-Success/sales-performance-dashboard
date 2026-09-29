import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isRepScoringAdmin } from '@/lib/rep-scoring/admin-allowlist';
export const maxDuration=300;
export const dynamic='force-dynamic';
// Temporary, expiry-bound harness. Exact approved prompts only; no source/business writes.
const approved=new Set(['47d8b851a559abc6b32ef352e4bea2b7ebba8a70e4b9834693720af03584d973','c30484b23a0fec7262b5116e67b77db49a7d85562741d06934c22fb1fcfec46a','85fa24619b0078d02c66e531d33ece4a6be1ea45bfefb1a787a3ca0b25dc242f']);
export async function POST(request:NextRequest){
 const session=await auth();
 if(!isRepScoringAdmin(session?.user?.email))return NextResponse.json({error:'Forbidden'},{status:403});
 if(Date.now()>Date.parse('2026-10-01T00:00:00Z'))return NextResponse.json({error:'Benchmark expired'},{status:410});
 if(!process.env.OPENAI_API_KEY)return NextResponse.json({error:'Production credential unavailable'},{status:503});
 let body;try{const raw=await request.text();if(Buffer.byteLength(raw)>150000)throw Error();body=JSON.parse(raw);}catch{return NextResponse.json({error:'Invalid fixture'},{status:400});}
 if(typeof body.system!=='string'||typeof body.prompt!=='string'||!approved.has(createHash('sha256').update(JSON.stringify([body.system,body.prompt])).digest('hex')))return NextResponse.json({error:'Fixture is not approved'},{status:400});
 try{
 const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{authorization:'Bearer '+process.env.OPENAI_API_KEY,'content-type':'application/json'},body:JSON.stringify({model:'gpt-6-luna',instructions:body.system,input:body.prompt,reasoning:{effort:'high'},max_output_tokens:12000,text:{format:{type:'json_object'}},store:false}),signal:AbortSignal.timeout(240000)});
 const data=await response.json();if(!response.ok)return NextResponse.json({error:'Provider rejected benchmark',status:response.status,code:data.error?.code},{status:502});
 const output=(data.output||[]).flatMap((x:{content?:{type:string;text:string}[]})=>x.content||[]).filter((x:{type:string})=>x.type==='output_text').map((x:{text:string})=>x.text).join('');
 return NextResponse.json({id:body.id,model:'gpt-6-luna',status:data.status,usage:data.usage,output});
 }catch{return NextResponse.json({error:'Benchmark failed; do not automatically retry.'},{status:502});}
}
