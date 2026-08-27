import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import fs from "node:fs";
import path from "node:path";

/**
 * Plugin Vite — injeta o manifesto de assets no Service Worker.
 *
 * Após o bundle ser gerado, lê os arquivos de saída para descobrir os nomes
 * reais dos assets com hash (ex: index-CQsEcmpS.js) e substitui dois tokens
 * no dist/sw.js:
 *
 *   __PRECACHE_ASSETS__   → Array JSON com as URLs a precachear
 *   __BUILD_TIMESTAMP__   → Timestamp Unix do build (versiona o cache)
 *
 * Dessa forma o Service Worker sempre referencia exatamente os arquivos gerados,
 * sem hardcode de nomes e sem dependência de Workbox.
 */
function injectServiceWorkerManifest(): Plugin {
  return {
    name: "inject-sw-manifest",
    // Roda somente em build de produção, após todos os arquivos serem emitidos
    apply: "build",
    closeBundle() {
      const outDir = path.resolve(__dirname, "dist");
      const swPath = path.join(outDir, "sw.js");

      if (!fs.existsSync(swPath)) {
        console.warn("[inject-sw-manifest] sw.js não encontrado em dist/");
        return;
      }

      // Coleta todos os arquivos gerados na pasta dist/ recursivamente
      const collectFiles = (dir: string, base: string): string[] => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        const urls: string[] = [];
        for (const entry of entries) {
          if (entry.name === "sw.js") continue; // O próprio SW não se auto-precacheia
          if (entry.isDirectory()) {
            urls.push(...collectFiles(path.join(dir, entry.name), `${base}/${entry.name}`));
          } else {
            urls.push(`${base}/${entry.name}`);
          }
        }
        return urls;
      };

      const assetUrls = collectFiles(outDir, "");
      // O index.html e todos os arquivos efetivamente emitidos pelo Vite
      // compõem o shell; isso também inclui .wasm, se o bundle o gerar.
      const precacheList = ["/index.html", ...assetUrls.filter((u) => u !== "/index.html")];

      const timestamp = Date.now().toString();
      let swContent = fs.readFileSync(swPath, "utf-8");

      swContent = swContent.replace(
        "__PRECACHE_ASSETS__",
        JSON.stringify(precacheList, null, 2)
      );
      swContent = swContent.replace(/__BUILD_TIMESTAMP__/g, timestamp);

      fs.writeFileSync(swPath, swContent, "utf-8");

      console.log(
        `[inject-sw-manifest] sw.js atualizado — ${precacheList.length} URLs — cache: synclab-shell-v${timestamp}`
      );
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), injectServiceWorkerManifest()],
});
