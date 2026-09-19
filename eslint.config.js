import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // `.agents` sao skills de plugins instalados localmente: nao sao do projeto e nao
  // estao no git. `*.gen.ts` e gerado.
  //
  // Os dois de `integrations/supabase` tambem se declaram gerados, e quem os gera nao
  // roda prettier nem eslint. Ja estavam no `.prettierignore` pela mesma razao:
  // corrigir a mao so adianta um diff que a proxima geracao desfaz.
  {
    ignores: [
      "dist",
      ".output",
      ".vinxi",
      ".agents",
      "**/*.gen.ts",
      "src/integrations/supabase/types.ts",
      "src/integrations/supabase/previewAuthStorage.ts",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  /**
   * `react-refresh/only-export-components` existe para o Fast Refresh funcionar: um arquivo que
   * exporta componente E outra coisa perde o hot reload. É um bom aviso — mas nos três grupos
   * abaixo o padrão é deliberado, e "consertar" significaria espalhar o código em mais arquivos
   * para ganhar HMR onde ele não faz diferença.
   */
  {
    // shadcn/ui: `buttonVariants`, `useSidebar`, `useFormField` e companhia vêm assim do upstream.
    // Separá-los faria todo `shadcn add` futuro conflitar com a nossa versão.
    files: ["src/components/ui/**"],
    rules: { "react-refresh/only-export-components": "off" },
  },
  {
    // Templates de e-mail são renderizados no servidor para HTML. Nunca passam por Fast Refresh,
    // então o aviso não descreve nenhum custo real aqui.
    files: ["src/lib/email-templates/**"],
    rules: { "react-refresh/only-export-components": "off" },
  },
  {
    // Contexto, Provider e hook no mesmo arquivo é o padrão do React. Quebrar em três arquivos
    // piora a leitura de algo que se entende junto.
    files: ["src/lib/*-context.tsx"],
    rules: { "react-refresh/only-export-components": "off" },
  },
  eslintPluginPrettier,
);
