import { Chip } from "./ui";
import { cn } from "@/lib/utils";
import {
  ROTULO_NIVEL,
  ROTULO_TIPO,
  TETOS_RESPOSTA,
  TIPOS_PROJETO,
  type ModoDeConstruir,
  type NivelTecnico,
  type Respostas,
} from "@/lib/blueprint/respostas";

/**
 * O questionário do Project Planner.
 *
 * Componente controlado, sem estado próprio, porque serve a dois lugares: criar um projeto novo e
 * editar as respostas de um que já existe. Guardar o estado aqui obrigaria cada tela a sincronizar
 * o que ela já tem.
 *
 * ## Por que tudo numa página só
 *
 * São quinze perguntas, mas onze delas são um toque. Quebrar isso em passos transformaria dois
 * minutos de digitação em dois minutos de navegação — e este app existe justamente para a pessoa
 * chegar logo à parte que vale, que é o plano.
 *
 * As perguntas de sim/não vêm depois das abertas de propósito: responder "terá pagamentos?" é
 * mais fácil depois de ter escrito com as próprias palavras o que o produto é.
 */

function Campo({
  rotulo,
  ajuda,
  children,
}: {
  rotulo: string;
  ajuda?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-5 first:mt-0">
      <label className="block text-sm font-medium">{rotulo}</label>
      {ajuda && <p className="mt-1 text-xs text-muted-foreground">{ajuda}</p>}
      <div className="mt-2">{children}</div>
    </div>
  );
}

const ENTRADA =
  "w-full rounded-lg border border-input bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring";

function Texto({
  valor,
  aoMudar,
  teto,
  linhas = 2,
  exemplo,
}: {
  valor: string;
  aoMudar: (v: string) => void;
  teto: number;
  linhas?: number;
  exemplo: string;
}) {
  return (
    <textarea
      value={valor}
      onChange={(e) => aoMudar(e.target.value.slice(0, teto))}
      rows={linhas}
      placeholder={exemplo}
      className={cn(ENTRADA, "resize-none")}
    />
  );
}

/**
 * Sim/não como dois botões, não como interruptor.
 *
 * Um interruptor tem um estado padrão, e padrão aqui é perigoso: quem não mexe em nada aceita
 * uma arquitetura que não escolheu. Dois botões deixam visível que a pessoa respondeu.
 */
function SimNao({
  rotulo,
  ajuda,
  valor,
  aoMudar,
}: {
  rotulo: string;
  ajuda?: string;
  valor: boolean;
  aoMudar: (v: boolean) => void;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-t border-border py-3 first:border-t-0">
      <div className="min-w-0">
        <p className="text-sm font-medium">{rotulo}</p>
        {ajuda && <p className="mt-0.5 text-xs text-muted-foreground">{ajuda}</p>}
      </div>
      <div className="flex shrink-0 gap-1.5">
        {[
          { texto: "Não", v: false },
          { texto: "Sim", v: true },
        ].map((o) => (
          <button
            key={o.texto}
            type="button"
            onClick={() => aoMudar(o.v)}
            className={cn(
              "tap rounded-lg px-4 py-2 text-sm transition-colors",
              valor === o.v
                ? "bg-primary/15 font-medium text-primary"
                : "bg-surface-2 text-muted-foreground hover:text-foreground",
            )}
          >
            {o.texto}
          </button>
        ))}
      </div>
    </div>
  );
}

function Opcoes<T extends string>({
  valor,
  opcoes,
  aoMudar,
}: {
  valor: T;
  opcoes: { v: T; texto: string }[];
  aoMudar: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {opcoes.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => aoMudar(o.v)}
          className={cn(
            "tap rounded-lg px-4 py-2 text-sm transition-colors",
            valor === o.v
              ? "bg-primary/15 font-medium text-primary"
              : "bg-surface-2 text-muted-foreground hover:text-foreground",
          )}
        >
          {o.texto}
        </button>
      ))}
    </div>
  );
}

export function Questionario({
  respostas,
  aoMudar,
}: {
  respostas: Respostas;
  aoMudar: (r: Respostas) => void;
}) {
  const set = <K extends keyof Respostas>(chave: K, valor: Respostas[K]) =>
    aoMudar({ ...respostas, [chave]: valor });

  function alternarModo(modo: ModoDeConstruir) {
    const tem = respostas.comoConstroi.includes(modo);
    const novo = tem
      ? respostas.comoConstroi.filter((m) => m !== modo)
      : [...respostas.comoConstroi, modo];
    // Nunca deixa os dois desmarcados: o plano precisa saber para quem escreve as etapas.
    set("comoConstroi", novo.length > 0 ? novo : [modo]);
  }

  return (
    <div className="space-y-6">
      <section>
        <h2 className="font-display text-lg font-semibold">Sobre a ideia</h2>
        <div className="mt-3">
          <Campo rotulo="O que você quer criar?">
            <Texto
              valor={respostas.oQue}
              aoMudar={(v) => set("oQue", v)}
              teto={TETOS_RESPOSTA.oQue}
              exemplo="Um app para donos de food truck controlarem estoque e vendas do dia"
            />
          </Campo>

          <Campo rotulo="Para quem?" ajuda="Quanto mais específico, melhor o plano.">
            <Texto
              valor={respostas.paraQuem}
              aoMudar={(v) => set("paraQuem", v)}
              teto={TETOS_RESPOSTA.paraQuem}
              exemplo="Donos de food truck que trabalham sozinhos ou com um ajudante"
            />
          </Campo>

          <Campo rotulo="Qual problema resolve?">
            <Texto
              valor={respostas.problema}
              aoMudar={(v) => set("problema", v)}
              teto={TETOS_RESPOSTA.problema}
              exemplo="Eles anotam venda em papel e só descobrem que acabou um insumo no meio do atendimento"
            />
          </Campo>

          <Campo
            rotulo="Como pretende ganhar dinheiro?"
            ajuda="Pode deixar em branco se ainda não sabe."
          >
            <Texto
              valor={respostas.comoGanhaDinheiro}
              aoMudar={(v) => set("comoGanhaDinheiro", v)}
              teto={TETOS_RESPOSTA.comoGanhaDinheiro}
              linhas={2}
              exemplo="Assinatura mensal"
            />
          </Campo>

          <Campo rotulo="Que tipo de projeto é?">
            <Opcoes
              valor={respostas.tipo}
              opcoes={TIPOS_PROJETO.map((t) => ({ v: t, texto: ROTULO_TIPO[t] }))}
              aoMudar={(v) => set("tipo", v)}
            />
          </Campo>
        </div>
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold">O que o sistema precisa ter</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Cada "sim" aqui adiciona trabalho ao seu projeto. Responda "não" quando tiver dúvida — dá
          para mudar depois.
        </p>

        <div className="mt-3">
          <SimNao
            rotulo="Terá usuários autenticados?"
            ajuda="As pessoas precisam entrar com uma conta?"
            valor={respostas.temAutenticacao}
            aoMudar={(v) => set("temAutenticacao", v)}
          />
          {respostas.temAutenticacao && (
            <div className="border-t border-border py-3 pl-4">
              <p className="text-sm font-medium">Quantos tipos de usuário?</p>
              <p className="mt-0.5 mb-2 text-xs text-muted-foreground">
                Mais de um tipo significa papéis e permissões — só marque se for mesmo o caso.
              </p>
              <Opcoes
                valor={respostas.tiposDeUsuario}
                opcoes={[
                  { v: "um" as const, texto: "Um só" },
                  { v: "varios" as const, texto: "Vários" },
                ]}
                aoMudar={(v) => set("tiposDeUsuario", v)}
              />
            </div>
          )}
          <SimNao
            rotulo="Terá pagamentos?"
            ajuda="O sistema cobra dinheiro de alguém por dentro dele."
            valor={respostas.temPagamentos}
            aoMudar={(v) => set("temPagamentos", v)}
          />
          <SimNao
            rotulo="Terá IA?"
            ajuda="O produto usa modelo de linguagem para entregar valor."
            valor={respostas.temIa}
            aoMudar={(v) => set("temIa", v)}
          />
          <SimNao
            rotulo="Terá upload de arquivos?"
            ajuda="Fotos, documentos ou qualquer arquivo enviado por quem usa."
            valor={respostas.temUploads}
            aoMudar={(v) => set("temUploads", v)}
          />
          <SimNao
            rotulo="Terá dados sensíveis?"
            ajuda="CPF, dado de saúde, dado financeiro, localização — qualquer coisa que a LGPD proteja."
            valor={respostas.temDadosSensiveis}
            aoMudar={(v) => set("temDadosSensiveis", v)}
          />
          <SimNao
            rotulo="Terá integrações externas?"
            ajuda="Conversa com outro sistema: WhatsApp, e-mail, ERP, planilha."
            valor={respostas.temIntegracoes}
            aoMudar={(v) => set("temIntegracoes", v)}
          />
          {respostas.temIntegracoes && (
            <div className="border-t border-border py-3 pl-4">
              <p className="mb-2 text-sm font-medium">Quais, se já souber?</p>
              <Texto
                valor={respostas.integracoesQuais}
                aoMudar={(v) => set("integracoesQuais", v)}
                teto={TETOS_RESPOSTA.integracoesQuais}
                linhas={2}
                exemplo="WhatsApp para avisar o cliente, e-mail para o relatório semanal"
              />
            </div>
          )}
        </div>
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold">Sobre você</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Isto muda como o plano é escrito, não o que ele cobre.
        </p>

        <div className="mt-3">
          <Campo rotulo="Qual seu nível técnico?">
            <Opcoes
              valor={respostas.nivelTecnico}
              opcoes={(["iniciante", "intermediario", "avancado"] as NivelTecnico[]).map((n) => ({
                v: n,
                texto: ROTULO_NIVEL[n],
              }))}
              aoMudar={(v) => set("nivelTecnico", v)}
            />
          </Campo>

          <Campo rotulo="Como pretende construir?" ajuda="Pode marcar os dois.">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { m: "ia" as const, texto: "Pedindo para uma IA" },
                  { m: "manual" as const, texto: "Programando à mão" },
                ] as const
              ).map((o) => (
                <button
                  key={o.m}
                  type="button"
                  onClick={() => alternarModo(o.m)}
                  className={cn(
                    "tap rounded-lg px-4 py-2 text-sm transition-colors",
                    respostas.comoConstroi.includes(o.m)
                      ? "bg-primary/15 font-medium text-primary"
                      : "bg-surface-2 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {o.texto}
                </button>
              ))}
            </div>
          </Campo>

          <Campo
            rotulo="Qual stack pretende usar?"
            ajuda="Deixe em branco se não souber — aí eu escolho e explico por quê."
          >
            <Texto
              valor={respostas.stackPreferida}
              aoMudar={(v) => set("stackPreferida", v)}
              teto={TETOS_RESPOSTA.stackPreferida}
              linhas={2}
              exemplo="React Native e Supabase"
            />
          </Campo>
        </div>
      </section>
    </div>
  );
}

/** Resumo das respostas, para a tela do plano mostrar sem reabrir o formulário. */
export function ResumoRespostas({ respostas }: { respostas: Respostas }) {
  const ligados = [
    respostas.temAutenticacao && "login",
    respostas.temAutenticacao && respostas.tiposDeUsuario === "varios" && "papéis",
    respostas.temPagamentos && "pagamentos",
    respostas.temIa && "IA",
    respostas.temUploads && "arquivos",
    respostas.temDadosSensiveis && "dados sensíveis",
    respostas.temIntegracoes && "integrações",
  ].filter((x): x is string => Boolean(x));

  return (
    <div className="flex flex-wrap gap-1.5">
      <Chip tone="primary">{ROTULO_TIPO[respostas.tipo]}</Chip>
      {ligados.map((x) => (
        <Chip key={x}>{x}</Chip>
      ))}
      {ligados.length === 0 && <Chip tone="muted">sem extras</Chip>}
    </div>
  );
}
