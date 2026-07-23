import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  async headers() {
    const isolatedLabHeaders = [
      { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "no-referrer" },
    ];
    return [
      { source: "/ask-sales-faq/v4-lab", headers: isolatedLabHeaders },
      { source: "/api/ask-sales-faq/v4-isolated", headers: isolatedLabHeaders },
      { source: "/ask-sales-faq/v4-systemic-lab", headers: isolatedLabHeaders },
      { source: "/api/ask-sales-faq/v4-systemic-isolated", headers: isolatedLabHeaders },
      { source: "/ask-sales-faq/v5-lab", headers: isolatedLabHeaders },
      { source: "/api/ask-sales-faq/v5-isolated", headers: isolatedLabHeaders },
    ];
  },
};

export default nextConfig;
