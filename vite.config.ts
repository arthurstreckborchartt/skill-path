// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";
import { loadEnv } from "vite";
import path from "node:path";

/**
 * O mcpPlugin quebra o build no Windows: ele normaliza o diretório pai para barras normais
 * ("C:/...") e depois compara com `child.startsWith(parent + path.sep)`, onde path.sep é "\".
 * A comparação nunca casa e ele aborta com "routesDir must resolve under".
 * Em macOS e Linux path.sep já é "/", então lá passa — e é por isso que o deploy não quebrou.
 *
 * Enquanto o @lovable.dev/mcp-js não corrigir, ele fica fora só no Windows. O endpoint MCP
 * continua funcionando no deploy. Para remover esta condição, teste `bun run build` no Windows.
 */
const isWindows = process.platform === "win32";

export default defineConfig(({ mode }) => {
  const serverEnv = loadEnv(mode, process.cwd(), "");
  Object.assign(process.env, serverEnv);

  return {
    plugins: isWindows ? [] : [mcpPlugin()],
    resolve: {
      alias: {
        "entities/lib/decode.js": path.resolve(
          process.cwd(),
          "node_modules/entities/lib/decode.js",
        ),
        "entities/lib/encode.js": path.resolve(
          process.cwd(),
          "node_modules/entities/lib/encode.js",
        ),
        entities: path.resolve(process.cwd(), "node_modules/entities"),
      },
    },
    tanstackStart: {
      // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
      // nitro/vite builds from this
      server: { entry: "server" },
    },
  };
});
