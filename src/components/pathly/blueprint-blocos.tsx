import {
  AlertTriangle,
  Cloud,
  Database,
  FlaskConical,
  KeyRound,
  Lock,
  Rocket,
  Route as RouteIcon,
  Server,
  Shield,
} from "lucide-react";
import { Chip } from "./ui";
import type { Execucao, Fundacao, Operacao, Produto, Tecnico } from "@/lib/blueprint/contrato";

/**
 * Como cada bloco do blueprint aparece na tela.
 *
 * Separado da rota porque são quatro leiautes diferentes e independentes entre si — deixá-los no
 * arquivo da rota faria dela um monólito onde mexer na tabela de dados arrisca a lista de riscos.
 */

function Secao({
  titulo,
  children,
  icone: Icone,
}: {
  titulo: string;
  children: React.ReactNode;
  icone?: typeof Database;
}) {
  return (
    <section className="mt-6 first:mt-0">
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {Icone && <Icone className="size-3.5" />}
        {titulo}
      </h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function Paragrafo({ children }: { children: React.ReactNode }) {
  return <p className="text-sm leading-relaxed text-foreground/90">{children}</p>;
}

function Lista({ itens }: { itens: string[] }) {
  return (
    <ul className="space-y-1.5">
      {itens.map((item, i) => (
        <li key={i} className="flex gap-2 text-sm leading-relaxed text-foreground/90">
          <span className="mt-2 size-1 shrink-0 rounded-full bg-primary" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function BlocoFundacao({ dados }: { dados: Fundacao }) {
  return (
    <div>
      <Secao titulo="O problema">
        <Paragrafo>{dados.problema}</Paragrafo>
      </Secao>

      <Secao titulo="Quem paga">
        <Paragrafo>{dados.publico}</Paragrafo>
      </Secao>

      <Secao titulo={`Quem usa: ${dados.persona.nome}`}>
        <Paragrafo>
          {dados.persona.papel}. {dados.persona.contexto}
        </Paragrafo>
        <div className="mt-3">
          <Lista itens={dados.persona.dores} />
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground/80">Hoje resolve assim:</span>{" "}
          {dados.persona.alternativaAtual}
        </p>
      </Secao>

      <Secao titulo="Por que trocariam pelo seu">
        <Paragrafo>{dados.propostaDeValor}</Paragrafo>
      </Secao>

      <Secao titulo="Como ganha dinheiro">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="primary">{dados.modeloDeNegocio.tipo}</Chip>
          <Chip tone="accent">{dados.modeloDeNegocio.precoSugerido}</Chip>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {dados.modeloDeNegocio.justificativa}
        </p>
      </Secao>
    </div>
  );
}

export function BlocoProduto({ dados }: { dados: Produto }) {
  const mvp = dados.funcionalidades.filter((f) => f.prioridade === "mvp");
  const depois = dados.funcionalidades.filter((f) => f.prioridade === "depois");

  return (
    <div>
      <Secao titulo={`No MVP — ${mvp.length} funcionalidades`}>
        <p className="mb-3 text-sm text-muted-foreground">
          O menor conjunto que já resolve o problema de ponta a ponta. Construa só isto primeiro.
        </p>
        <div className="space-y-3">
          {mvp.map((f) => (
            <div key={f.nome} className="rounded-lg border border-border bg-surface/40 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="font-medium">{f.nome}</h4>
                <Chip tone={f.complexidade === "alta" ? "accent" : "muted"}>{f.complexidade}</Chip>
              </div>
              <p className="mt-1.5 text-sm text-foreground/90">{f.descricao}</p>
              <p className="mt-2 text-xs text-muted-foreground">{f.porque}</p>
            </div>
          ))}
        </div>
      </Secao>

      {depois.length > 0 && (
        <Secao titulo="Depois do MVP">
          <div className="space-y-2">
            {depois.map((f) => (
              <div key={f.nome} className="flex flex-wrap items-baseline gap-2 text-sm">
                <span className="font-medium text-foreground/80">{f.nome}</span>
                <span className="text-muted-foreground">— {f.porque}</span>
              </div>
            ))}
          </div>
        </Secao>
      )}

      {dados.requisitosFuncionais.length > 0 && (
        <Secao titulo={`Requisitos funcionais — ${dados.requisitosFuncionais.length}`}>
          <p className="mb-3 text-sm text-muted-foreground">
            O comportamento exato que o sistema precisa ter. Cada um tem um critério que diz quando
            está pronto.
          </p>
          <div className="space-y-2">
            {dados.requisitosFuncionais.map((r) => (
              <div key={r.id} className="rounded-lg border border-border bg-surface/40 p-3">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-mono text-xs font-semibold text-primary">{r.id}</span>
                  <span className="text-xs text-muted-foreground">{r.funcionalidade}</span>
                </div>
                <p className="mt-1.5 text-sm text-foreground/90">{r.descricao}</p>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground/70">Pronto quando:</span>{" "}
                  {r.criterioAceite}
                </p>
              </div>
            ))}
          </div>
        </Secao>
      )}

      {dados.foraDoEscopo.length > 0 && (
        <Secao titulo="Fora do escopo">
          <p className="mb-2 text-sm text-muted-foreground">
            O que este produto deliberadamente não faz. Isto protege seu tempo.
          </p>
          <Lista itens={dados.foraDoEscopo} />
        </Secao>
      )}
    </div>
  );
}

export function BlocoTecnico({ dados }: { dados: Tecnico }) {
  return (
    <div>
      <Secao titulo="Stack" icone={Server}>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ["Frontend", dados.stack.frontend],
              ["Backend", dados.stack.backend],
              ["Banco", dados.stack.banco],
              ["Hospedagem", dados.stack.hospedagem],
            ] as const
          )
            .filter(([, v]) => v)
            .map(([rotulo, valor]) => (
              <div key={rotulo} className="rounded-lg border border-border bg-surface/40 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{rotulo}</p>
                <p className="mt-1 text-sm">{valor}</p>
              </div>
            ))}
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {dados.stack.justificativa}
        </p>
      </Secao>

      <Secao titulo="Arquitetura">
        <Paragrafo>{dados.arquitetura}</Paragrafo>
      </Secao>

      <Secao titulo={`Modelo de dados — ${dados.tabelas.length} tabelas`} icone={Database}>
        <div className="space-y-3">
          {dados.tabelas.map((t) => (
            <div key={t.nome} className="rounded-lg border border-border bg-surface/40 p-4">
              <h4 className="font-mono text-sm font-semibold text-primary">{t.nome}</h4>
              <p className="mt-1 text-sm text-muted-foreground">{t.descricao}</p>
              <div className="mt-3 space-y-1">
                {t.campos.map((c) => (
                  <div key={c.nome} className="flex flex-wrap items-baseline gap-x-2 text-xs">
                    <span className="font-mono text-foreground/90">{c.nome}</span>
                    <span className="font-mono text-muted-foreground">{c.tipo}</span>
                    <span className="text-muted-foreground">— {c.descricao}</span>
                  </div>
                ))}
              </div>
              {t.relacoes.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {t.relacoes.map((r, i) => (
                    <Chip key={i}>{r}</Chip>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </Secao>

      {dados.endpoints.length > 0 && (
        <Secao titulo={`API — ${dados.endpoints.length} endpoints`}>
          <div className="space-y-1.5">
            {dados.endpoints.map((e, i) => (
              <div key={i} className="flex flex-wrap items-baseline gap-2 text-xs">
                <span className="w-14 shrink-0 font-mono font-semibold text-primary">
                  {e.metodo}
                </span>
                <span className="font-mono text-foreground/90">{e.caminho}</span>
                {!e.autenticado && <Chip tone="accent">público</Chip>}
                <span className="text-muted-foreground">— {e.descricao}</span>
              </div>
            ))}
          </div>
        </Secao>
      )}

      {dados.seguranca.length > 0 && (
        <Secao titulo="Segurança" icone={Shield}>
          <Lista itens={dados.seguranca} />
        </Secao>
      )}

      {dados.integracoes.length > 0 && (
        <Secao titulo="Integrações">
          <div className="space-y-2">
            {dados.integracoes.map((x) => (
              <div key={x.nome} className="flex flex-wrap items-baseline gap-2 text-sm">
                <span className="font-medium">{x.nome}</span>
                {x.obrigatoria && <Chip tone="primary">obrigatória</Chip>}
                <span className="text-muted-foreground">— {x.para}</span>
              </div>
            ))}
          </div>
        </Secao>
      )}

      <Secao titulo="Autenticação" icone={KeyRound}>
        {dados.autenticacao.necessaria ? (
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-surface/40 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Método</p>
                <p className="mt-1 text-sm">{dados.autenticacao.metodo}</p>
              </div>
              {dados.autenticacao.sessao && (
                <div className="rounded-lg border border-border bg-surface/40 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Sessão</p>
                  <p className="mt-1 text-sm">{dados.autenticacao.sessao}</p>
                </div>
              )}
            </div>

            {dados.autenticacao.papeis.length > 0 && (
              <div className="mt-3 space-y-2">
                {dados.autenticacao.papeis.map((p) => (
                  <div key={p.nome} className="rounded-lg border border-border bg-surface/40 p-3">
                    <p className="text-sm font-medium">{p.nome}</p>
                    <div className="mt-2">
                      <Lista itens={p.pode} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {dados.autenticacao.protecaoDeRotas && (
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {dados.autenticacao.protecaoDeRotas}
              </p>
            )}
          </>
        ) : (
          // Dizer "não precisa, e por quê" é uma entrega, não um vazio. É o oposto de receber
          // um Auth0 que ninguém pediu.
          <p className="text-sm leading-relaxed text-foreground/90">
            {dados.autenticacao.metodo || "Este projeto não precisa de contas de usuário."}
          </p>
        )}
      </Secao>

      {dados.ia && (
        <Secao titulo="Onde IA entra">
          <Paragrafo>{dados.ia}</Paragrafo>
        </Secao>
      )}
    </div>
  );
}

export function BlocoOperacao({ dados }: { dados: Operacao }) {
  return (
    <div>
      <Secao titulo={`Requisitos não funcionais — ${dados.requisitosNaoFuncionais.length}`}>
        <div className="space-y-2">
          {dados.requisitosNaoFuncionais.map((r, i) => (
            <div key={i} className="rounded-lg border border-border bg-surface/40 p-3">
              <Chip tone="muted">{r.categoria}</Chip>
              <p className="mt-2 text-sm text-foreground/90">{r.descricao}</p>
              <p className="mt-1.5 text-xs text-muted-foreground">
                <span className="font-medium text-foreground/70">Como medir:</span> {r.comoMedir}
              </p>
            </div>
          ))}
        </div>
      </Secao>

      <Secao titulo="Infraestrutura" icone={Cloud}>
        <div className="space-y-2">
          {dados.infraestrutura.map((x, i) => (
            <div key={i} className="rounded-lg border border-border bg-surface/40 p-3">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  {x.componente}
                </span>
                <span className="font-medium">{x.servico}</span>
                {x.custoEstimado && <Chip tone="accent">{x.custoEstimado}</Chip>}
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground">{x.porque}</p>
            </div>
          ))}
        </div>
      </Secao>

      <Secao titulo="Deploy" icone={Rocket}>
        <Paragrafo>{dados.deploy.estrategia}</Paragrafo>

        {dados.deploy.ambientes.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {dados.deploy.ambientes.map((a) => (
              <Chip key={a}>{a}</Chip>
            ))}
          </div>
        )}

        {dados.deploy.passos.length > 0 && (
          <ol className="mt-3 space-y-1.5">
            {dados.deploy.passos.map((passo, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-foreground/90">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                  {i + 1}
                </span>
                <span>{passo}</span>
              </li>
            ))}
          </ol>
        )}

        {dados.deploy.variaveis.length > 0 && (
          <div className="mt-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Variáveis de ambiente
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {dados.deploy.variaveis.map((v) => (
                <code
                  key={v}
                  className="rounded bg-surface-2 px-2 py-1 font-mono text-xs text-foreground/80"
                >
                  {v}
                </code>
              ))}
            </div>
          </div>
        )}
      </Secao>

      {dados.testes.length > 0 && (
        <Secao titulo="Testes" icone={FlaskConical}>
          <div className="space-y-2">
            {dados.testes.map((t, i) => (
              <div key={i} className="rounded-lg border border-border bg-surface/40 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{t.tipo}</span>
                  <Chip tone={t.prioridade === "alta" ? "primary" : "muted"}>{t.prioridade}</Chip>
                  {t.ferramenta && <Chip>{t.ferramenta}</Chip>}
                </div>
                <p className="mt-1.5 text-sm text-foreground/90">{t.oQueCobre}</p>
              </div>
            ))}
          </div>
        </Secao>
      )}
    </div>
  );
}

export function BlocoExecucao({ dados }: { dados: Execucao }) {
  const horas = dados.etapas.reduce((soma, e) => soma + e.estimativaHoras, 0);

  return (
    <div>
      <Secao titulo="Fases" icone={RouteIcon}>
        <div className="space-y-2">
          {dados.fases.map((f, i) => (
            <div key={f.nome} className="flex gap-3 text-sm">
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                {i + 1}
              </span>
              <div>
                <p className="font-medium">{f.nome}</p>
                <p className="text-muted-foreground">{f.objetivo}</p>
              </div>
            </div>
          ))}
        </div>
      </Secao>

      <Secao titulo={`${dados.etapas.length} etapas · ~${horas}h no total`}>
        <div className="space-y-2">
          {dados.etapas.map((e) => (
            <div key={e.ordem} className="rounded-lg border border-border bg-surface/40 p-3">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-mono text-xs text-muted-foreground">
                  {String(e.ordem).padStart(2, "0")}
                </span>
                <h4 className="font-medium">{e.titulo}</h4>
                <Chip tone="muted">{e.estimativaHoras}h</Chip>
              </div>
              <p className="mt-1.5 text-sm text-foreground/90">{e.entrega}</p>
              {e.dependeDe.length > 0 && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Precisa antes: etapa{e.dependeDe.length > 1 ? "s" : ""} {e.dependeDe.join(", ")}
                </p>
              )}
            </div>
          ))}
        </div>
      </Secao>

      {dados.riscos.length > 0 && (
        <Secao titulo="Riscos" icone={AlertTriangle}>
          <div className="space-y-3">
            {dados.riscos.map((r, i) => (
              <div key={i} className="rounded-lg border border-border bg-surface/40 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip tone={r.impacto === "alto" ? "accent" : "muted"}>impacto {r.impacto}</Chip>
                </div>
                <p className="mt-2 text-sm text-foreground/90">{r.descricao}</p>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground/80">O que fazer:</span> {r.mitigacao}
                </p>
              </div>
            ))}
          </div>
        </Secao>
      )}
    </div>
  );
}

/**
 * O bloco que ainda não pode ser gerado.
 *
 * É a peça mais importante desta tela do ponto de vista do produto: em vez de esconder a seção
 * técnica, ela aparece trancada dizendo exatamente o que falta. A pessoa vê que existe uma ordem
 * e por que ela existe — esconder ensinaria menos e pareceria um recurso pago.
 */
export function BlocoTrancado({ falta, porque }: { falta: string[]; porque: string }) {
  return (
    <div className="flex gap-3 rounded-lg border border-dashed border-border p-4">
      <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div>
        <p className="text-sm text-foreground/90">
          Primeiro é preciso definir: <span className="font-medium">{falta.join(" e ")}</span>.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{porque}</p>
      </div>
    </div>
  );
}
