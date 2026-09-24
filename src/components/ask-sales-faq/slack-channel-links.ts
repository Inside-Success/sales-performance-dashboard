import type { Root, RootContent, Text } from "mdast";

// Verified source channel names. Unknown/inaccessible channels still get a safe,
// useful link without inventing a name or changing the underlying saved answer.
const channels: Record<string, string> = {
  C0C2USV181G: "hubspot-passoff",
  C0AUQKNR8CF: "sales-questions-requests",
  C08QGKL39J6: "sales-tech-requests",
  C0A8S3JSR1Q: "new-sales-closer-onboarding",
};

export function remarkSlackChannelLinks() {
  return (tree: Root) => {
    function visit(node: Root | RootContent) {
      if (node.type === "link" || node.type === "linkReference" || !("children" in node)) return;
      const children: RootContent[] = [];
      for (const child of node.children) {
        if (child.type !== "text") { visit(child); children.push(child); continue; }
        let offset = 0;
        for (const match of child.value.matchAll(/<#([CG][A-Z0-9]{8,})(?:\|([a-zA-Z0-9_-]+))?>/g)) {
          const index = match.index!;
          if (index > offset) children.push({ type: "text", value: child.value.slice(offset, index) });
          const name = channels[match[1]] || match[2];
          children.push({ type: "link", url: `https://istvoffical.slack.com/archives/${match[1]}`, children: [{ type: "text", value: name ? `#${name}` : "Open Slack channel" } as Text] });
          offset = index + match[0].length;
        }
        children.push({ type: "text", value: child.value.slice(offset) });
      }
      // Replacements preserve each parent's existing content category: a text
      // node becomes inline text/link nodes only, never a new block or HTML.
      node.children = children as typeof node.children;
    }
    visit(tree);
  };
}
