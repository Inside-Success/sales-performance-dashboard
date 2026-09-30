// Complete explicit template slots without inventing a value. Citations and ordinary
// bracketed transcript text are deliberately outside this small grammar.
function placeholderNoun(label) {
  const key = label.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  const plain = key.replace(/^(?:confirmed|approved|actual|insert|enter|fill in|replace with)\s+/, '');
  if (/^(?:initial|first|upfront) (?:payment |deposit )?amount$/.test(plain)) return 'initial payment amount';
  if (/^(?:deposit|payment|installment|remaining|balance|total|license|package)?\s*(?:amount|price|cost)$/.test(plain)) {
    if (/deposit/.test(plain)) return 'deposit amount';
    if (/installment/.test(plain)) return 'installment amount';
    if (/remaining|balance/.test(plain)) return 'remaining balance';
    if (/price|cost/.test(plain)) return 'price';
    return 'payment amount';
  }
  if (/^(?:follow up |callback |meeting |specific )?(?:date|time|date and time)$/.test(plain)) return 'follow-up time';
  if (/^(?:client|prospect|buyer|customer) name$/.test(plain)) return 'prospect';
  if (/^(?:rep|sales rep) name$/.test(plain)) return 'rep';
  if (/^(?:show|program|series) name$/.test(plain)) return 'show';
  if (/^(?:tbd|todo|placeholder)$/.test(key) || /^(?:insert|enter|fill in|replace with)\b/.test(key)) return 'detail to confirm';
  return null;
}

function completeCoachingText(value) {
  if (typeof value !== 'string') return value;
  // Currency belongs to a real number, never to a generic noun.
  return value.replace(/[$£€]?(?:\[([^\]\n]{1,100})\]|\{\{([^}\n]{1,100})\}\}|<((?:insert|enter|fill in|replace with)[^>\n]{1,100})>)/gi,
    (marker, bracket, variable, tag, offset, whole) => {
      const noun = placeholderNoun(bracket || variable || tag);
      if (!noun) return marker;
      const prefix = whole.slice(0, offset);
      return /\b(?:the|a|an|actual|your|their|his|her|its)\s*$/i.test(prefix) ? noun : 'the ' + noun;
    });
}

function completeCoachingValue(value) {
  if (typeof value === 'string') return completeCoachingText(value);
  if (Array.isArray(value)) return value.map(completeCoachingValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, completeCoachingValue(child)]));
  return value;
}

module.exports = { placeholderNoun, completeCoachingText, completeCoachingValue };
