import { loadEnv } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = loadEnv("test", __dirname, "");

for (const [key, value] of Object.entries(env)) {
  if (value !== undefined) {
    process.env[key] = value;
  }
}