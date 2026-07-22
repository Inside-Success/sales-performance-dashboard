import { describe, expect, it } from "vitest";
import { sanitizeV4SensitiveText } from "@/lib/ask-sales-faq/v4/privacy";
import { runAskSalesFaqV4 } from "@/lib/ask-sales-faq/v4/runtime";
import type { V3Provider } from "@/lib/ask-sales-faq/v3/types";

const unavailableProvider: V3Provider = async () => {
  throw new Error("No model credential is configured in this isolated test");
};

describe("Ask Sales V4 privacy sanitizer", () => {
  it("redacts narrow customer PII while preserving authoritative employee names and policy facts", () => {
    const result = sanitizeV4SensitiveText(
      "Client name: Jane Doe asked me to open https://portal.example.com/cases/7788. " +
      "CRM contact ID: KEAP-7788; meet at 123 North Main Street, Suite 4. " +
      "Email jane@example.com, call +1 (212) 555-0199, and never retain 4111 1111 1111 1111. " +
      "Mike, Rudy, Raul, and Madeline approved the $20,000 policy.",
    );

    expect(result.text).not.toMatch(/Jane Doe|portal\.example|KEAP-7788|123 North Main|jane@example|212|4111/);
    expect(result.text).toContain("Mike, Rudy, Raul, and Madeline");
    expect(result.text).toContain("$20,000");
    expect(new Set(result.redactions)).toEqual(new Set([
      "person_name",
      "url",
      "contact_identifier",
      "street_address",
      "email",
      "phone",
      "payment_card",
    ]));
  });

  it("does not treat unlabelled policy authorities as customer names", () => {
    const result = sanitizeV4SensitiveText(
      "Mike told Rudy that Raul and Madeline own this decision. The current package is $20,000.",
    );

    expect(result).toEqual({
      text: "Mike told Rudy that Raul and Madeline own this decision. The current package is $20,000.",
      redactions: [],
    });
  });

  it("redacts bare domains, dotted phones, credentials, and labelled financial identifiers", () => {
    const result = sanitizeV4SensitiveText(
      "Open private-client.example.com/case/7, call 212.555.0199, password: hunter2, " +
      "API key sk-testcredential123456789, routing number 021000021, and account number: 99887766.",
    );

    expect(result.text).not.toMatch(/private-client|212\.555|hunter2|sk-testcredential|021000021|99887766/);
    expect(result.text).toContain("[redacted URL]");
    expect(result.text).toContain("[redacted phone]");
    expect(result.text).toContain("[redacted credential]");
    expect(result.text).toContain("[redacted financial identifier]");
    expect(result.redactions).toEqual(expect.arrayContaining(["url", "phone", "credential", "financial_identifier"]));
  });

  it("preserves common numeric dates while still redacting phone numbers", () => {
    const result = sanitizeV4SensitiveText(
      "The filming dates are 2026-07-22 and 10-20-2026. Call +44 20 7946 0958 or 212-555-0199.",
    );

    expect(result.text).toContain("2026-07-22");
    expect(result.text).toContain("10-20-2026");
    expect(result.text).not.toMatch(/7946|212-555/);
    expect(result.redactions).toEqual(["phone"]);
  });

  it("redacts multiword passwords plus GitHub and Slack token formats", () => {
    const fakeGitHubToken = ["gh", "p_", "1234567890", "abcdefghij", "1234567890"].join("");
    const fakeSlackToken = ["xo", "xb-", "1234567890", "-", "abcdefghijklmnop"].join("");
    const result = sanitizeV4SensitiveText(
      `Password: correct horse battery staple; GitHub token ${fakeGitHubToken} and Slack token ${fakeSlackToken}.`,
    );

    expect(result.text).not.toMatch(/correct horse|ghp_|xoxb-/i);
    expect(result.text).toContain("Password: [redacted credential]");
    expect(result.redactions).toEqual(["credential"]);
  });

  it("does not mistake a labelled role followed by a lowercase action for a person's name", () => {
    const result = sanitizeV4SensitiveText(
      "Who owns the opportunity when a prospect is considering both main ISTV and Daymond John?",
    );

    expect(result).toEqual({
      text: "Who owns the opportunity when a prospect is considering both main ISTV and Daymond John?",
      redactions: [],
    });
  });

  it("sanitizes the current turn and prior conversation before V4 runtime processing", async () => {
    const result = await runAskSalesFaqV4(
      "What is the current main ISTV price? Mike approved me asking.",
      [
        { role: "user", content: "Client: Prior Person at www.private-example.com/case/55" },
        { role: "assistant", content: "Rudy said the client ID is C-88441." },
      ],
      { provider: unavailableProvider },
    );
    const serialized = JSON.stringify(result);

    expect(serialized).not.toMatch(/Prior Person|private-example|C-88441/);
    expect(serialized).toContain("Mike approved me asking");
    expect(result.redactions).toEqual(expect.arrayContaining(["person_name", "url", "contact_identifier"]));
  });
});
