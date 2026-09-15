import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/pathly/legal-page";
import { PRIVACY_POLICY } from "@/lib/legal";

export const Route = createFileRoute("/privacidade")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Política de Privacidade — Pathly" },
      {
        name: "description",
        content: "Como a Pathly trata os dados do seu questionário e da sua rota.",
      },
      { property: "og:title", content: "Política de Privacidade — Pathly" },
    ],
  }),
  component: () => <LegalPage document={PRIVACY_POLICY} />,
});
