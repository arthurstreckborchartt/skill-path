import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Logo, Panel } from "@/components/pathly/ui";
import {
  formatEffectiveDate,
  LEGAL_DOCUMENT_LABEL,
  LEGAL_ROUTE,
  type LegalBlock,
  type LegalDocument,
  type LegalDocumentType,
} from "@/lib/legal";

const ALL_DOCUMENT_TYPES: LegalDocumentType[] = ["terms", "privacy"];

/** Destaca [PLACEHOLDERS] que ainda precisam ser preenchidos. */
function withPlaceholders(text: string) {
  const parts = text.split(/(\[[^\]]+\])/g);
  return parts.map((part, i) =>
    part.startsWith("[") && part.endsWith("]") ? (
      <mark key={i} className="rounded bg-xp/20 px-1 py-0.5 text-xp">
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

function Block({ block }: { block: LegalBlock }) {
  if (block.kind === "p") {
    return <p className="mt-4 text-[15px] leading-relaxed">{withPlaceholders(block.text)}</p>;
  }
  if (block.kind === "list") {
    return (
      <ul className="mt-4 space-y-2 pl-5 text-[15px] leading-relaxed">
        {block.items.map((item, i) => (
          <li key={i} className="list-disc marker:text-muted-foreground">
            {withPlaceholders(item)}
          </li>
        ))}
      </ul>
    );
  }
  return (
    <p className="mt-5 rounded-2xl border border-primary/25 bg-primary/[0.06] px-4 py-3 text-[15px] leading-relaxed">
      {withPlaceholders(block.text)}
    </p>
  );
}

export function LegalPage({ document: doc }: { document: LegalDocument }) {
  const others = ALL_DOCUMENT_TYPES.filter((t) => t !== doc.type);
  const isDraft = doc.version.includes("minuta");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-5 py-6 sm:px-8">
        <div className="mx-auto max-w-3xl">
          <Link
            to="/"
            className="tap inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Voltar
          </Link>
          <div className="mt-4">
            <Logo />
          </div>
          <h1 className="mt-6 font-display text-3xl font-semibold">{doc.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Versão {doc.version} · Em vigor desde {formatEffectiveDate(doc.effectiveDate)}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 pt-8 pb-16 sm:px-8">
        {isDraft && (
          <Panel className="border-xp/40 bg-xp/[0.06]">
            <p className="text-sm text-xp">
              <span className="font-medium">Minuta pendente de revisão jurídica.</span> Este texto
              foi preparado a partir do funcionamento real do produto, mas ainda precisa ser
              revisado por advogado e ter os campos destacados preenchidos antes do lançamento.
            </p>
          </Panel>
        )}

        <p className="mt-6 text-[15px] leading-relaxed text-muted-foreground">{doc.summary}</p>

        <nav aria-label="Índice" className="mt-8 rounded-2xl border border-border p-5">
          <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">Índice</p>
          <ol className="mt-3 space-y-1.5">
            {doc.sections.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="text-sm text-muted-foreground transition-colors hover:text-primary"
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-10">
          {doc.sections.map((section) => (
            <section key={section.id} id={section.id} className="mt-10 scroll-mt-6 first:mt-0">
              <h2 className="font-display text-lg font-semibold">{section.title}</h2>
              {section.blocks.map((block, i) => (
                <Block key={i} block={block} />
              ))}
            </section>
          ))}
        </div>

        <footer className="mt-14 border-t border-border pt-6">
          <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
            Leia também
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {others.map((type) => (
              <Link
                key={type}
                to={LEGAL_ROUTE[type]}
                className="tap inline-flex min-h-11 items-center text-sm text-primary transition-opacity hover:opacity-80"
              >
                {LEGAL_DOCUMENT_LABEL[type]}
              </Link>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Pathly · {LEGAL_DOCUMENT_LABEL[doc.type]} versão {doc.version}
          </p>
        </footer>
      </main>
    </div>
  );
}
