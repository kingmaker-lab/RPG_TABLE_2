import { bindings, defineConfig, exports } from "cf/config";
import * as entrypoint from "./src/server/index.ts" with { type: "cf-worker" };

// Cloudflare CLI (cf), configuração em TypeScript.
// Uma Durable Object por sala e bucket privado para mapas/retratos.
export default defineConfig({
  worker: {
    name: "arcane-table",
    entrypoint,
    compatibilityDate: "2026-11-10",
    assets: {
      notFoundHandling: "single-page-application",
      runWorkerFirst: ["/api/*"],
    },
    exports: {
      GameRoom: exports.durableObject({ storage: "sqlite" }),
    },
    env: {
      ROOMS: bindings.durableObject({ worker: "arcane-table", exportName: "GameRoom" }),
      MEDIA: bindings.r2({ name: "arcane-table-media" }),
    },
    observability: {
      enabled: true,
      traces: { enabled: true },
    },
  },
});
