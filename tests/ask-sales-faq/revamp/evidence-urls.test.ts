import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { evidenceReferenceIssue, runAskSalesRevamp } from "../../../src/lib/ask-sales-faq/revamp/runtime";
import { evidenceUrls } from "../../../src/lib/ask-sales-faq/revamp/evidence-urls";
import type { Answer, Evidence, JsonProvider } from "../../../src/lib/ask-sales-faq/revamp/types";

const url = "https://example.test/current";
const evidence: Evidence = { id:"resource", decisionKey:"resource", title:"Resource", text:`Use ${url}.`, sourceIds:[url], scopes:["shared"], questions:[], reviewedAt:"2026-11-05", authority:10, kind:"policy", risk:"low", routeKey:null, conditions:[], supersedes:[] };
const answer = (text:string):Answer => ({status:"answer",paragraphs:[{text,kind:"company_fact",evidenceIds:["resource"]}],routeKey:null});
const check = (text:string, sources=[evidence]) => evidenceReferenceIssue(answer(text),sources);

describe("Markdown-aware resource validation",()=>{
  it.each([
    url, `${url}.`, `**${url}**.`, `*${url}*`, `__${url}__`, `~~${url}~~`,
    `\`${url}\``, `\`\`\`text\n${url}\n\`\`\``, `[Open](${url})`, `**[Open](${url})**`,
    `<${url}>`, `[Open][guide]\n\n[guide]: ${url}`, `- **${url}**\n- [Guide](${url})`,
    `| Resource |\n| --- |\n| **${url}** |`,
  ])("accepts the same approved destination in %s", text=>expect(check(text)).toBeNull());

  it.each([
    `${url}/invented`, `${url}?invented=1`, `${url}#invented`, "https://example.test/cur",
    "https://example.test.evil.test/current", "https://example.test@evil.test/current",
    `**${url}/invented**`, `[${url}](https://evil.test/)`,
    `[Open][guide]\n\n[guide]: https://evil.test/`, `\`https://evil.test/\``,
    `[Open](https://example.test/current%2Fother)`,
  ])("rejects unsupported destination in %s",text=>expect(check(text)?.code).toBe("unsupported_url"));

  it.each([
    "https://example.test/file_(final)", "https://example.test/path_under_score",
    "https://example.test/find?name=a*b&token=x_y#part", "https://example.test/file%2Fpart?x=1&y=2",
  ])("preserves meaningful URL characters for %s", destination=>{
    const sources=[{...evidence,text:"Use the approved resource.",sourceIds:[destination]}];
    expect(check(`[Open](<${destination}>)`,sources)).toBeNull();
    expect(check(`\`${destination}\``,sources)).toBeNull();
    expect(check(`[Open](<${destination}changed>)`,sources)?.code).toBe("unsupported_url");
  });

  it("uses Markdown semantics for escaped characters and HTML entities",()=>{
    const destination="https://example.test/file_(final)?x=1&y=2";
    expect(check("[Open](https://example.test/file_\\(final\\)?x=1&amp;y=2)",[{...evidence,sourceIds:[destination]}])).toBeNull();
  });

  it("extracts formatted source links as well as formatted answers without admitting invented suffixes",()=>{
    const sources=[{...evidence,sourceIds:[],text:`The resource is **${url}**.`}];
    expect(check(`[Open](${url})`,sources)).toBeNull();
    expect(check(`[Open](${url}/other)`,sources)?.code).toBe("unsupported_url");
  });

  it("matches the renderer destination for bold URLs instead of including emphasis markers",()=>{
    const text=`Practice here: **${url}**.`;
    expect(evidenceUrls(text)).toEqual([url]);
    expect(renderToStaticMarkup(React.createElement(Markdown,{remarkPlugins:[remarkGfm]},text)))
      .toContain(`<strong><a href="${url}">${url}</a></strong>`);
  });

  it("still checks resource URLs inside code, without treating literal URL characters as formatting",()=>{
    expect(check(`\`${url}**\``)?.code).toBe("unsupported_url");
    expect(check(`\`\`\`\nhttps://evil.test/\n\`\`\``)?.code).toBe("unsupported_url");
  });

  it("preserves missing/unknown evidence and routing checks",()=>{
    expect(evidenceReferenceIssue({...answer(url),paragraphs:[{...answer(url).paragraphs[0],evidenceIds:[]}]},[evidence])?.code).toBe("missing_fact_evidence");
    expect(evidenceReferenceIssue(answer(url),[])?.code).toBe("unknown_evidence_reference");
    expect(evidenceReferenceIssue({...answer(url),routeKey:"invented"},[evidence])?.code).toBe("unsupported_route");
  });

  it("returns the reviewed formatted answer without additional model calls",async()=>{
    let calls=0;
    const text=`Practice here: **${url}**.`;
    const reviewed={...answer(text),paragraphs:[{text,kind:"company_fact",evidenceIds:["E1"]}]};
    const provider:JsonProvider=async()=>({value:[{historyMode:"new_subject",intent:"company_question",question:"Where can I practice?",scopes:[],queries:["resource"]},reviewed,reviewed][calls++],attempt:{provider:"openai",model:"test",purpose:"test",status:"success",latencyMs:1,inputTokens:1,cachedTokens:0,outputTokens:1}});
    const result=await runAskSalesRevamp("Where can I practice?",[],{provider,evidence:[evidence]});
    expect(result.errorClass).toBeNull();expect(result.answer).toBe(text);expect(calls).toBe(3);
  });
});
