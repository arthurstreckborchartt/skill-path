/**
 * Estrutura versionada dos documentos legais — conteúdo como dado, não JSX solto, para que o
 * índice e o versionamento saiam da mesma fonte.
 */

export type LegalDocumentType = "terms" | "privacy";

export type LegalBlock =
  | { kind: "p"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "callout"; text: string };

export type LegalSection = {
  id: string;
  title: string;
  blocks: LegalBlock[];
};

export type LegalDocument = {
  type: LegalDocumentType;
  version: string;
  effectiveDate: string;
  title: string;
  summary: string;
  sections: LegalSection[];
};

export const LEGAL_DOCUMENT_LABEL: Record<LegalDocumentType, string> = {
  terms: "Termos de Uso",
  privacy: "Política de Privacidade",
};

export const LEGAL_ROUTE: Record<LegalDocumentType, string> = {
  terms: "/termos",
  privacy: "/privacidade",
};

export function formatEffectiveDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
