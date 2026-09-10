// Isolated candidate, not wired into production. Source text is never model-generated.
function transcriptTurns(transcript) {
  const source = String(transcript).split(/Full Transcript\s*\n/).pop();
  return [...source.matchAll(/^\[([^\]]+)\]\s*([^:\n]+):\s*(.*)$/gm)].map((m, i) => ({
    id: 'T' + String(i + 1).padStart(4, '0'), timestamp: '[' + m[1] + ']', speaker: m[2].trim(), text: m[3],
  }));
}
function sourceEvidence(turns, id) {
  if (id === null) return null;
  const turn = turns.find(t => t.id === id);
  if (!turn) throw new Error('Unknown transcript turn ID');
  return { timestamp: turn.timestamp, quote: turn.text, speaker: turn.speaker, turn_id: turn.id };
}
function hydrateReview(review, turns, repName) {
  const manager = JSON.parse(JSON.stringify(review.manager_score));
  const evidence = id => sourceEvidence(turns, id);
  for (const d of Object.values(manager.dimensions)) {
    d.evidence = evidence(d.evidence_id);
    d.counterevidence = d.counterevidence_ids.map(evidence);
    delete d.evidence_id; delete d.counterevidence_ids;
  }
  for (const [name, signal] of Object.entries(manager.close_signals)) {
    if (signal.present && !signal.evidence_id) throw new Error('Present signal without evidence');
    signal.evidence = evidence(signal.evidence_id);
    signal.request_text = null;
    if (name === 'direct_commitment_ask' && signal.present) {
      if (signal.evidence.speaker.split(/[|｜]/)[0].trim().toLowerCase() !== repName.trim().toLowerCase()) throw new Error('Commitment ask attributed to another speaker');
      signal.request_text = signal.evidence.quote;
    }
    delete signal.evidence_id;
  }
  for (const event of manager.critical_events) {
    event.evidence = evidence(event.evidence_id); delete event.evidence_id;
  }
  for (const correction of review.corrections) for (const id of correction.evidence_ids) evidence(id);
  return manager;
}
module.exports = { transcriptTurns, sourceEvidence, hydrateReview };
