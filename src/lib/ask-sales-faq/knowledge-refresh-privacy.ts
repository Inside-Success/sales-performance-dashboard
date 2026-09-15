/** Source snapshots retain useful policy URLs and official contact information.
 * Credentials and financial identifiers are never useful knowledge evidence. */
export function redactKnowledgeRefreshContent(value: string) {
  const redactions: string[]=[];
  let text=value.replace(/\u0000/g, "").replace(/\r\n?/g,"\n").slice(0,250_000);
  const rules:Array<{label:string;pattern:RegExp;replacement:string}>=[
    {label:"credential",pattern:/\b((?:password|passcode)\s*(?:(?:is)\s+|[:=]\s*))([^,;\n.!?]{1,200})/gi,replacement:"$1[redacted credential]"},
    {label:"credential",pattern:/\b((?:api[ _-]?key|secret|login token|access token|auth token)\s*(?:(?:is)\s+|[:=]\s*))([^\s,;]+)/gi,replacement:"$1[redacted credential]"},
    {label:"api_key",pattern:/\b(?:sk|xai|api|key|token)[-_][A-Za-z0-9_-]{16,}\b|\bgh(?:p|o|u|s|r)_[A-Za-z0-9]{20,}\b|\bgithub_pat_[A-Za-z0-9_]{20,}\b|\bxox(?:b|p|a|r|s)-[A-Za-z0-9-]{10,}\b/g,replacement:"[redacted api_key]"},
    {label:"credential",pattern:/([?&](?:access_token|token|api_key|secret|signature|x-amz-signature)=)[^&\s<>]+/gi,replacement:"$1[redacted credential]"},
    {label:"ssn",pattern:/\b\d{3}-\d{2}-\d{4}\b/g,replacement:"[redacted ssn]"},
    {label:"payment_number",pattern:/\b(?:\d[ -]*?){13,19}\b/g,replacement:"[redacted payment_number]"},
  ];
  for(const rule of rules) {
    if(rule.pattern.test(text)) redactions.push(rule.label);
    rule.pattern.lastIndex=0;text=text.replace(rule.pattern,rule.replacement);
  }
  return {text:text.trim(),redactions:[...new Set(redactions)].sort()};
}
