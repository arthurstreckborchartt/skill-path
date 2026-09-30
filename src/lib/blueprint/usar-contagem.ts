import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { contarProgresso, montarRoadmap, type ProgressoEtapa } from "./usar-roadmap";
import type { Projeto } from "./usar-projetos";

/**
 * Quantas etapas cada projeto tem, e quantas estão feitas.
 *
 * ## Por que isto existe
 *
 * As colunas `etapas_total` e `etapas_concluidas` de `pathly_projetos` não servem para mostrar na
 * tela. Medido em produção, num projeto real:
 *
 * | | a coluna diz | a verdade |
 * |---|---|---|
 * | concluídas | `0` | 2 linhas em `pathly_etapas` com status `concluida` |
 * | total | `15` | 13, porque o roadmap filtra as fases que não se aplicam |
 *
 * A de concluídas não está defasada — está **errada**. Nada no código a atualiza quando alguém
 * marca uma etapa como feita; ela nasceu com o projeto e ficou.
 *
 * A de total não está errada, está respondendo outra pergunta: quantas etapas o blueprint
 * escreveu, e não quantas este projeto tem. `fasesDoProjeto` remove Pagamentos de quem não cobra,
 * Backend de quem não tem — e as etapas dessas fases somem do roadmap.
 *
 * O sintoma era a sidebar dizendo `Etapas 0/15` enquanto o painel logo ao lado dizia `2/13`, na
 * mesma tela.
 *
 * ## Uma consulta para todos
 *
 * A contagem certa precisa das linhas de `pathly_etapas`, e a home lista vários projetos. Uma
 * consulta por projeto seria uma rajada proporcional ao tamanho da lista; esta traz todas de uma
 * vez com um `in`.
 *
 * O blueprint e as respostas já vieram com o projeto, então não custam nada.
 */

export type Contagem = { feitas: number; total: number; pct: number };

type LinhaEtapa = { projeto_id: string; ordem: number; status: string };

/**
 * `null` enquanto carrega — e a tela mostra o esqueleto em vez de `0/0`.
 *
 * Um zero que aparece antes do dado chegar é pior que um esqueleto: ele é uma resposta, e a
 * pessoa lê "não fiz nada ainda" quando a verdade é "ainda não sei".
 *
 * **`null` também quando a consulta falha**, pelo mesmo motivo. Um mapa vazio diria "consultei e
 * ninguém concluiu nada" — uma afirmação sobre o que não foi possível saber. Medido: com a
 * consulta devolvendo 500, o cartão mostrava `0/4` e a barra em 0%, indistinguível do zero de
 * verdade. Lista vazia continua sendo mapa vazio, porque aí o zero é sabido: não há projeto.
 */
export function useContagens(projetos: readonly Projeto[]): Map<string, Contagem> | null {
  const [porEtapas, setPorEtapas] = useState<Map<string, ProgressoEtapa[]> | null>(null);

  const ids = projetos.map((p) => p.id).join(",");

  useEffect(() => {
    if (!ids) {
      setPorEtapas(new Map());
      return;
    }

    /*
     * Resposta obsoleta não escreve.
     *
     * `ids` muda quando alguém cria ou apaga um projeto, e a consulta anterior continua em voo. Sem
     * esta guarda a antiga pode chegar depois da nova e sobrescrever a contagem certa por uma que
     * já não vale. É a mesma guarda de `useProjetos` e `useSession`.
     */
    let vivo = true;

    void (async () => {
      const { data, error } = await supabase
        .from("pathly_etapas")
        .select("projeto_id,ordem,status")
        .in("projeto_id", ids.split(","));

      if (!vivo) return;

      if (error) {
        setPorEtapas(null);
        return;
      }

      const mapa = new Map<string, ProgressoEtapa[]>();
      for (const l of (data ?? []) as LinhaEtapa[]) {
        const status = (["pendente", "fazendo", "concluida", "pulada"] as const).includes(
          l.status as never,
        )
          ? (l.status as ProgressoEtapa["status"])
          : "pendente";
        const lista = mapa.get(l.projeto_id) ?? [];
        /* `checklistFeito`, `anotacoes` e `temConteudo` não entram: a contagem só olha `status`, e
         * trazê-los engordaria a resposta sem mudar nenhum número. */
        lista.push({
          ordem: l.ordem,
          status,
          checklistFeito: [],
          anotacoes: "",
          temConteudo: false,
        });
        mapa.set(l.projeto_id, lista);
      }
      setPorEtapas(mapa);
    })();

    return () => {
      vivo = false;
    };
  }, [ids]);

  if (porEtapas === null) return null;

  const saida = new Map<string, Contagem>();
  for (const p of projetos) {
    const progresso = new Map((porEtapas.get(p.id) ?? []).map((e) => [e.ordem, e]));
    const { fases } = montarRoadmap(p.conteudo, p.respostas, progresso);
    const { feitas, total, pct } = contarProgresso(fases);
    saida.set(p.id, { feitas, total, pct });
  }
  return saida;
}
