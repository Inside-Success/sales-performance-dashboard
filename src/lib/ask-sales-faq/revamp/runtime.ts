import "server-only";
import { ZodError } from "zod";
import type { AskSalesFaqChatMessage } from "../types";
import type { AskSalesFaqRuntimeResult } from "../runtime";
import { sanitizeV4SensitiveText } from "../v4/privacy";
import { getRevampKnowledge, REVAMP_KNOWLEDGE_VERSION } from "./knowledge";
import { retrieveEvidence } from "./retrieval";
import { configuredRevampProvider, RevampProviderError } from "./provider";
import { ANSWER_PROMPT, PLAN_PROMPT, REVIEW_PROMPT } from "./prompts";
import { answerSchema, planSchema, type Answer, type Attempt, type Evidence, type JsonProvider } from "./types";

export function validateEvidenceReferences(answer: Answer, evidence: Evidence[]) {
  const ids = new Set(evidence.map(e=>e.id));
  for(const paragraph of answer.paragraphs) {
    if(paragraph.kind === "company_fact" && !paragraph.evidenceIds.length) return false;
    if(paragraph.evidenceIds.some(id=>!ids.has(id))) return false;
    // Resource URLs must be in the supplied corpus, not merely be syntactically valid.
    const urls = paragraph.text.match(/https?:\/\/[^\s<>\])]+/g)||[];
    const suppliedUrls = new Set(evidence.flatMap(e=>[
      ...e.sourceIds.filter(id=>/^https?:\/\//.test(id)),
      ...(e.text.match(/https?:\/\/[^\s<>\])]+/g)||[]),
    ]));
    const knownUrl = (url:string) => suppliedUrls.has(url) ||
      [...suppliedUrls].some(source=>source.replace(/[.,;:!?]+$/, "")===url.replace(/[.,;:!?]+$/, ""));
    // Sentence punctuation is not part of an ordinary resource link. Exact
    // matches remain valid, but a shared host or URL prefix is insufficient.
    if(urls.some(url=>!knownUrl(url))) return false;
  }
  if(answer.routeKey && !evidence.some(e=>e.routeKey===answer.routeKey)) return false;
  return true;
}

export function stripInternalCitations(text: string) {
  return text.replace(/\[E\d+(?:\s*[,;]\s*E\d+)*\]/g, "")
    .replace(/\uE200cite\uE202[^\uE201]*\uE201/g, "")
    .replace(/[\uE200-\uE202]/g, "").trim();
}

export async function runAskSalesRevamp(
  question: string, messages: AskSalesFaqChatMessage[] = [],
  options: { provider?: JsonProvider; evidence?: Evidence[]; knowledgeVersion?: string } = {},
): Promise<AskSalesFaqRuntimeResult> {
  const start = Date.now();
  const provider = options.provider || configuredRevampProvider();
  const corpus = options.evidence || getRevampKnowledge();
  const knowledgeVersion = options.knowledgeVersion || REVAMP_KNOWLEDGE_VERSION;
  const safe = sanitizeV4SensitiveText(question,12000);
  // The current request remains complete; bounded history is explicitly contextual.
  const history = messages.slice(-10).map(m=>({role:m.role,content:sanitizeV4SensitiveText(m.content,12000).text}));
  const attempts: Attempt[]=[];
  let contextualQuestion=safe.text;
  let candidates: Evidence[]=[];
  let plan: unknown=null;
  let reviewed=false;
  let answer: Answer;
  let errorClass: string|null=null;
  let validationIssues: Array<{code:string;path:string}> = [];
  async function call(system:string,input:unknown,purpose:string) {
    try {const result=await provider(system,input,purpose);attempts.push(result.attempt);return result.value;}
    catch(error) {if(error instanceof RevampProviderError) attempts.push(error.attempt);throw error;}
  }
  try {
    const companyContext=corpus.filter(r=>r.domains?.includes("company_context") && r.scopes.includes("shared"));
    // Resolve intent from the conversation before retrieval. A recency-sorted
    // source-title catalog biased ambiguous follow-ups toward newly added
    // products, even when the user's preceding topic was a different product.
    const rawPlan=await call(PLAN_PROMPT,{question:safe.text,history,companyContext},"plan");
    // DeepSeek JSON mode may echo the evidence scope "shared". In a query
    // this means no product restriction, not a new product or a parsing failure.
    const normalizedPlan=rawPlan && typeof rawPlan==="object" && "scopes" in rawPlan && Array.isArray(rawPlan.scopes)
      ? {...rawPlan,scopes:rawPlan.scopes.filter(scope=>scope!=="shared")} : rawPlan;
    const resolved=planSchema.parse(normalizedPlan);
    plan=resolved;contextualQuestion=resolved.question;
    // An uncertain intent must not bypass grounding. Even a conversational
    // follow-up can ask to confirm a company fact from a previous answer.
    candidates = retrieveEvidence(corpus,safe.text,resolved).map(c=>c.record);
    const aliases=new Map(candidates.map((record,i)=>[`E${i+1}`,record.id]));
    const shortIds=new Map(candidates.map((record,i)=>[record.id,`E${i+1}`]));
    const capabilities={canReadLiveAccounts:false,canBookOrModifyMeetings:false,canSendMessages:false,canApproveExceptions:false,canDraftAndExplain:true};
    const input={question:safe.text,history,plan:resolved,capabilities,currentDate:new Date().toISOString().slice(0,10),evidence:candidates.map((record,i)=>({...record,id:`E${i+1}`,
      governingEvidenceIds:record.conditions.filter(flag=>flag.startsWith("governing_evidence:")).map(flag=>shortIds.get(flag.slice("governing_evidence:".length))).filter(Boolean),
    }))};
    const draft=await call(ANSWER_PROMPT,input,"answer");
    // Every answer takes the same bounded review path. A mistaken conversation
    // label cannot let unsupported company facts escape as casual conversation.
    reviewed=true;
    answer=answerSchema.parse(await call(REVIEW_PROMPT,{...input,draft},"review"));
    answer={...answer,paragraphs:answer.paragraphs.map(paragraph=>({...paragraph,
      evidenceIds:paragraph.evidenceIds.map(id=>aliases.get(id)||`UNKNOWN:${id}`),
      text:stripInternalCitations(paragraph.text),
    }))};
    if(!validateEvidenceReferences(answer,candidates)) throw new Error("invalid_evidence_references");
  } catch(error) {
    if(error instanceof ZodError) validationIssues=error.issues.map(issue=>({code:issue.code,path:issue.path.join(".")}));
    errorClass=error instanceof RevampProviderError ? `revamp_${error.attempt.error}` : "revamp_invalid_output";
    answer={status:"knowledge_gap",paragraphs:[{text:"I couldn’t complete that answer because of a technical problem. Please try again shortly.",kind:"uncertainty",evidenceIds:[]}],routeKey:null};
  }
  const selectedIds=[...new Set(answer.paragraphs.flatMap(p=>p.evidenceIds))];
  const selected=candidates.filter(c=>selectedIds.includes(c.id));
  const text=answer.paragraphs.map(p=>p.text).join("\n\n");
  const needsRoute=answer.status==="action_route";
  const outcome=errorClass?"safe_fallback":answer.status==="conversation"?"conversation_reply":
    ["knowledge_gap","conflict","clarification"].includes(answer.status)?"low_confidence_route":needsRoute?"route_from_evidence":"answer_from_evidence";
  const lastAttempt=attempts.filter(a=>a.status==="success").at(-1);
  return {
    ok:true,conversationId:"",messageId:"",answer:text,
    structuredAnswer:{summary:text,sections:[],confidenceBasis:"unscored",confidenceLabel:"Low",confidenceScore:0,
      sourceMode:errorClass?"fallback":selected.length?"evidence":"conversation"},
    outcome,needsRoute,routeReason:needsRoute?answer.routeKey:null,
    source:selected.length?{label:selected.length===1?selected[0].title:`${selected.length} supporting sources`,
      // Oldest selected review date avoids presenting old evidence as newly reviewed.
      lastReviewed:selected.map(s=>s.reviewedAt).filter(Boolean).sort()[0]||"",approved:false,sourceMode:"evidence"}:null,
    provider:lastAttempt?.provider||null,model:lastAttempt?.model||null,redactions:safe.redactions,
    latencyMs:Date.now()-start,sanitizedQuestion:safe.text,contextualQuestion,matchedArticleId:null,errorClass,
    runtimeMetadata:{pipelineVersion:"revamp",knowledgeVersion,providerAttempts:attempts.map(a=>({...a,totalTokens:a.inputTokens+a.outputTokens,completionTokens:a.outputTokens})),
      revamp:{validationIssues,status:errorClass?"technical_failure":answer.status,plan,reviewed,selectedEvidenceIds:selectedIds,
        candidateIds:candidates.map(c=>c.id),corpusSize:corpus.length,answerParagraphs:answer.paragraphs,historyMessages:history.length}},
  };
}
