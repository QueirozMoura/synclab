import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "");
  // Set process.env for module loading phase (before test collection)
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) {
      process.env[key] = value;
    }
  }
  return {
    test: {
      include: ["tests/**/*.test.ts"],
      fileParallelism: false,
      env,
      setupFiles: ["./tests/setup.ts"],
      globalSetup: "./tests/global-setup.ts",
    },
    resolve: {
      alias: {
        "@domain": path.resolve(__dirname, "src/domain"),
        "@application": path.resolve(__dirname, "src/application"),
        "@infrastructure": path.resolve(__dirname, "src/infrastructure"),
        "@transport": path.resolve(__dirname, "src/transport"),
      },
    },
  };
});
