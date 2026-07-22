import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { sanitizeV4SensitiveText } from "@/lib/ask-sales-faq/v4/privacy";

const V4_HISTORY_SCHEMA_VERSION = 2;
const V4_HISTORY_AUDIENCE = "ask-sales-v4-isolated-history";
const V4_HISTORY_TOKEN_VERSION = "v4h2";
const V4_HISTORY_AAD = Buffer.from(`${V4_HISTORY_TOKEN_VERSION}:${V4_HISTORY_AUDIENCE}`, "utf8");
const V4_HISTORY_FALLBACK_RUNTIME_REVISION = "ask-sales-v4-isolated-history-r2";
const V4_HISTORY_TTL_SECONDS = 60 * 60;
const V4_HISTORY_CLOCK_SKEW_SECONDS = 60;
const V4_HISTORY_MAX_PAIRS = 2;
const V4_HISTORY_MAX_TOKEN_BYTES = 64 * 1024;
const V4_HISTORY_MAX_PAYLOAD_BYTES = 48 * 1024;
const V4_HISTORY_MAX_MESSAGE_CHARS = 16_000;
const V4_HISTORY_SECRET_MIN_CHARS = 32;

const conversationIdSchema = z.string()
  .min(1)
  .max(120)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/);

const historyMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(V4_HISTORY_MAX_MESSAGE_CHARS),
}).strict();

const historyPayloadSchema = z.object({
  v: z.literal(V4_HISTORY_SCHEMA_VERSION),
  aud: z.literal(V4_HISTORY_AUDIENCE),
  cid: conversationIdSchema,
  iat: z.number().int().nonnegative(),
  exp: z.number().int().positive(),
  kv: z.string().min(1).max(200),
  rv: z.string().min(1).max(300),
  messages: z.array(historyMessageSchema).min(2).max(V4_HISTORY_MAX_PAIRS * 2),
}).strict();

export type V4HistoryMessage = z.infer<typeof historyMessageSchema>;

type V4HistoryPayload = z.infer<typeof historyPayloadSchema>;

export type VerifiedV4History = {
  conversationId: string;
  messages: V4HistoryMessage[];
  issuedAt: number;
  expiresAt: number;
};

export class V4HistoryTokenError extends Error {
  constructor() {
    super("The isolated conversation history could not be verified.");
    this.name = "V4HistoryTokenError";
  }
}

function signingSecret() {
  const secret = process.env.ASK_SALES_V4_HISTORY_SIGNING_SECRET || "";
  const labToken = process.env.ASK_SALES_V4_LAB_TOKEN || "";
  if (secret.length < V4_HISTORY_SECRET_MIN_CHARS || (labToken.length >= 24 && secret === labToken)) throw new V4HistoryTokenError();
  return secret;
}

function runtimeRevision() {
  return String(
    process.env.VERCEL_URL ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    V4_HISTORY_FALLBACK_RUNTIME_REVISION,
  ).slice(0, 300);
}

function sanitizeHistoryContent(value: string) {
  return sanitizeV4SensitiveText(value).text;
}

export function isV4HistorySigningConfigured() {
  const secret = process.env.ASK_SALES_V4_HISTORY_SIGNING_SECRET || "";
  const labToken = process.env.ASK_SALES_V4_LAB_TOKEN || "";
  return secret.length >= V4_HISTORY_SECRET_MIN_CHARS && (labToken.length < 24 || secret !== labToken);
}

function fail(): never {
  throw new V4HistoryTokenError();
}

function canonicalBase64Url(value: string) {
  if (!value || !/^[A-Za-z0-9_-]+$/.test(value)) fail();
  const decoded = Buffer.from(value, "base64url");
  if (decoded.toString("base64url") !== value) fail();
  return decoded;
}

function encryptionKey() {
  return createHash("sha256")
    .update("ask-sales-v4-isolated-history-aes-gcm\0", "utf8")
    .update(signingSecret(), "utf8")
    .digest();
}

function validRoleOrder(messages: V4HistoryMessage[]) {
  return messages.length % 2 === 0 && messages.every((message, index) =>
    message.role === (index % 2 === 0 ? "user" : "assistant"),
  );
}

function validPayloadTiming(payload: V4HistoryPayload, now: number) {
  return payload.exp > payload.iat &&
    payload.exp - payload.iat === V4_HISTORY_TTL_SECONDS &&
    payload.iat <= now + V4_HISTORY_CLOCK_SKEW_SECONDS &&
    payload.exp > now;
}

export function verifyV4HistoryToken(input: {
  token: string;
  knowledgeVersion: string;
  conversationId?: string;
}): VerifiedV4History {
  try {
    if (Buffer.byteLength(input.token, "utf8") > V4_HISTORY_MAX_TOKEN_BYTES) fail();
    const segments = input.token.split(".");
    if (segments.length !== 4 || segments[0] !== V4_HISTORY_TOKEN_VERSION) fail();
    const initializationVector = canonicalBase64Url(segments[1] || "");
    const ciphertext = canonicalBase64Url(segments[2] || "");
    const authenticationTag = canonicalBase64Url(segments[3] || "");
    if (initializationVector.byteLength !== 12 || authenticationTag.byteLength !== 16) fail();
    if (ciphertext.byteLength > V4_HISTORY_MAX_PAYLOAD_BYTES + 32) fail();
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), initializationVector);
    decipher.setAAD(V4_HISTORY_AAD);
    decipher.setAuthTag(authenticationTag);
    const payloadBuffer = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    if (payloadBuffer.byteLength > V4_HISTORY_MAX_PAYLOAD_BYTES) fail();

    const parsedJson = JSON.parse(payloadBuffer.toString("utf8")) as unknown;
    const parsed = historyPayloadSchema.safeParse(parsedJson);
    if (!parsed.success) fail();
    const payload = parsed.data;
    const now = Math.floor(Date.now() / 1000);
    if (!validPayloadTiming(payload, now)) fail();
    if (payload.kv !== input.knowledgeVersion) fail();
    if (payload.rv !== runtimeRevision()) fail();
    if (input.conversationId !== undefined && payload.cid !== input.conversationId) fail();
    if (!validRoleOrder(payload.messages)) fail();

    return {
      conversationId: payload.cid,
      messages: payload.messages.map((message) => ({ ...message })),
      issuedAt: payload.iat,
      expiresAt: payload.exp,
    };
  } catch (error) {
    if (error instanceof V4HistoryTokenError) throw error;
    throw new V4HistoryTokenError();
  }
}

export function mintV4HistoryToken(input: {
  conversationId: string;
  knowledgeVersion: string;
  previousMessages?: V4HistoryMessage[];
  question: string;
  answer: string;
}) {
  try {
    const conversationId = conversationIdSchema.parse(input.conversationId);
    const knowledgeVersion = z.string().min(1).max(200).parse(input.knowledgeVersion);
    const previousMessages = z.array(historyMessageSchema).max(V4_HISTORY_MAX_PAIRS * 2).parse(
      (input.previousMessages || []).map((message) => ({ ...message, content: sanitizeHistoryContent(message.content) })),
    );
    if (previousMessages.length && !validRoleOrder(previousMessages)) fail();
    const currentPair = z.array(historyMessageSchema).length(2).parse([
      { role: "user", content: sanitizeHistoryContent(input.question) },
      { role: "assistant", content: sanitizeHistoryContent(input.answer) },
    ]);
    const messages = [...previousMessages, ...currentPair].slice(-(V4_HISTORY_MAX_PAIRS * 2));
    if (!validRoleOrder(messages)) fail();

    const issuedAt = Math.floor(Date.now() / 1000);
    const payload: V4HistoryPayload = {
      v: V4_HISTORY_SCHEMA_VERSION,
      aud: V4_HISTORY_AUDIENCE,
      cid: conversationId,
      iat: issuedAt,
      exp: issuedAt + V4_HISTORY_TTL_SECONDS,
      kv: knowledgeVersion,
      rv: runtimeRevision(),
      messages,
    };
    const serialized = Buffer.from(JSON.stringify(payload), "utf8");
    if (serialized.byteLength > V4_HISTORY_MAX_PAYLOAD_BYTES) fail();
    const initializationVector = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", encryptionKey(), initializationVector);
    cipher.setAAD(V4_HISTORY_AAD);
    const ciphertext = Buffer.concat([cipher.update(serialized), cipher.final()]);
    const authenticationTag = cipher.getAuthTag();
    const token = [
      V4_HISTORY_TOKEN_VERSION,
      initializationVector.toString("base64url"),
      ciphertext.toString("base64url"),
      authenticationTag.toString("base64url"),
    ].join(".");
    if (Buffer.byteLength(token, "utf8") > V4_HISTORY_MAX_TOKEN_BYTES) fail();
    return token;
  } catch (error) {
    if (error instanceof V4HistoryTokenError) throw error;
    throw new V4HistoryTokenError();
  }
}
