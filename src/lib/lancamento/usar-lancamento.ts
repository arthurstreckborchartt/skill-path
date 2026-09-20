import { useMemo } from "react";
import { useValidacao } from "@/lib/validacao/usar-validacao";
import { gerarRelatorio, progressoPorAmbiente, veredito } from "./motor";
import { PREFIXO_CONFIRMACAO, idConfirmacao, type ContextoLancamento } from "./contrato";

/**
 * O lançamento na tela.
 *
 * ## Por que este hook envolve o da validação em vez de carregar de novo
 *
 * Os dois módulos precisam exatamente do mesmo contexto: o projeto, o blueprint, o modelo de
 * dados, o mapa de API, o plano de IA e o resultado da sonda. Repetir as seis consultas numa
 * segunda tela custaria duas coisas — a rede, que é o menor problema, e a **divergência**: o dia
 * em que alguém acrescentasse um artefato ao contexto da validação e esquecesse deste lado, o
 * lançamento passaria a avaliar um projeto que não é bem o mesmo.
 *
 * Envolver deixa uma fonte só. O preço é o acoplamento: mexer em `ContextoValidacao` obriga a
 * olhar aqui. Está escrito para que seja olhado.
 *
 * ## As confirmações moram juntas, e não se misturam
 *
 * Os dois módulos gravam no mesmo `pathly_validacoes.confirmacoes`, que é um objeto por projeto.
 * O que os separa é o prefixo `lancamento:` no id — então uma confirmação de lançamento nunca é
 * lida como verificação de validação, e vice-versa.
 *
 * Isso evita uma tabela nova, que significaria mais um SQL para alguém rodar no Supabase, mais um
 * estado em `ESTADO-SQL.md` e mais uma chance de um ambiente ficar pela metade — tudo para
 * guardar um objeto com as mesmas chaves.
 */
export function useLancamento(projetoId: string) {
  const { estado, sondando, sondarBanco, alternarConfirmacao, recarregar } =
    useValidacao(projetoId);

  const relatorio = useMemo(() => {
    if (estado.estado !== "pronto") return null;

    const contexto: ContextoLancamento = {
      nomeProjeto: estado.nomeProjeto,
      respostas: estado.contexto.respostas,
      blueprint: estado.contexto.blueprint,
      modelo: estado.contexto.modelo,
      api: estado.contexto.api,
      planoIa: estado.contexto.planoIa,
      tabelasNoBanco: estado.contexto.tabelasNoBanco,
    };

    const rel = gerarRelatorio(contexto, estado.confirmacoes);
    return {
      contexto,
      relatorio: rel,
      porAmbiente: progressoPorAmbiente(rel),
      veredito: veredito(rel),
    };
  }, [estado]);

  /**
   * Confirma um passo do lançamento.
   *
   * Só acrescenta o prefixo e repassa — a marca otimista, o desfazer quando o banco recusa e a
   * distinção de `PGRST205` já vivem no hook da validação, e reimplementá-los aqui seria criar
   * duas versões da mesma regra para divergirem depois.
   */
  const confirmarPasso = (passoId: string) => alternarConfirmacao(idConfirmacao(passoId));

  /** O erro de gravação, com o prefixo removido, para a tela casar com o id do passo. */
  const erroConfirmacao =
    estado.estado === "pronto" && estado.erroConfirmacao?.id.startsWith(PREFIXO_CONFIRMACAO)
      ? {
          id: estado.erroConfirmacao.id.slice(PREFIXO_CONFIRMACAO.length),
          mensagem: estado.erroConfirmacao.mensagem,
        }
      : null;

  return {
    estado,
    relatorio,
    sondando,
    sondarBanco,
    confirmarPasso,
    erroConfirmacao,
    recarregar,
  };
}
