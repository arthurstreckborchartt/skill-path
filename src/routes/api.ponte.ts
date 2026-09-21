import { createFileRoute } from "@tanstack/react-router";
import { lerEnv } from "@/lib/server-env";
import { lerJsonLimitado, texto } from "@/lib/entrada-segura";
import { codigoValido, normalizarCodigo, INTERVALO_BATIDA_S } from "@/lib/hub/ponte/contrato";
import { ADAPTADORES } from "@/lib/hub/ponte/acoes";

/**
 * `POST /api/ponte` — o único endereço que a ponte local conhece.
 *
 * ## A inversão que faz isto funcionar
 *
 * A nuvem não alcança `localhost`. Então quem procura é a ponte: ela chama daqui de fora, de
 * dentro da máquina, por HTTPS comum. Não abre porta, não precisa de IP fixo, atravessa NAT e
 * firewall, e a pessoa fecha o programa quando quiser.
 *
 * ## Quatro operações, e nenhuma delas é "execute"
 *
 * - `parear` — troca um código de seis letras por um token. Uma vez.
 * - `buscar` — "tem tarefa para mim?" Serve também de batida.
 * - `resultado` — devolve o que aconteceu.
 * - `adeus` — a ponte avisa que está saindo, para a tela não esperar o tempo da tolerância.
 *
 * Não existe uma operação que receba comando. O servidor responde com `acaoId` e parâmetros
 * nomeados, e a ponte confere esse id no catálogo **dela** antes de qualquer coisa.
 *
 * ## Autenticação
 *
 * A ponte manda `Authorization: Bearer <token da ponte>`. O servidor guarda só o SHA-256 dele, e
 * compara hash com hash — o token em claro existe uma vez, na resposta do pareamento, e nunca
 * mais. Um vazamento da tabela não dá a ninguém o direito de falar como a ponte de alguém.
 */

const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };

function erro(status: number, mensagem: string) {
  return new Response(JSON.stringify({ erro: mensagem }), { status, headers: JSON_HEADERS });
}

function ok(corpo: Record<string, unknown>) {
  return new Response(JSON.stringify(corpo), { status: 200, headers: JSON_HEADERS });
}

async function sha256(v: string): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Comparação em tempo constante.
 *
 * Aqui os dois lados são hashes hexadecimais de tamanho fixo, então o vazamento por tempo é
 * pequeno — mas comparar segredo com `===` é o hábito que um dia se aplica a um caso em que
 * importa. O custo é uma função de seis linhas.
 */
function mesmoSegredo(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

function ambiente() {
  const url = lerEnv("SUPABASE_URL") ?? lerEnv("VITE_SUPABASE_URL");
  const servico = lerEnv("SUPABASE_SERVICE_ROLE_KEY");
  return url && servico
    ? {
        url: url.replace(/\/+$/, ""),
        cabecalho: { apikey: servico, Authorization: `Bearer ${servico}` },
      }
    : null;
}

type LinhaPonte = {
  id: string;
  user_id: string;
  nome: string;
  adaptadores: string[];
  revogada_em: string | null;
};

/**
 * Acha a ponte pelo token.
 *
 * Roda com `service_role` por necessidade: a ponte não é uma sessão de usuário, então não há
 * token de pessoa para a RLS usar. O que substitui a RLS aqui é o escopo da consulta — ela filtra
 * **pelo hash do token**, que é o próprio segredo. Sem o segredo não há linha.
 */
async function acharPonte(
  token: string,
): Promise<{ ok: true; ponte: LinhaPonte } | { ok: false; status: number; motivo: string }> {
  const amb = ambiente();
  if (!amb) return { ok: false, status: 500, motivo: "Ambiente sem configuração de servidor." };

  const hash = await sha256(token);
  const r = await fetch(
    `${amb.url}/rest/v1/pathly_pontes?select=id,user_id,nome,adaptadores,revogada_em,token_hash&token_hash=eq.${hash}&limit=1`,
    { headers: amb.cabecalho },
  );
  if (!r.ok) return { ok: false, status: 503, motivo: "Não consegui consultar agora." };

  const linha = ((await r.json()) as (LinhaPonte & { token_hash: string })[])[0];
  if (!linha || !mesmoSegredo(linha.token_hash, hash)) {
    return { ok: false, status: 401, motivo: "Token de ponte inválido." };
  }
  /* Revogada responde 403, e não 401: a diferença diz à ponte para parar em vez de tentar de novo. */
  if (linha.revogada_em) {
    return {
      ok: false,
      status: 403,
      motivo: "Esta ponte foi revogada. Pareie de novo se quiser voltar.",
    };
  }
  return { ok: true, ponte: linha };
}

async function tocar(url: string, cabecalho: Record<string, string>, ponteId: string) {
  await fetch(`${url}/rest/v1/pathly_pontes?id=eq.${ponteId}`, {
    method: "PATCH",
    headers: { ...cabecalho, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ ultima_batida: new Date().toISOString() }),
  }).catch(() => undefined);
}

type Corpo = {
  operacao?: unknown;
  codigo?: unknown;
  nome?: unknown;
  plataforma?: unknown;
  versao?: unknown;
  adaptadores?: unknown;
  tarefaId?: unknown;
  resultado?: unknown;
};

export const Route = createFileRoute("/api/ponte")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      POST: async ({ request }) => {
        const amb = ambiente();
        if (!amb) return erro(500, "Ambiente sem configuração de servidor.");

        const corpo = await lerJsonLimitado<Corpo>(request);
        if (!corpo.ok) {
          return erro(
            400,
            corpo.motivo === "grande" ? "Requisição grande demais." : "Corpo inválido.",
          );
        }

        const operacao = texto(corpo.dados.operacao, 20);

        // ---- Parear: o único caminho sem token ------------------------------------------------
        if (operacao === "parear") {
          const codigo = normalizarCodigo(texto(corpo.dados.codigo, 20) ?? "");
          if (!codigoValido(codigo)) return erro(400, "Código de pareamento inválido.");

          const hashCodigo = await sha256(codigo);
          const agora = new Date().toISOString();

          /*
           * A troca é condicional e atômica: o `PATCH` só casa se o código ainda estiver sem uso
           * e dentro da validade. Ler e depois escrever deixaria uma janela em que o mesmo código
           * pareia duas pontes.
           */
          const consumo = await fetch(
            `${amb.url}/rest/v1/pathly_ponte_codigos?codigo_hash=eq.${hashCodigo}&usado_em=is.null&expira_em=gt.${agora}`,
            {
              method: "PATCH",
              headers: {
                ...amb.cabecalho,
                "Content-Type": "application/json",
                Prefer: "return=representation",
              },
              body: JSON.stringify({ usado_em: agora }),
            },
          );
          const consumidos = consumo.ok ? ((await consumo.json()) as { user_id: string }[]) : [];
          if (consumidos.length === 0) {
            return erro(400, "Código inválido, já usado ou vencido. Gere outro no Pathly.");
          }

          const adaptadores = Array.isArray(corpo.dados.adaptadores)
            ? (corpo.dados.adaptadores as unknown[])
                .filter((x): x is string => typeof x === "string")
                /* Só adaptadores que este servidor conhece. Nome livre aqui viraria dado sujo. */
                .filter((x) => ADAPTADORES.includes(x))
            : [];

          /*
           * O token nasce aqui, é devolvido uma vez e some. O servidor guarda só o hash — se a
           * pessoa perder o token, o caminho é parear de novo, e é assim que deve ser.
           */
          const tokenNovo =
            crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");

          const criacao = await fetch(`${amb.url}/rest/v1/pathly_pontes`, {
            method: "POST",
            headers: {
              ...amb.cabecalho,
              "Content-Type": "application/json",
              Prefer: "return=representation",
            },
            body: JSON.stringify({
              user_id: consumidos[0]!.user_id,
              nome: texto(corpo.dados.nome, 60) || "Ponte sem nome",
              plataforma: texto(corpo.dados.plataforma, 40) || "desconhecida",
              versao: texto(corpo.dados.versao, 20) || "0",
              adaptadores,
              token_hash: await sha256(tokenNovo),
              ultima_batida: agora,
            }),
          });

          if (!criacao.ok) return erro(503, "Não consegui registrar a ponte.");
          const criada = ((await criacao.json()) as { id: string }[])[0];

          return ok({
            ponteId: criada!.id,
            token: tokenNovo,
            intervaloSegundos: INTERVALO_BATIDA_S,
            aviso:
              "Guarde este token: ele não será mostrado de novo. O Pathly só tem o hash dele. " +
              "Nenhuma permissão foi concedida ainda — autorize cada ação em Configurações → Pontes.",
          });
        }

        // ---- Daqui em diante, tudo exige token -------------------------------------------------
        const auth = request.headers.get("Authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        if (!token) return erro(401, "Falta o token da ponte.");

        const achada = await acharPonte(token);
        if (!achada.ok) return erro(achada.status, achada.motivo);
        const ponte = achada.ponte;

        if (operacao === "adeus") {
          /* Zera a batida para a tela mostrar offline na hora, sem esperar a tolerância. */
          await fetch(`${amb.url}/rest/v1/pathly_pontes?id=eq.${ponte.id}`, {
            method: "PATCH",
            headers: {
              ...amb.cabecalho,
              "Content-Type": "application/json",
              Prefer: "return=minimal",
            },
            body: JSON.stringify({ ultima_batida: null }),
          }).catch(() => undefined);
          return ok({ tchau: true });
        }

        // ---- Buscar tarefa, e bater o coração no mesmo gesto -----------------------------------
        if (operacao === "buscar") {
          await tocar(amb.url, amb.cabecalho, ponte.id);
          const agora = new Date().toISOString();

          /*
           * A reserva: `pendente` → `entregue`, condicional. Duas instâncias da mesma ponte
           * abertas por engano não levam a mesma tarefa duas vezes — quem escrever primeiro
           * leva, e a segunda encontra zero linhas.
           */
          const alvo =
            `${amb.url}/rest/v1/pathly_ponte_tarefas` +
            `?ponte_id=eq.${ponte.id}&estado=eq.pendente&expira_em=gt.${agora}` +
            `&order=criada_em.asc&limit=1`;

          const busca = await fetch(`${alvo}&select=id`, { headers: amb.cabecalho });
          if (!busca.ok) return ok({ tarefa: null, intervaloSegundos: INTERVALO_BATIDA_S });

          const candidata = ((await busca.json()) as { id: string }[])[0];
          if (!candidata) return ok({ tarefa: null, intervaloSegundos: INTERVALO_BATIDA_S });

          const reserva = await fetch(
            `${amb.url}/rest/v1/pathly_ponte_tarefas?id=eq.${candidata.id}&estado=eq.pendente`,
            {
              method: "PATCH",
              headers: {
                ...amb.cabecalho,
                "Content-Type": "application/json",
                Prefer: "return=representation",
              },
              body: JSON.stringify({ estado: "entregue", entregue_em: agora }),
            },
          );
          const reservadas = reserva.ok
            ? ((await reserva.json()) as {
                id: string;
                acao_id: string;
                parametros: Record<string, unknown>;
                modo: string;
                plano_id: string | null;
                impressao_plano: string | null;
                criada_em: string;
                expira_em: string;
              }[])
            : [];

          const t = reservadas[0];
          if (!t) return ok({ tarefa: null, intervaloSegundos: INTERVALO_BATIDA_S });

          return ok({
            intervaloSegundos: INTERVALO_BATIDA_S,
            tarefa: {
              tarefaId: t.id,
              acaoId: t.acao_id,
              parametros: t.parametros,
              modo: t.modo,
              ...(t.plano_id ? { planoId: t.plano_id } : {}),
              ...(t.impressao_plano ? { impressaoDoPlano: t.impressao_plano } : {}),
              criadaEm: t.criada_em,
              expiraEm: t.expira_em,
            },
          });
        }

        // ---- Devolver o resultado ---------------------------------------------------------------
        if (operacao === "resultado") {
          await tocar(amb.url, amb.cabecalho, ponte.id);

          const tarefaId = texto(corpo.dados.tarefaId, 40);
          const r = corpo.dados.resultado as { tipo?: string; recusa?: string } | undefined;
          if (!tarefaId || !r?.tipo) return erro(400, "Faltou a tarefa ou o resultado.");

          const estado =
            r.tipo === "ok" || r.tipo === "plano"
              ? "concluida"
              : r.tipo === "recusado"
                ? "recusada"
                : "falhou";

          const gravou = await fetch(
            `${amb.url}/rest/v1/pathly_ponte_tarefas?id=eq.${tarefaId}&ponte_id=eq.${ponte.id}&estado=eq.entregue`,
            {
              method: "PATCH",
              headers: {
                ...amb.cabecalho,
                "Content-Type": "application/json",
                Prefer: "return=representation",
              },
              body: JSON.stringify({
                estado,
                resultado: r,
                recusa: r.recusa ?? null,
                concluida_em: new Date().toISOString(),
              }),
            },
          );

          const linhas = gravou.ok ? ((await gravou.json()) as unknown[]) : [];
          /*
           * Zero linhas quer dizer que a tarefa não estava `entregue` — outra instância já
           * respondeu, ou ela venceu. Dizer isso é melhor que um `200` mudo, porque a ponte
           * descobre que o trabalho dela não foi aproveitado.
           */
          if (linhas.length === 0) {
            return erro(409, "Esta tarefa não está mais esperando resultado.");
          }

          /* A auditoria leva o ato, nunca o conteúdo do resultado. */
          await fetch(`${amb.url}/rest/v1/pathly_hub_auditoria`, {
            method: "POST",
            headers: {
              ...amb.cabecalho,
              "Content-Type": "application/json",
              Prefer: "return=minimal",
            },
            body: JSON.stringify({
              user_id: ponte.user_id,
              provedor: `ponte:${ponte.id}`,
              ato: estado === "concluida" ? "execucao" : "acesso-negado",
              detalhe: `${tarefaId}: ${r.tipo}${r.recusa ? ` (${r.recusa})` : ""}`,
            }),
          }).catch(() => undefined);

          return ok({ recebido: true });
        }

        return erro(400, "Operação desconhecida.");
      },
    },
  },
});
