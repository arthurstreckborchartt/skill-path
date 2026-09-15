import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/pathly/legal-page";
import { TERMS_OF_USE } from "@/lib/legal";

export const Route = createFileRoute("/termos")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Termos de Uso — Pathly" },
      {
        name: "description",
        content: "As regras de uso da Pathly: o que ela é, o que não garante e seus direitos.",
      },
      { property: "og:title", content: "Termos de Uso — Pathly" },
    ],
  }),
  component: () => <LegalPage document={TERMS_OF_USE} />,
});
