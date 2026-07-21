import { timingSafeEqual } from "node:crypto";

export const V4_ISOLATION_FLAG = "ASK_SALES_V4_ISOLATED";

function isExplicitVercelPreview() {
  return process.env.VERCEL_ENV === "preview";
}

export function isV4IsolatedRuntimeEnabled() {
  return process.env[V4_ISOLATION_FLAG] === "true" && isExplicitVercelPreview();
}

export function assertV4IsolatedRuntime() {
  if (process.env[V4_ISOLATION_FLAG] !== "true") {
    throw new Error("V4 isolated runtime is disabled");
  }
  if (!isExplicitVercelPreview()) {
    throw new Error("V4 isolated runtime runs only in an explicit Vercel preview environment");
  }
  if ((process.env.ASK_SALES_V4_LAB_TOKEN || "").length < 24) {
    throw new Error("V4 isolated runtime requires a capability token of at least 24 characters");
  }
}

export function isV4LabTokenAuthorized(candidate: string | null) {
  const expected = process.env.ASK_SALES_V4_LAB_TOKEN || "";
  if (expected.length < 24 || !candidate) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(candidate);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function describeV4Isolation() {
  return {
    enabled: isV4IsolatedRuntimeEnabled(),
    productionSelectorChanged: false as const,
    databaseWrites: false as const,
    historyPersistence: false as const,
    databaseEnvironmentRead: false as const,
  };
}
