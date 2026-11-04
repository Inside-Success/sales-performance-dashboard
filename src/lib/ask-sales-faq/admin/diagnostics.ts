export const answerStatusLabels: Record<string, string> = {
  partial: "Partially answered", clarification: "Asked for clarification",
  knowledge_gap: "Source information missing", conflict: "Conflicting guidance",
  action_route: "Needs a person to act", technical_failure: "Technical failure",
};
export function answerStatusLabel(status?: string | null) { return status ? answerStatusLabels[status] || null : null; }
export function recoveryLabel(retryCount: number | null | undefined, failed: boolean) {
  if (retryCount == null) return "Recovery detail not recorded";
  if (retryCount > 0) return failed ? "Automatic retry used; answer still failed" : "Recovered after an automatic retry";
  return failed ? "No automatic retry used" : "Completed without an automatic retry";
}
