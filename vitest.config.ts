import { fileURLToPath } from "node:url";

const vitestConfig = {
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    fileParallelism: false,
    restoreMocks: true,
    // NextAuth uses extensionless Next.js imports that require bundler resolution.
    server: { deps: { inline: ["next-auth"] } },
  },
};

export default vitestConfig;
