/** The lab has no production data client and is never available in production. */
export function canReadCoachingLab(environment: string | undefined, email: string | null | undefined) {
  return environment === "preview" && email?.trim().toLowerCase() === "syed.haider@insidesuccess.com";
}
