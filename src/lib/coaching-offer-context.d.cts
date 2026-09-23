export type CoachingOfferFamily = "reality" | "main_istv" | "next_level_ceo" | "unknown";
export function resolveCoachingOfferFamily(input: {
  showName?: unknown;
  meetingTitle?: unknown;
  transcriptText?: unknown;
  sourcePayload?: Record<string, unknown> | null;
}): { family: CoachingOfferFamily; reason: string };
export function realityCoachingReference(): string;
