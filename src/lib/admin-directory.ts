export const ADMIN_DIRECTORY_LINKS = [
  { name: "Sales Script Adherence · Pilot", href: "/manager/script-adherence", group: "sales", navLabel: "Script Adherence", scope: "manager" },
  { name: "AI Coaching Rep Usage", href: "/manager/usage", group: "coaching", navLabel: "Rep Usage", scope: "manager" },
  { name: "AI Coaching Sales Impact", href: "/manager/sales-correlation", group: "coaching", navLabel: "Sales Impact", scope: "manager" },
  { name: "AI Coaching Objection Library", href: "/manager/coaching-insights", group: "coaching", navLabel: "Objection Library", scope: "manager" },
  { name: "AI Coaching Report Review", href: "/manager/coaching-review", group: "coaching", navLabel: "Report Review", scope: "manager" },
  { name: "Sales FAQ Chatbot Usage", href: "/ask-sales-faq/admin/usage", group: "faq", navLabel: "Usage", scope: "faq" },
  { name: "Sales FAQ Chatbot Conversations", href: "/ask-sales-faq/admin", group: "faq", navLabel: "Conversations", scope: "faq" },
  { name: "Mock Call Agent Team Admin", href: "https://mockcallagent.insidesuccess.ai/admin/team", group: "external", navLabel: "Mock Calls", scope: "manager" },
  { name: "Sales Call Rep No-Shows", href: "/manager/rep-no-show", group: "sales", navLabel: "Rep No-Shows", scope: "manager" },
  { name: "Sales Compliance Review", href: "/manager/compliance", group: "sales", navLabel: "Compliance Review", scope: "manager" },
  { name: "AI Coaching Closer Scorecard", href: "/manager/rep-scoring", group: "coaching", navLabel: "Closer Scorecard", scope: "manager" },
] as const;

export type AdminNavigationLink = (typeof ADMIN_DIRECTORY_LINKS)[number];
export const ADMIN_NAV_GROUPS = [
  { id: "coaching", label: "Coaching" },
  { id: "sales", label: "Sales Operations" },
  { id: "faq", label: "FAQ" },
] as const;

export function activeAdminLink(pathname: string, links: readonly AdminNavigationLink[]) {
  return links.filter(link => !link.href.startsWith("https:") &&
    (pathname === link.href || pathname.startsWith(link.href + "/")))
    .sort((a, b) => b.href.length - a.href.length)[0];
}
