import { useState } from "react";
import { AlertTriangle, Check, GitCommit, Lock, ShieldAlert, Upload, X } from "lucide-react";
import { Btn, Panel } from "@/components/pathly/ui";
import { cn } from "@/lib/utils";
import { DEFINICOES, type Capacidade } from "@/lib/hub/capacidades";
import { DEFINICOES_NIVEL, ehIsolado, type Nivel } from "@/lib/hub/niveis";
import {
  escoposDisponiveis,
  ESCOPO_PADRAO,
  fraseDeConfirmacao,
  ROTULO_ESCOPO,
  VALIDADE_APROVACAO_MIN,
  type Escopo,
} from "@/lib/hub/aprovacao";

/**
 * A tela de confirmação de uma ação externa.
 *
 * ## Por que o texto nunca é genérico
 *
 * "Permitir acesso" não diz o que vai acontecer. Quem lê isso trinta vezes aprende a clicar sem
 * ler — e aí o portão vira um obstáculo cosmético, que é pior que não ter portão, porque produz
 * a sensação de ter um.
 *
 * Então cada confirmação diz **quem**, **o quê** e **onde**: "Permitir que o Codex modifique
 * arquivos deste projeto?". A frase sai de `fraseDeConfirmacao`, em código, e não de um `label`
 * que cada chamada escreve do seu jeito.
 *
 * ## O que a tela é obrigada a mostrar
 *
 * - `oQueAcontece` do nível — a consequência no mundo, não o nome da permissão.
 * - `naoPermite` da capacidade, quando existe. O limite informa tanto quanto o alcance.
 * - O aviso de cobertura, quando uma permissão mais ampla está sendo usada para uma ação menor.
 *   Essa é a regra que o produto não pode quebrar em silêncio.
 * - O escopo, com "só desta vez" como padrão.
 */

export type DadosDaConfirmacao = {
  provedorNome: string;
  capacidade: Capacidade;
  /** O arquivo, comando ou destino. Aparece literal, para a pessoa conferir caractere a caractere. */
  alvo?: string;
  /** Por que a ferramenta quer fazer isso. Vem da própria ação. */
  motivo?: string;
  /** Preenchido quando uma permissão mais ampla está cobrindo. Não pode ser omitido. */
  avisoDeCobertura?: string | null;
  /** Para a variante de commit: os arquivos e a mensagem. */
  commit?: { arquivos: string[]; mensagem: string };
};

const ICONE_POR_NIVEL: Partial<Record<Nivel, typeof Check>> = {
  COMMIT: GitCommit,
  PUSH: Upload,
  DELETE: ShieldAlert,
  DEPLOY: Upload,
  EXECUTE: AlertTriangle,
};

export function ConfirmarAcao({
  dados,
  aoCancelar,
  aoAutorizar,
  ocupado = false,
  /** Quando o nível exige identidade fresca, a tela pede — e o botão muda de nome. */
  precisaReautenticar = false,
}: {
  dados: DadosDaConfirmacao;
  aoCancelar: () => void;
  aoAutorizar: (escopo: Escopo) => void;
  ocupado?: boolean;
  precisaReautenticar?: boolean;
}) {
  const def = DEFINICOES[dados.capacidade];
  const nivel = def.nivel;
  const nivelDef = DEFINICOES_NIVEL[nivel];
  const Icone = ICONE_POR_NIVEL[nivel] ?? Lock;

  const escopos = escoposDisponiveis(nivel);
  const [escopo, setEscopo] = useState<Escopo>(ESCOPO_PADRAO);

  /*
   * Invertido nos níveis isolados — commit, push, deploy, apagar. Num monocromático, inverter é o
   * que o olho encontra primeiro, e são exatamente os quatro que não se desfazem do lado de cá.
   */
  const pesado = ehIsolado(nivel);

  return (
    <Panel invertido={pesado} {...(pesado ? {} : { className: "border-foreground/25" })}>
      <div className="flex items-start gap-3">
        <Icone className="mt-0.5 size-5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-xs font-semibold uppercase",
              pesado ? "text-background/70" : "text-muted-foreground",
            )}
          >
            {dados.commit ? "Confirmar commit" : "Confirmar ação"}
          </p>

          <h2 className="mt-2 max-w-2xl font-display text-lg font-semibold sm:text-xl">
            {fraseDeConfirmacao({
              provedorNome: dados.provedorNome,
              capacidade: dados.capacidade,
              ...(dados.alvo ? { alvo: dados.alvo } : {}),
            })}
          </h2>

          {/* ---- Commit: os arquivos e a mensagem, que é o que a pessoa confere ---- */}
          {dados.commit && (
            <div
              className={cn(
                "mt-4 rounded-md border p-3",
                pesado ? "border-background/25" : "border-border bg-surface-2",
              )}
            >
              <p className="text-sm font-medium">
                {dados.commit.arquivos.length}{" "}
                {dados.commit.arquivos.length === 1
                  ? "arquivo será incluído"
                  : "arquivos serão incluídos"}
              </p>
              <ul className="mt-2 space-y-0.5">
                {dados.commit.arquivos.slice(0, 7).map((a) => (
                  <li key={a} className="font-mono text-xs break-all">
                    {a}
                  </li>
                ))}
                {dados.commit.arquivos.length > 7 && (
                  <li
                    className={cn(
                      "text-xs",
                      pesado ? "text-background/65" : "text-muted-foreground",
                    )}
                  >
                    e mais {dados.commit.arquivos.length - 7}
                  </li>
                )}
              </ul>
              <p
                className={cn(
                  "mt-3 text-xs font-semibold uppercase",
                  pesado ? "text-background/70" : "text-muted-foreground",
                )}
              >
                Mensagem
              </p>
              <p className="mt-1 font-mono text-xs break-all">{dados.commit.mensagem}</p>
            </div>
          )}

          {/* ---- O alvo, literal ---- */}
          {dados.alvo && !dados.commit && (
            <p className="mt-3 font-mono text-xs break-all">{dados.alvo}</p>
          )}

          {dados.motivo && (
            <p className="mt-3 text-sm leading-relaxed">
              <span className={pesado ? "text-background/70" : "text-muted-foreground"}>
                Motivo:{" "}
              </span>
              {dados.motivo}
            </p>
          )}

          {/* ---- A consequência, que é o que importa ---- */}
          <p
            className={cn(
              "mt-4 text-sm leading-relaxed",
              pesado ? "text-background/80" : "text-foreground/80",
            )}
          >
            {nivelDef.oQueAcontece}
          </p>

          {def.naoPermite && (
            <p
              className={cn(
                "mt-2 text-xs leading-relaxed",
                pesado ? "text-background/65" : "text-muted-foreground",
              )}
            >
              <span className="font-medium">Não permite:</span> {def.naoPermite}
            </p>
          )}

          {/* ---- Cobertura por permissão mais ampla: nunca silenciosa ---- */}
          {dados.avisoDeCobertura && (
            <p
              role="note"
              className={cn(
                "mt-3 rounded-md border p-2.5 text-xs leading-relaxed",
                pesado ? "border-background/25" : "border-foreground/25 bg-surface-2",
              )}
            >
              {dados.avisoDeCobertura}
            </p>
          )}

          <p
            className={cn("mt-3 text-xs", pesado ? "text-background/65" : "text-muted-foreground")}
          >
            Permissão: <span className="font-mono">{nivel}</span> · a aprovação vale{" "}
            {VALIDADE_APROVACAO_MIN} minutos
          </p>

          {/* ---- Escopo ---- */}
          <fieldset className="mt-4">
            <legend
              className={cn(
                "text-xs font-semibold uppercase",
                pesado ? "text-background/70" : "text-muted-foreground",
              )}
            >
              Por quanto tempo
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {escopos.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEscopo(e)}
                  aria-pressed={escopo === e}
                  className={cn(
                    "tap rounded-md border px-3 py-1.5 text-xs transition-colors",
                    escopo === e
                      ? pesado
                        ? "border-background bg-background text-foreground"
                        : "border-foreground bg-foreground text-background"
                      : pesado
                        ? "border-background/30 text-background/80 hover:border-background/60"
                        : "border-border text-muted-foreground hover:border-foreground/30",
                  )}
                >
                  {ROTULO_ESCOPO[e]}
                </button>
              ))}
            </div>
            {nivelDef.proibePersistente && (
              <p
                className={cn(
                  "mt-2 text-xs leading-relaxed",
                  pesado ? "text-background/65" : "text-muted-foreground",
                )}
              >
                {nivelDef.rotulo} não pode virar permissão permanente. Cada vez pede a sua
                confirmação, sempre.
              </p>
            )}
          </fieldset>

          {precisaReautenticar && (
            <p
              role="alert"
              className={cn(
                "mt-4 rounded-md border p-2.5 text-xs leading-relaxed",
                pesado ? "border-background/30" : "border-foreground/25 bg-surface-2",
              )}
            >
              Para isto você precisa confirmar sua identidade agora. Uma autorização anterior não
              vale — nem a de cinco minutos atrás.
            </p>
          )}

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row">
            <Btn
              variant={pesado ? "ghost" : "outline"}
              size="sm"
              onClick={aoCancelar}
              disabled={ocupado}
            >
              <X className="size-4" /> Cancelar
            </Btn>
            <Btn
              variant={pesado ? "soft" : "primary"}
              size="sm"
              onClick={() => aoAutorizar(escopo)}
              disabled={ocupado}
            >
              <Check className="size-4" />
              {precisaReautenticar
                ? "Autenticar e continuar"
                : dados.commit
                  ? "Autenticar e commitar"
                  : "Autorizar"}
            </Btn>
          </div>
        </div>
      </div>
    </Panel>
  );
}
