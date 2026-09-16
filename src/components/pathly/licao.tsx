import { useState } from "react";
import { AlertTriangle, BookOpen, Check, Lightbulb, ListOrdered, Target, X } from "lucide-react";
import { Btn, Chip, Panel } from "@/components/pathly/ui";
import { supabase } from "@/integrations/supabase/client";
import type { Correcao } from "@/lib/ia/avaliar-pratica";
import type { Licao, Pergunta } from "@/lib/ia/licao-contrato";
import { registrarResposta } from "@/lib/revisao";
import { cn } from "@/lib/utils";

/**
 * A aula de verdade.
 *
 * O que havia antes era template: "Ao final, você vai conseguir explicar e aplicar {tarefa} no
 * contexto de {etapa}" — preenchimento de lacuna, que não ensina ninguém. E o quiz usava como
 * alternativas os objetivos das outras etapas, com a resposta certa escrita no topo da própria
 * tela e igual para todas as tarefas da etapa.
 *
 * Aqui o conteúdo vem da IA e é sobre o assunto: explicação, exemplo concreto, passo a passo,
 * armadilhas e perguntas com distratores plausíveis.
 */

function PerguntaCard({
  pergunta,
  numero,
  onResposta,
}: {
  pergunta: Pergunta;
  numero: number;
  onResposta: (acertou: boolean) => void;
}) {
  const [escolhida, setEscolhida] = useState<number | null>(null);
  const respondida = escolhida !== null;

  return (
    <div className="rounded-2xl border border-border bg-surface/60 p-4">
      <p className="text-[11px] font-semibold tracking-[0.14em] text-primary uppercase">
        Pergunta {numero}
      </p>
      <p className="mt-2 text-sm font-medium">{pergunta.enunciado}</p>

      <div className="mt-3 space-y-2">
        {pergunta.alternativas.map((alt, i) => {
          const selecionada = escolhida === i;
          // Depois de responder, a correta aparece mesmo que não tenha sido a escolhida: errar e
          // não descobrir a resposta é o pior desfecho possível de um exercício.
          const revelar = respondida && (selecionada || alt.correta);
          return (
            <button
              key={alt.texto}
              disabled={respondida}
              onClick={() => {
                setEscolhida(i);
                onResposta(alt.correta);
              }}
              className={cn(
                "tap block w-full rounded-xl border px-4 py-3 text-left text-sm transition-colors",
                !respondida && "border-border hover:border-primary/40",
                respondida && !revelar && "border-border/50 opacity-50",
                revelar && alt.correta && "border-primary/50 bg-primary/10",
                revelar && !alt.correta && "border-destructive/50 bg-destructive/10",
              )}
            >
              <span className="flex items-start gap-2">
                {revelar && (
                  <span className="mt-0.5 shrink-0">
                    {alt.correta ? (
                      <Check className="size-4 text-primary" />
                    ) : (
                      <X className="size-4 text-destructive" />
                    )}
                  </span>
                )}
                <span>
                  <span className="block">{alt.texto}</span>
                  {revelar && (
                    <span className="mt-1.5 block text-xs text-muted-foreground">{alt.porque}</span>
                  )}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Secao({
  icone,
  titulo,
  children,
}: {
  icone: React.ReactNode;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.14em] text-primary uppercase">
        {icone}
        {titulo}
      </p>
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

/**
 * A prática escrita, com correção da IA.
 *
 * É aqui que o aprendizado acontece de verdade. Escolher alternativa testa reconhecimento — a
 * resposta está na tela. Escrever obriga a recuperar da memória, e é isso que fixa. A correção
 * existe porque recuperar errado sem ser corrigido fixa o erro junto.
 */
function Pratica({
  tarefa,
  pratica,
  onConcluir,
}: {
  tarefa: string;
  pratica: string;
  onConcluir?: (() => void) | undefined;
}) {
  const [resposta, setResposta] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [correcao, setCorrecao] = useState<Correcao | null>(null);
  const [falhou, setFalhou] = useState(false);

  async function enviar() {
    setEnviando(true);
    setFalhou(false);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setFalhou(true);
        return;
      }
      const r = await fetch("/api/pratica", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ tarefa, pratica, resposta }),
      });
      const corpo = (await r.json()) as { correcao?: Correcao };
      if (!r.ok || !corpo.correcao) {
        setFalhou(true);
        return;
      }
      setCorrecao(corpo.correcao);
    } catch {
      setFalhou(true);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Panel className="border-primary/30 bg-primary/[0.05]">
      <p className="text-[11px] font-semibold tracking-[0.14em] text-primary uppercase">
        Agora faça
      </p>
      <p className="mt-2 text-sm leading-relaxed">{pratica}</p>

      <label className="mt-4 block">
        <span className="text-xs text-muted-foreground">
          Conte o que você fez e o que obteve. Escrever com as próprias palavras é o que fixa —
          reler não.
        </span>
        <textarea
          value={resposta}
          onChange={(e) => {
            setResposta(e.target.value);
            setCorrecao(null);
          }}
          rows={5}
          placeholder="Fiz assim…"
          // text-base: abaixo de 16px o iOS dá zoom no campo ao focar.
          className="mt-2 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-base sm:text-sm"
        />
      </label>

      {correcao && (
        <div
          className={cn(
            "mt-3 rounded-xl border p-4",
            correcao.aprovado ? "border-primary/40 bg-primary/10" : "border-accent/40 bg-accent/10",
          )}
        >
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            {correcao.aprovado ? (
              <>
                <Check className="size-4 text-primary" /> Você demonstrou que fez
              </>
            ) : (
              <>
                <AlertTriangle className="size-4 text-accent" /> Ainda falta algo
              </>
            )}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">{correcao.acertou}</p>
          {correcao.faltou && (
            <p className="mt-2 text-sm text-muted-foreground">{correcao.faltou}</p>
          )}
          {correcao.proximoPasso && (
            <p className="mt-2 border-t border-border/60 pt-2 text-sm">
              <span className="font-medium">Próximo passo: </span>
              {correcao.proximoPasso}
            </p>
          )}
        </div>
      )}

      {falhou && (
        <p className="mt-3 text-sm text-muted-foreground">
          A correção não respondeu agora. Sua resposta continua aí — tente enviar de novo em alguns
          instantes.
        </p>
      )}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Btn
          size="lg"
          className="w-full"
          onClick={enviar}
          disabled={enviando || resposta.trim().length === 0}
        >
          {enviando ? "Corrigindo…" : correcao ? "Corrigir de novo" : "Enviar para correção"}
        </Btn>
        {/* Concluir fica disponível mesmo sem aprovação: a correção orienta, não é portaria.
            Travar a rota atrás de um avaliador automático puniria quem fez e escreveu mal. */}
        {onConcluir && (
          <Btn variant="ghost" size="lg" className="w-full" onClick={onConcluir}>
            <Check className="size-4" /> Concluí
          </Btn>
        )}
      </div>
    </Panel>
  );
}

export function LicaoConteudo({
  licao,
  tarefa,
  chave,
  onConcluir,
}: {
  licao: Licao;
  tarefa: string;
  /** Identifica a lição no banco. É por ela que a revisão sabe a que pergunta voltar. */
  chave?: string | undefined;
  onConcluir?: (() => void) | undefined;
}) {
  const [acertos, setAcertos] = useState(0);
  const [respondidas, setRespondidas] = useState(0);
  const [erradas, setErradas] = useState<number[]>([]);
  const todasRespondidas = respondidas >= licao.perguntas.length;

  return (
    <div className="space-y-7">
      <Secao icone={<BookOpen className="size-3" />} titulo="Entenda">
        <div className="space-y-3">
          {licao.explicacao.map((p) => (
            <p key={p.slice(0, 40)} className="text-sm leading-relaxed text-muted-foreground">
              {p}
            </p>
          ))}
        </div>
      </Secao>

      {licao.exemplo && (
        <Secao icone={<Lightbulb className="size-3" />} titulo="Na prática">
          <p className="rounded-2xl border border-border bg-surface-2/40 p-4 text-sm leading-relaxed">
            {licao.exemplo}
          </p>
        </Secao>
      )}

      {licao.passos.length > 0 && (
        <Secao icone={<ListOrdered className="size-3" />} titulo="Como fazer">
          <ol className="space-y-2">
            {licao.passos.map((passo, i) => (
              <li key={passo.slice(0, 40)} className="flex gap-3 text-sm">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                  {i + 1}
                </span>
                <span className="text-muted-foreground">{passo}</span>
              </li>
            ))}
          </ol>
        </Secao>
      )}

      {licao.armadilhas.length > 0 && (
        <Secao icone={<AlertTriangle className="size-3" />} titulo="Onde as pessoas erram">
          <ul className="space-y-2">
            {licao.armadilhas.map((a) => (
              <li key={a.slice(0, 40)} className="flex gap-2 text-sm text-muted-foreground">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-accent" />
                {a}
              </li>
            ))}
          </ul>
        </Secao>
      )}

      {licao.perguntas.length > 0 && (
        <Secao icone={<Target className="size-3" />} titulo="Teste o que entendeu">
          <div className="space-y-3">
            {licao.perguntas.map((p, i) => (
              <PerguntaCard
                key={p.enunciado}
                pergunta={p}
                numero={i + 1}
                onResposta={(acertou) => {
                  setRespondidas((n) => n + 1);
                  if (acertou) setAcertos((n) => n + 1);
                  else setErradas((lista) => [...lista, i]);
                  // Agenda a volta desta pergunta específica. Sem await: a tela não espera o
                  // banco para revelar a resposta, e a função nunca lança.
                  if (chave) {
                    void registrarResposta({
                      chaveLicao: chave,
                      indicePergunta: i,
                      tarefa,
                      acertou,
                    });
                  }
                }}
              />
            ))}
          </div>
          {todasRespondidas && (
            <div className="mt-3 rounded-2xl border border-border bg-surface-2/40 p-4 text-sm">
              <p className="font-medium">
                {acertos}/{licao.perguntas.length} certas.
              </p>
              {/* Errar e não voltar ao ponto exato é o pior desfecho de um exercício: a pessoa
                  sai achando que entendeu. Por isso o retorno aponta a pergunta, não a lição. */}
              {erradas.length > 0 && (
                <p className="mt-1.5 text-muted-foreground">
                  Vale reler a explicação antes de aplicar — principalmente a parte que responde{" "}
                  {erradas.length === 1 ? "a pergunta" : "as perguntas"}{" "}
                  {erradas.map((i) => i + 1).join(" e ")}.
                </p>
              )}
            </div>
          )}
        </Secao>
      )}

      {licao.pratica && <Pratica tarefa={tarefa} pratica={licao.pratica} onConcluir={onConcluir} />}
    </div>
  );
}

export function LicaoCarregando() {
  return (
    <div className="space-y-4">
      <Chip tone="muted">Preparando a aula…</Chip>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-4 animate-pulse rounded-full bg-surface-2"
          style={{ width: `${100 - i * 12}%` }}
        />
      ))}
      <p className="text-xs text-muted-foreground">
        Escrevendo o conteúdo desta tarefa. Leva alguns segundos na primeira vez — depois fica
        guardado.
      </p>
    </div>
  );
}

export function LicaoIndisponivel({ motivo }: { motivo: string }) {
  return (
    <Panel>
      <p className="text-sm font-medium">A aula não carregou agora.</p>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {motivo === "sem-chave"
          ? "A geração de conteúdo ainda não está configurada."
          : "Pode ser congestionamento do serviço. Tente abrir de novo em alguns instantes — o resto da etapa continua disponível."}
      </p>
    </Panel>
  );
}
