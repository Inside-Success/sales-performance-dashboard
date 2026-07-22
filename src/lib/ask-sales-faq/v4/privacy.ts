export type V4SensitiveRedaction =
  | "url"
  | "email"
  | "payment_card"
  | "phone"
  | "contact_identifier"
  | "credential"
  | "financial_identifier"
  | "person_name"
  | "street_address";

type ReplacementRule = {
  label: V4SensitiveRedaction;
  pattern: RegExp;
  replacement: string;
};

const SIMPLE_REPLACEMENTS: ReplacementRule[] = [
  {
    label: "url",
    pattern: /\b(?:https?:\/\/|www\.)[^\s<>()\[\]{}"']+/gi,
    replacement: "[redacted URL]",
  },
  {
    label: "credential",
    pattern: /\b((?:password|passcode)\s*(?:(?:is)\s+|[:=]\s*))([^,;\n.!?]{1,200})/gi,
    replacement: "$1[redacted credential]",
  },
  {
    label: "credential",
    pattern: /\b((?:api[ _-]?key|secret|login token|access token|auth token|username)\s*(?:(?:is)\s+|[:=]\s*))([^\s,;]+)/gi,
    replacement: "$1[redacted credential]",
  },
  {
    label: "credential",
    pattern: /\b(?:sk|api|key|token)[-_][A-Za-z0-9_-]{16,}\b|\bgh(?:p|o|u|s|r)_[A-Za-z0-9]{20,}\b|\bgithub_pat_[A-Za-z0-9_]{20,}\b|\bxox(?:b|p|a|r|s)-[A-Za-z0-9-]{10,}\b/g,
    replacement: "[redacted credential]",
  },
  {
    label: "financial_identifier",
    pattern: /\b((?:bank\s+)?account(?:\s+(?:number|no\.?))?|routing(?:\s+(?:number|no\.?))?|aba|iban|swift|ssn|social security(?:\s+number)?|tax(?:payer)?\s+id)(?:(?:\s+is)?\s*[:=#]\s*|\s+)((?:[A-Z]{2}\d{2}[A-Z0-9 ]{8,30})|(?:\d[\d -]{3,32}\d))/gi,
    replacement: "$1: [redacted financial identifier]",
  },
  {
    label: "contact_identifier",
    pattern: /\b((?:(?:client|prospect|customer|lead|contact|applicant)(?:\s+(?:record|contact))?|(?:crm|keap)(?:\s+contact)?)\s+(?:id|identifier)\s*(?:(?:is)\s+|[:=#]\s*|\s+))(["']?[A-Za-z0-9][A-Za-z0-9_.:-]*["']?)/gi,
    replacement: "$1[redacted contact identifier]",
  },
  {
    label: "street_address",
    pattern: /\b\d{1,6}\s+(?:(?:N|S|E|W|NE|NW|SE|SW)\.?\s+)?(?:[A-Za-z0-9][A-Za-z0-9.'’-]*\s+){1,6}(?:Street|Avenue|Boulevard|Road|Lane|Drive|Court|Circle|Highway|Parkway|Terrace|Place|Trail|Way|St|Ave|Blvd|Rd|Ln|Dr|Ct|Cir|Hwy|Pkwy)\.?(?![A-Za-z])(?:\s*,?\s*(?:Apt|Apartment|Suite|Ste|Unit|#)\s*[A-Za-z0-9-]+)?/gi,
    replacement: "[redacted street address]",
  },
  {
    label: "email",
    pattern: /\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g,
    replacement: "[redacted email]",
  },
  {
    label: "url",
    pattern: /(?<!@)\b(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+(?:com|net|org|io|co|app|tv|ai|us|biz|info)(?:\/[^\s<>()\[\]{}"']*)?/gi,
    replacement: "[redacted URL]",
  },
  {
    label: "payment_card",
    pattern: /\b(?:\d[ -]*?){13,19}\b/g,
    replacement: "[redacted payment card]",
  },
  {
    label: "phone",
    pattern: /(?:\+|00)\d[\d ()-]{8,}\d/g,
    replacement: "[redacted phone]",
  },
  {
    label: "phone",
    pattern: /\b(?:\+?1[ .-]?)?\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4}\b/g,
    replacement: "[redacted phone]",
  },
];

const LABELED_PERSON_PATTERNS = [
  /\b((?:client|prospect|customer|lead|contact|applicant)(?:'s)?\s+(?:full\s+)?name\s*(?:(?:is)\s+|[:=]\s*))([^,;\n.!?]{1,100})/gi,
  /\b((?:the\s+)?(?:client|prospect|customer|lead|contact|applicant)\s+(?:is|was|named|called)\s+)([^,;\n.!?]{1,100})/gi,
  /\b((?:client|prospect|customer|lead|contact|applicant)\s*:\s*)([^,;\n.!?]{1,100})/gi,
];

const PERSON_NAME_PREFIX = /^(\s*["']?)([\p{Lu}][\p{L}\p{M}'’.-]*(?:\s+(?!(?:is|was|has|had|needs?|asked?|wants?|wanted|said|says|emailed|texted|lives?|works?|from|at|with|about|for|and|but|who|whose|that|should|can|will|would|paid|booked)\b)[\p{Lu}][\p{L}\p{M}'’.-]*){0,3})(["']?)/u;

function redactLabeledPersonNames(value: string) {
  let text = value;
  let matched = false;
  for (const pattern of LABELED_PERSON_PATTERNS) {
    text = text.replace(pattern, (whole, label: string, candidate: string) => {
      const name = candidate.match(PERSON_NAME_PREFIX);
      if (!name) return whole;
      matched = true;
      const consumed = name[0].length;
      return `${label}${name[1]}[redacted person name]${name[3]}${candidate.slice(consumed)}`;
    });
  }
  return { text, matched };
}

/**
 * Removes a narrow set of customer/prospect identifiers before isolated V4
 * text reaches a model or an encrypted history token. Unlabelled names are
 * deliberately preserved so authoritative guidance such as "Mike approved"
 * keeps its policy meaning.
 */
export function sanitizeV4SensitiveText(value: string, limit?: number) {
  const redactions: V4SensitiveRedaction[] = [];
  let text = String(value || "");

  const personResult = redactLabeledPersonNames(text);
  text = personResult.text;
  if (personResult.matched) redactions.push("person_name");

  for (const rule of SIMPLE_REPLACEMENTS) {
    rule.pattern.lastIndex = 0;
    const matched = rule.pattern.test(text);
    rule.pattern.lastIndex = 0;
    if (!matched) continue;
    text = text.replace(rule.pattern, rule.replacement);
    redactions.push(rule.label);
  }

  const normalized = text.replace(/\s+/g, " ").trim();
  return {
    text: typeof limit === "number" ? normalized.slice(0, Math.max(0, limit)) : normalized,
    redactions: [...new Set(redactions)],
  };
}
