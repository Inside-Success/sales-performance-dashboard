import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import type { Root, RootContent } from "mdast";

// Match the answer renderer's Markdown dialect. Formatting is not part of a
// destination; URL paths, query strings and fragments must remain intact.
const markdown = unified().use(remarkParse).use(remarkGfm);

export function evidenceUrls(text: string): string[] {
  const urls = new Set<string>();
  function visit(node: Root | RootContent) {
    if ("url" in node && /^https?:\/\//i.test(node.url)) urls.add(node.url);
    if (node.type === "text" || node.type === "inlineCode" || node.type === "code") {
      // Code is not autolinked by Markdown, but displayed resource URLs still
      // require evidence. Do not strip characters that can belong to a URL.
      for (const match of node.value.matchAll(/https?:\/\/[^\s<>]+/gi)) urls.add(match[0]);
    }
    // A link's label is not its destination. Validate the actual destination,
    // including reference definitions, rather than rescanning an autolink label.
    if (node.type !== "link" && "children" in node) node.children.forEach(visit);
  }
  visit(markdown.parse(text));
  return [...urls];
}
