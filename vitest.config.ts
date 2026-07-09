import { fileURLToPath } from "node:url";

const vitestConfig = {
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    fileParallelism: false,
    restoreMocks: true,
  },
};

export default vitestConfig;
