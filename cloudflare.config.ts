import { bindings, defineConfig, exports } from "cf/config";
import * as entrypoint from "./src/server/index.ts" with { type: "cf-worker" };

// Cloudflare CLI (cf), configuração em TypeScript.
// Uma Durable Object por sala e imagens armazenadas no SQLite de cada sala (beta).
export default defineConfig({
  worker: {
    name: "arcane-table",
    entrypoint,
    compatibilityDate: "2026-11-13",
    assets: {
      notFoundHandling: "single-page-application",
      runWorkerFirst: ["/api/*"],
    },
    exports: {
      GameRoom: exports.durableObject({ storage: "sqlite" }),
    },
    env: {
      ROOMS: bindings.durableObject({ worker: "arcane-table", exportName: "GameRoom" }),
    },
    observability: {
      enabled: true,
      traces: { enabled: true },
    },
  },
});
