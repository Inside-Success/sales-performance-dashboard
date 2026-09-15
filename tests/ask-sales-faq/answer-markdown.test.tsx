import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AnswerMarkdown } from "@/components/ask-sales-faq/answer-markdown";

const render = (text: string) => renderToStaticMarkup(<AnswerMarkdown text={text} />);

describe("authored answer formatting", () => {
  it("preserves saved paragraph boundaries and renders actual lists and headings", () => {
    const text = "The VIP package is **$30,000**.\n\n## Included benefits\n\n- Cast profile\n- Promotional assets\n\n## Next steps\n\n1. Review the agreement\n2. Confirm the applicable terms\n\nSubmission does not guarantee publication.";
    const html = render(JSON.parse(JSON.stringify({ summary: text })).summary);
    expect(html).toContain("<strong>$30,000</strong>");
    expect(html).toContain("<ul>");
    expect(html).toContain("<ol>");
    expect(html).toContain("<li>Promotional assets</li>");
    expect(html).toContain("<p>Submission does not guarantee publication.</p>");
    expect(html).toContain(">Included benefits</h3>");
    expect(html).not.toContain("##");
  });
  it("does not reinterpret ordinary prose, dashes or semicolons as invented lists", () => {
    const html = render("Yes—if the agreement allows it; otherwise confirm first.");
    expect(html).toContain("<p>Yes—if the agreement allows it; otherwise confirm first.</p>");
    expect(html).not.toContain("<ul>");
  });
  it("supports nested conditions, quotes and wide comparisons without dropping text", () => {
    const html = render("- Submission\n  - Publication is not guaranteed\n\n> Suggested wording\n\n| Option | Amount |\n| --- | --- |\n| Standard | $20,000 |\n| VIP | $30,000 |");
    expect(html.match(/<ul>/g)).toHaveLength(2);
    expect(html).toContain("<blockquote>");
    expect(html).toContain("overflow-x-auto");
    expect(html).toContain("<td>$30,000</td>");
    expect(html).toContain("Publication is not guaranteed");
  });
  it("allows safe source links without executing HTML or loading remote images", () => {
    const html = render('[Source](https://example.com/policy) [bad](javascript:alert%281%29) ![tracking](https://example.com/pixel)\n\n<script>alert(1)</script>');
    expect(html).toContain('href="https://example.com/policy"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
  });
});
