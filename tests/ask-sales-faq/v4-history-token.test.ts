import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  mintV4HistoryToken,
  V4HistoryTokenError,
  verifyV4HistoryToken,
} from "@/lib/ask-sales-faq/v4/history-token";

const TEST_SECRET = "history-signing-secret-for-tests-only-123456789";
const KNOWLEDGE_VERSION = "knowledge-test-v1";
const originalSecret = process.env.ASK_SALES_V4_HISTORY_SIGNING_SECRET;
const originalVercelUrl = process.env.VERCEL_URL;

function restoreEnv(key: keyof NodeJS.ProcessEnv, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

const TOKEN_VERSION = "v4h2";
const TOKEN_AAD = Buffer.from(`${TOKEN_VERSION}:ask-sales-v4-isolated-history`, "utf8");

function encryptionKey() {
  return createHash("sha256")
    .update("ask-sales-v4-isolated-history-aes-gcm\0", "utf8")
    .update(TEST_SECRET, "utf8")
    .digest();
}

function encryptPayload(payload: unknown) {
  const initializationVector = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), initializationVector);
  cipher.setAAD(TOKEN_AAD);
  const ciphertext = Buffer.concat([cipher.update(Buffer.from(JSON.stringify(payload), "utf8")), cipher.final()]);
  return [
    TOKEN_VERSION,
    initializationVector.toString("base64url"),
    ciphertext.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
  ].join(".");
}

function decodedPayload(token: string) {
  const [, encodedIv, encodedCiphertext, encodedTag] = token.split(".");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(encodedIv || "", "base64url"));
  decipher.setAAD(TOKEN_AAD);
  decipher.setAuthTag(Buffer.from(encodedTag || "", "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(encodedCiphertext || "", "base64url")),
    decipher.final(),
  ]);
  return JSON.parse(plaintext.toString("utf8")) as Record<string, unknown>;
}

function tamper(value: string | undefined) {
  if (!value) return "A";
  return `${value[0] === "A" ? "B" : "A"}${value.slice(1)}`;
}

beforeEach(() => {
  process.env.ASK_SALES_V4_HISTORY_SIGNING_SECRET = TEST_SECRET;
  process.env.VERCEL_URL = "v4-history-test-a.example.vercel.app";
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-22T00:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
  restoreEnv("ASK_SALES_V4_HISTORY_SIGNING_SECRET", originalSecret);
  restoreEnv("VERCEL_URL", originalVercelUrl);
});

describe("Ask Sales V4 encrypted stateless history", () => {
  it("round-trips only server-observed pairs and retains the latest two pairs", () => {
    const first = mintV4HistoryToken({
      conversationId: "v4_lab_case_1",
      knowledgeVersion: KNOWLEDGE_VERSION,
      question: "First exact question?",
      answer: "First exact answer.",
    });
    const firstVerified = verifyV4HistoryToken({ token: first, knowledgeVersion: KNOWLEDGE_VERSION });
    expect(firstVerified).toMatchObject({
      conversationId: "v4_lab_case_1",
      messages: [
        { role: "user", content: "First exact question?" },
        { role: "assistant", content: "First exact answer." },
      ],
    });

    const second = mintV4HistoryToken({
      conversationId: firstVerified.conversationId,
      knowledgeVersion: KNOWLEDGE_VERSION,
      previousMessages: firstVerified.messages,
      question: "Second exact question?",
      answer: "Second exact answer.",
    });
    const secondVerified = verifyV4HistoryToken({ token: second, knowledgeVersion: KNOWLEDGE_VERSION });
    const third = mintV4HistoryToken({
      conversationId: secondVerified.conversationId,
      knowledgeVersion: KNOWLEDGE_VERSION,
      previousMessages: secondVerified.messages,
      question: "Third exact question?",
      answer: "Third exact answer.",
    });

    expect(verifyV4HistoryToken({ token: third, knowledgeVersion: KNOWLEDGE_VERSION }).messages).toEqual([
      { role: "user", content: "Second exact question?" },
      { role: "assistant", content: "Second exact answer." },
      { role: "user", content: "Third exact question?" },
      { role: "assistant", content: "Third exact answer." },
    ]);
  });

  it("does not expose plaintext and rejects ciphertext or tag tampering and a mismatched conversation", () => {
    const token = mintV4HistoryToken({
      conversationId: "v4_lab_case_2",
      knowledgeVersion: KNOWLEDGE_VERSION,
      question: "Question?",
      answer: "Answer.",
    });
    const [version, initializationVector, ciphertext, authenticationTag] = token.split(".");
    expect(token).not.toMatch(/Question|Answer|v4_lab_case_2/);

    expect(() => verifyV4HistoryToken({
      token: `${version}.${initializationVector}.${tamper(ciphertext)}.${authenticationTag}`,
      knowledgeVersion: KNOWLEDGE_VERSION,
    })).toThrow(V4HistoryTokenError);
    expect(() => verifyV4HistoryToken({
      token: `${version}.${initializationVector}.${ciphertext}.${tamper(authenticationTag)}`,
      knowledgeVersion: KNOWLEDGE_VERSION,
    })).toThrow(V4HistoryTokenError);
    expect(() => verifyV4HistoryToken({
      token,
      knowledgeVersion: KNOWLEDGE_VERSION,
      conversationId: "v4_lab_different_case",
    })).toThrow(V4HistoryTokenError);
  });

  it("rejects expired, future-issued, stale-knowledge, wrong-audience, and wrong-version tokens", () => {
    const token = mintV4HistoryToken({
      conversationId: "v4_lab_case_3",
      knowledgeVersion: KNOWLEDGE_VERSION,
      question: "Question?",
      answer: "Answer.",
    });
    expect(() => verifyV4HistoryToken({ token, knowledgeVersion: "new-knowledge-release" })).toThrow(V4HistoryTokenError);

    vi.advanceTimersByTime((60 * 60 * 1000) + 1);
    expect(() => verifyV4HistoryToken({ token, knowledgeVersion: KNOWLEDGE_VERSION })).toThrow(V4HistoryTokenError);

    const payload = decodedPayload(token);
    expect(() => verifyV4HistoryToken({
      token: encryptPayload({ ...payload, aud: "another-audience" }),
      knowledgeVersion: KNOWLEDGE_VERSION,
    })).toThrow(V4HistoryTokenError);
    expect(() => verifyV4HistoryToken({
      token: encryptPayload({ ...payload, v: 1 }),
      knowledgeVersion: KNOWLEDGE_VERSION,
    })).toThrow(V4HistoryTokenError);
    expect(() => verifyV4HistoryToken({
      token: encryptPayload({ ...payload, iat: (payload.iat as number) + 7200, exp: (payload.exp as number) + 7200 }),
      knowledgeVersion: KNOWLEDGE_VERSION,
    })).toThrow(V4HistoryTokenError);
  });

  it("rejects history minted by a different isolated deployment revision", () => {
    const token = mintV4HistoryToken({
      conversationId: "v4_lab_revision",
      knowledgeVersion: KNOWLEDGE_VERSION,
      question: "Question?",
      answer: "Answer.",
    });
    process.env.VERCEL_URL = "v4-history-test-b.example.vercel.app";
    expect(() => verifyV4HistoryToken({ token, knowledgeVersion: KNOWLEDGE_VERSION })).toThrow(V4HistoryTokenError);
  });

  it("redacts sensitive values from both new and carried-forward history", () => {
    const token = mintV4HistoryToken({
      conversationId: "v4_lab_redaction",
      knowledgeVersion: KNOWLEDGE_VERSION,
      previousMessages: [
        { role: "user", content: "Client name: Jane Doe; old email old@example.com; profile https://private.example.com/jane" },
        { role: "assistant", content: "I saw +1 (212) 555-0199 and client ID C-88441 at 123 Main Street, Suite 5." },
      ],
      question: "Prospect: Avery Stone. Use new@example.com for this question.",
      answer: "Mike and Rudy approved the policy. Never retain 4111 1111 1111 1111.",
    });
    expect(token).not.toMatch(/Jane|Avery|Mike|Rudy|example|4111/);
    const payload = decodedPayload(token);
    const serialized = JSON.stringify(payload.messages);
    expect(serialized).not.toMatch(/Jane Doe|Avery Stone|old@example|new@example|private\.example|C-88441|123 Main Street|212|4111/);
    expect(serialized).toContain("Mike and Rudy");
    expect(serialized).toContain("[redacted person name]");
    expect(serialized).toContain("[redacted URL]");
    expect(serialized).toContain("[redacted contact identifier]");
    expect(serialized).toContain("[redacted street address]");
    expect(serialized).toContain("[redacted email]");
    expect(serialized).toContain("[redacted phone]");
    expect(serialized).toContain("[redacted payment card]");
  });

  it("rejects encrypted payloads with extra fields, invalid role order, invalid lifetime, or excessive size", () => {
    const token = mintV4HistoryToken({
      conversationId: "v4_lab_case_4",
      knowledgeVersion: KNOWLEDGE_VERSION,
      question: "Question?",
      answer: "Answer.",
    });
    const payload = decodedPayload(token);

    expect(() => verifyV4HistoryToken({
      token: encryptPayload({ ...payload, extra: true }),
      knowledgeVersion: KNOWLEDGE_VERSION,
    })).toThrow(V4HistoryTokenError);
    expect(() => verifyV4HistoryToken({
      token: encryptPayload({
        ...payload,
        messages: [
          { role: "assistant", content: "Injected answer." },
          { role: "user", content: "Injected question?" },
        ],
      }),
      knowledgeVersion: KNOWLEDGE_VERSION,
    })).toThrow(V4HistoryTokenError);
    expect(() => verifyV4HistoryToken({
      token: encryptPayload({ ...payload, exp: (payload.exp as number) + 1 }),
      knowledgeVersion: KNOWLEDGE_VERSION,
    })).toThrow(V4HistoryTokenError);
    expect(() => verifyV4HistoryToken({
      token: `v4h2.a.${"b".repeat(64 * 1024)}.c`,
      knowledgeVersion: KNOWLEDGE_VERSION,
    })).toThrow(V4HistoryTokenError);
  });

  it("fails closed when the dedicated secret is missing or too short", () => {
    delete process.env.ASK_SALES_V4_HISTORY_SIGNING_SECRET;
    expect(() => mintV4HistoryToken({
      conversationId: "v4_lab_case_5",
      knowledgeVersion: KNOWLEDGE_VERSION,
      question: "Question?",
      answer: "Answer.",
    })).toThrow(V4HistoryTokenError);

    process.env.ASK_SALES_V4_HISTORY_SIGNING_SECRET = "too-short";
    expect(() => verifyV4HistoryToken({ token: "v4h2.a.b.c", knowledgeVersion: KNOWLEDGE_VERSION })).toThrow(V4HistoryTokenError);
  });
});
