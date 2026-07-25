const NEGATIVE_EFFECT = /\b(?:do\s+not|don't|does\s+not|doesn't|must\s+not|should\s+not|cannot|can't|may\s+not|not\s+allowed|not\s+permitted|prohibited|never|no\s+(?:custom|automatic|guaranteed)|will\s+not)\b/i;
const POSITIVE_EFFECT = /\b(?:may|can|allowed|permitted|required|must|should|will|yes)\b/i;

const EFFECT_STOP = new Set([
  "a", "an", "and", "answer", "applicant", "are", "as", "at", "before", "boundaries", "business", "call", "can",
  "client", "conditions", "could", "decision", "does", "evidence", "for", "from", "have", "into", "lead", "must", "only",
  "policy", "prospect", "representative", "sales", "should", "source", "that", "the", "their", "this", "when", "with", "would",
]);

function stem(value: string) {
  if (value.length <= 4) return value;
  return value
    .replace(/ies$/i, "y")
    .replace(/(?:ing|ers|er|ed|es|s)$/i, "");
}

export function primaryMaterialDecision(value: string) {
  return value
    .split(/\b(?:Conditions?|Boundaries):/i)[0]
    .replace(/\s+/g, " ")
    .trim();
}

export type V54MaterialEffect = {
  polarity: "positive" | "negative" | "neutral";
  numbers: string[];
  terms: string[];
};

export function classifyV54MaterialEffect(value: string): V54MaterialEffect {
  const decision = primaryMaterialDecision(value);
  const polarity = NEGATIVE_EFFECT.test(decision)
    ? "negative"
    : POSITIVE_EFFECT.test(decision)
      ? "positive"
      : "neutral";
  const numbers = [...new Set(decision.match(/(?:(?:[$£€]\s*)?\d+(?:\.\d+)?|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve))\s*(?:%|percent|minutes?|hours?|days?|weeks?|months?|years?|payments?|installments?|cards?|episodes?|platforms?)?/gi) || [])]
    .map((number) => number.toLowerCase().replace(/\s+/g, ""));
  const terms = [...new Set(decision.toLowerCase()
    .replace(/[^a-z0-9%$]+/g, " ")
    .split(/\s+/)
    .map(stem)
    .filter((term) => term.length >= 3 && !EFFECT_STOP.has(term)))];
  return { polarity, numbers, terms };
}

function comparableNumbers(left: string[], right: string[]) {
  if (!left.length || !right.length) return true;
  return left.some((number) => right.includes(number));
}

/**
 * This is deliberately narrower than semantic similarity. Callers must first
 * prove that both sources govern the same requested decision. Once identity is
 * established, opposite permission effects or incompatible controlled values
 * are genuine conflicts; everything else is supporting or incomplete evidence.
 */
export function v54MaterialEffectsConflict(left: string, right: string) {
  const leftEffect = classifyV54MaterialEffect(left);
  const rightEffect = classifyV54MaterialEffect(right);
  if (new Set([leftEffect.polarity, rightEffect.polarity]).has("positive") &&
    new Set([leftEffect.polarity, rightEffect.polarity]).has("negative")) return true;
  if (!comparableNumbers(leftEffect.numbers, rightEffect.numbers)) return true;
  return false;
}

export function v54MaterialEffectsSupport(left: string, right: string) {
  if (v54MaterialEffectsConflict(left, right)) return false;
  const leftEffect = classifyV54MaterialEffect(left);
  const rightEffect = classifyV54MaterialEffect(right);
  const sharedTerms = leftEffect.terms.filter((term) => rightEffect.terms.includes(term));
  return leftEffect.polarity === rightEffect.polarity || sharedTerms.length >= 2;
}

export function v54DecisionsFormConsensus(values: string[]) {
  if (!values.length) return false;
  for (let left = 0; left < values.length; left += 1) {
    for (let right = left + 1; right < values.length; right += 1) {
      if (!v54MaterialEffectsSupport(values[left], values[right])) return false;
    }
  }
  return true;
}
