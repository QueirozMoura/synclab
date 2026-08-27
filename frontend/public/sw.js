/**
 * SyncLab Service Worker — App Shell Offline (Etapa 1)
 *
 * Responsabilidades:
 * - Precachear o App Shell (index.html + assets com hash) no install
 * - Servir o App Shell do cache quando offline
 * - Nunca interceptar /auth/*, /sync ou requisições POST (API pass-through)
 * - Limpar caches de versões anteriores no activate
 *
 * Os marcadores de manifesto e versão são substituídos em tempo de build pelo
 * plugin `injectServiceWorkerManifest` no vite.config.ts.
 */

/** @type {string[]} Lista de URLs do App Shell injetada em build-time */
const PRECACHE_ASSETS = __PRECACHE_ASSETS__;
const PRECACHE_SET = new Set(PRECACHE_ASSETS);

/**
 * Nome do cache versionado por build.
 * Cada novo build gera um timestamp diferente, garantindo que o activate
 * delete caches de versões anteriores sem conflito.
 */
const CACHE_NAME = "synclab-shell-v__BUILD_TIMESTAMP__";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Retorna true se a URL deve ser completamente ignorada pelo SW.
 * Essas requisições passam direto para a rede sem qualquer intervenção.
 */
function shouldBypass(request) {
  const url = new URL(request.url);

  // Ignora métodos não-GET (POST, PUT, DELETE, etc.) — sync, auth, etc.
  if (request.method !== "GET") return true;

  // Ignora origens externas (ex: Render, CDNs de terceiros)
  if (url.origin !== self.location.origin) return true;

  // Ignora endpoints de API — autenticação e sincronização
  if (url.pathname === "/auth" || url.pathname.startsWith("/auth/")) return true;
  if (url.pathname === "/sync" || url.pathname.startsWith("/sync/")) return true;

  // Ignora extensões de API comuns que nunca são assets estáticos
  if (url.pathname.startsWith("/api/")) return true;

  return false;
}

/**
 * Retorna true se o asset usa hash no nome (assets Vite com conteúdo imutável).
 * Ex: /assets/index-CQsEcmpS.js, /assets/index-BZ77s446.css
 */
function isShellAsset(url) {
  return PRECACHE_SET.has(url.pathname);
}

// ---------------------------------------------------------------------------
// Install — precacheia o App Shell
// ---------------------------------------------------------------------------

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => {
        // Não chama self.skipWaiting() aqui.
        // O novo SW aguarda o ciclo normal: o usuário fecha todas as abas
        // e reabre, ou a próxima navegação após todas as abas antigas fecharem.
        // Isso evita que assets do novo bundle sejam misturados com código do
        // bundle antigo em tabs abertas.
        console.log("[SW] Instalado — cache:", CACHE_NAME);
      })
  );
});

// ---------------------------------------------------------------------------
// Activate — remove caches de versões anteriores
// ---------------------------------------------------------------------------

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter(
              (name) =>
                // Deleta qualquer cache do synclab que não seja o atual
                name.startsWith("synclab-") && name !== CACHE_NAME
            )
            .map((name) => {
              console.log("[SW] Deletando cache antigo:", name);
              return caches.delete(name);
            })
        )
      )
      .then(() => {
        // Não usa clients.claim(): o controle segue o ciclo padrão e evita
        // misturar um bundle novo com uma aba que ainda está em execução.
        console.log("[SW] Ativado —", CACHE_NAME);
      })
  );
});

// ---------------------------------------------------------------------------
// Fetch — estratégia de cache
// ---------------------------------------------------------------------------

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Bypass total: API, auth, cross-origin, não-GET
  if (shouldBypass(request)) return;

  const url = new URL(request.url);

  // Estratégia 1 — Navegação SPA (HTML)
  // Network-first: tenta buscar da rede para ter sempre conteúdo atualizado.
  // Se offline, serve index.html do cache para que o React inicialize e gerencie
  // as rotas internamente (não exibe tela branca).
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Atualiza index.html no cache a cada navegação bem-sucedida online
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          // Offline: serve o index.html em cache para qualquer rota da SPA
          return caches.match("/index.html").then(
            (cached) =>
              cached ||
              new Response("App offline — sem cache disponível", {
                status: 503,
                headers: { "Content-Type": "text/plain" },
              })
          );
        })
    );
    return;
  }

  // Estratégia 2 — Recursos do App Shell descobertos no build
  // Cache-first: a lista contém os nomes reais gerados pelo Vite, incluindo
  // JS, CSS, SVGs, fontes e qualquer .wasm necessário para inicialização.
  if (isShellAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Recursos que não fazem parte do App Shell não são armazenados.
  // Isso evita transformar o SW em cache genérico de respostas privadas.
  event.respondWith(fetch(request));
});
