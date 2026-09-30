/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS transforms also run directly in isolated n8n replay scripts. */
const { placeholderNoun, completeCoachingText, completeCoachingValue } = require('../../src/lib/coaching-placeholder.cjs');
const { replaceOnce } = require('./patches.cjs');
const COMPLETE_WORDING = 'Write finished, rep-facing advice. Never output template placeholders or fill-in slots. When a number, date or name is unavailable, use a complete generic phrase such as the initial payment amount or ask what time works. Do not invent a number, approved term, date, name or buyer statement.';
function writerWording(source) {
  return replaceOnce(source, 'Do not recommend numeric amounts or dates in example dialogue; use placeholders such as [confirmed initial amount] or ask what time works.', COMPLETE_WORDING);
}
function reviewerWording(source) {
  return replaceOnce(source, 'Using [confirmed initial amount] is fine.', COMPLETE_WORDING + ' A template slot does not invalidate a supported core action: narrow that same improvement to complete generic wording using corrected_improvements. Reject an unsupported core premise as usual.');
}
function repairWording(source) {
  return replaceOnce(source, 'REDUCTIVE-ONLY: delete, remove offending span, or generalize using transcript-supported wording.', 'REDUCTIVE-ONLY: delete, remove offending span, or generalize using transcript-supported wording. ' + COMPLETE_WORDING);
}
const FINAL_FUNCTIONS = '\n' + [placeholderNoun, completeCoachingText, completeCoachingValue].map(fn => fn.toString()).join('\n') + '\n';
function finalWording(source) {
  source = replaceOnce(source, 'const complete = applyCompletenessBackstop(coaching);', FINAL_FUNCTIONS + '\nconst beforePlaceholderCompletion = coaching;\ncoaching = completeCoachingValue(coaching);\nconst placeholderCompletionChanged = JSON.stringify(coaching) !== JSON.stringify(beforePlaceholderCompletion);\nconst complete = applyCompletenessBackstop(coaching);');
  return replaceOnce(source, 'completeness_rows: complete.rows', 'completeness_rows: complete.rows, placeholder_completion_changed: placeholderCompletionChanged');
}
module.exports = { COMPLETE_WORDING, writerWording, reviewerWording, repairWording, finalWording };
