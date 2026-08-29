import { PRIVACY_POLICY } from "./privacy";
import { TERMS_OF_USE } from "./terms";
import type { LegalDocument, LegalDocumentType } from "./types";

export { LEGAL_DOCUMENT_LABEL, LEGAL_ROUTE, formatEffectiveDate } from "./types";
export type { LegalBlock, LegalDocument, LegalDocumentType, LegalSection } from "./types";
export { PRIVACY_POLICY, TERMS_OF_USE };

export const LEGAL_DOCUMENTS: Record<LegalDocumentType, LegalDocument> = {
  terms: TERMS_OF_USE,
  privacy: PRIVACY_POLICY,
};
