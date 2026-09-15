import { describe, expect, it } from "vitest";
import { sanitizeV4SensitiveText } from "@/lib/ask-sales-faq/v4/privacy";

describe("street address numeric boundaries", () => {
  it.each(["$30,000", "$30000", "30,000", "€30,000", "£30000", "$30.000"])("preserves the complete amount %s and surrounding sales intent", amount => {
    const question = `Explain the ${amount} reality-show VIP deliverables in a way a new sales rep can use.`;
    const safe = sanitizeV4SensitiveText(question);
    expect(safe.text).toBe(question);
    expect(safe.redactions).not.toContain("street_address");
  });
  it.each(["123 Main Street", "456 N Ocean Drive, Suite 7", "1234 Long Meadow Way", "987 NE First Ave"])("still redacts an actual address: %s", address => {
    const safe = sanitizeV4SensitiveText(`The client lives at ${address}. Can they apply?`);
    expect(safe.text).toContain("[redacted street address]");
    expect(safe.text).not.toContain(address);
  });
  it("preserves package context while redacting a separate address and credentials", () => {
    const safe = sanitizeV4SensitiveText("Explain $30,000 reality VIP in a way I can use. Client address: 123 Main Street. Email: rep@example.com. Password: private-secret.");
    expect(safe.text).toContain("$30,000 reality VIP in a way I can use");
    expect(safe.text).toContain("[redacted street address]");
    expect(safe.text).not.toContain("rep@example.com");
    expect(safe.text).not.toContain("private-secret");
  });
});
