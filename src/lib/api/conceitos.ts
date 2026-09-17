import type { MapaApi } from "./contrato";
import type { Respostas } from "@/lib/blueprint/respostas";

/**
 * Os conceitos de API, explicados para quem nunca viu — e a regra de quais aparecem.
 *
 * ## Por que a definição é canônica e não gerada
 *
 * O que é um status 404 não muda de projeto para projeto. Gerar essa explicação a cada vez
 * custaria tokens para produzir uma variação da mesma frase, e às vezes uma variação errada: um
 * modelo que confunde 401 com 403 ensinaria errado para sempre naquele projeto.
 *
 * O que muda é **onde o conceito aparece no projeto da pessoa**, e isso a IA escreve em
 * `conceitosNoProjeto` — "JWT aqui guarda o id do dono do food truck". A definição vem daqui, a
 * ponte vem de lá.
 *
 * ## Por que nem todo conceito aparece
 *
 * Explicar OAuth para quem não tem login é ruído que faz a pessoa achar que precisa daquilo.
 * A relevância sai das respostas do questionário e do mapa gerado — a mesma lógica de
 * `blueprint/fases.ts`.
 */

export type Conceito = {
  id: string;
  nome: string;
  /** Uma frase que resolve o termo para quem nunca ouviu. */
  resumo: string;
  /** A explicação de verdade, em 1 a 3 parágrafos. */
  explicacao: string[];
  /** O erro que quase todo mundo comete com isso. */
  armadilha: string;
  /** Quando este conceito entra no projeto. `undefined` = sempre. */
  aplicaSe?: (r: Respostas, m: MapaApi) => boolean;
};

function temAutenticacaoPorToken(_r: Respostas, m: MapaApi): boolean {
  return m.endpoints.some((e) => e.autenticacao === "token");
}

function temSessao(_r: Respostas, m: MapaApi): boolean {
  return m.endpoints.some((e) => e.autenticacao === "sessao");
}

export const CONCEITOS: Conceito[] = [
  {
    id: "api",
    nome: "O que é uma API",
    resumo: "O jeito do seu app pedir coisas ao servidor sem saber como ele faz.",
    explicacao: [
      "Toda tela do seu produto precisa de dados que não estão no celular de quem usa: a lista do que existe, o que outra pessoa gravou, o que precisa ser somado. A API é o conjunto de endereços que o servidor expõe para a tela pedir essas coisas.",
      "Cada endereço desses é um endpoint. A tela manda um pedido e recebe uma resposta, sempre no mesmo formato combinado — e é esse combinado que permite mexer no servidor sem quebrar a tela, e vice-versa.",
    ],
    armadilha:
      "Fazer a tela decidir regra de negócio porque 'é mais rápido'. Qualquer pessoa abre o devtools e chama a API direto, sem passar pela sua tela. A regra precisa estar no servidor.",
  },
  {
    id: "rest",
    nome: "REST",
    resumo: "A convenção de nomear endpoints por coisas, não por ações.",
    explicacao: [
      "REST é um acordo sobre como organizar os endereços. A ideia central: o endereço nomeia uma coisa (um recurso), e o método HTTP diz o que fazer com ela. Por isso `/api/produtos` com POST cria um produto, e o mesmo `/api/produtos` com GET lista os produtos.",
      "O contrário disso é criar um endereço por ação — `/criarProduto`, `/listarProdutos`, `/apagarProduto`. Funciona, mas cada pessoa inventa um nome diferente e ninguém consegue adivinhar o endereço sem abrir a documentação.",
    ],
    armadilha:
      "Usar verbo no caminho. `/api/deletarProduto` não é REST; o jeito certo é DELETE em `/api/produtos/:id`.",
  },
  {
    id: "metodos",
    nome: "GET, POST, PUT, PATCH e DELETE",
    resumo: "Cinco verbos que dizem o que você quer fazer com o recurso.",
    explicacao: [
      "GET busca e não muda nada — pode repetir à vontade. POST cria: chamar duas vezes cria dois, e é por isso que botão de salvar precisa travar depois do primeiro clique.",
      "PUT substitui o registro inteiro, apagando o que você não mandou. PATCH altera só os campos enviados. Essa diferença derruba muita gente: mandar PUT com metade dos campos limpa a outra metade.",
      "DELETE remove. Chamar DELETE de novo num registro já removido deve responder que ele não existe, sem estourar erro de servidor.",
    ],
    armadilha:
      "Usar POST para tudo. Funciona, mas você perde cache em leitura e a capacidade de repetir uma busca com segurança.",
  },
  {
    id: "status",
    nome: "Códigos de status HTTP",
    resumo: "O número que diz, antes de qualquer texto, se deu certo.",
    explicacao: [
      "200 é sucesso. 201 é sucesso com algo criado — é o certo para POST. 204 é sucesso sem nada para devolver, típico de DELETE.",
      "400 é 'seu pedido está malformado'. 401 é 'você não disse quem é'. 403 é 'você disse quem é, e não pode'. 404 é 'não existe'. 409 é 'existe conflito', como e-mail já cadastrado. 422 é 'entendi o pedido, mas os dados não passam nas regras'. 429 é 'você chamou demais'.",
      "500 é culpa do servidor. Todo 500 que aparece é um bug seu — nunca uma resposta planejada.",
    ],
    armadilha:
      "Devolver 200 com `{erro: 'algo deu errado'}` dentro. O cliente precisa checar o corpo para saber se funcionou, e qualquer ferramenta de monitoramento acha que está tudo bem.",
  },
  {
    id: "validacao",
    nome: "Validação",
    resumo: "Conferir no servidor tudo o que chega, mesmo o que a tela já conferiu.",
    explicacao: [
      "A validação da tela existe para a pessoa não perder tempo. A validação do servidor existe porque a tela não é o único jeito de chamar sua API — qualquer um manda uma requisição direto.",
      "Valide tipo, tamanho e formato antes de tocar no banco. E rejeite o que você não espera: campo a mais no corpo costuma ser tentativa de escrever coisa que não deveria.",
    ],
    armadilha:
      'Confiar num campo que veio do cliente para decidir permissão. `{ "admin": true }` no corpo é o ataque mais barato que existe.',
  },
  {
    id: "erros",
    nome: "Respostas de erro",
    resumo: "Um formato só de erro, com código estável e mensagem para humano.",
    explicacao: [
      "Toda resposta de erro da sua API deve ter a mesma forma: um código que o programa testa (`email_ja_existe`) e uma mensagem que a pessoa lê. Testar a mensagem quebra assim que você corrigir uma vírgula.",
      "A mensagem para a pessoa nunca deve conter detalhe interno: nome de tabela, trecho de SQL ou caminho de arquivo entregam o mapa do seu sistema para quem está tentando invadir.",
    ],
    armadilha:
      "Repassar a mensagem do banco direto para a tela. `duplicate key value violates unique constraint` não ajuda ninguém e revela sua estrutura.",
  },
  {
    id: "jwt",
    nome: "JWT (token)",
    resumo: "Um crachá assinado que o cliente mostra a cada chamada.",
    explicacao: [
      "No login, o servidor cria um texto com o id de quem entrou e assina com uma chave secreta. O cliente guarda esse texto e manda no cabeçalho `Authorization: Bearer ...` em toda chamada seguinte.",
      "O servidor confere a assinatura e sabe de quem é, sem precisar consultar o banco. Isso é rápido, e tem um preço: o token continua valendo até expirar, mesmo se você apagar a conta. Por isso o prazo precisa ser curto.",
      "O conteúdo do token é legível por qualquer um — ele é assinado, não cifrado. Nunca coloque senha nem dado sensível dentro dele.",
    ],
    armadilha:
      "Token sem prazo de validade. Um token vazado vale para sempre, e não há como cancelá-lo.",
    aplicaSe: temAutenticacaoPorToken,
  },
  {
    id: "sessoes",
    nome: "Sessões e cookies",
    resumo: "O servidor guarda quem está logado e o navegador leva só um número.",
    explicacao: [
      "A alternativa ao token: no login o servidor guarda a sessão e devolve um cookie com o identificador dela. O navegador manda esse cookie sozinho em toda requisição.",
      "A vantagem sobre o token é poder encerrar a sessão na hora, do lado do servidor. A desvantagem é precisar guardar estado, e ficar sujeito a CSRF — por isso o cookie precisa ser `HttpOnly`, `Secure` e `SameSite`.",
    ],
    armadilha:
      "Cookie sem `HttpOnly`. Sem isso, qualquer script injetado na sua página lê a sessão e assume a conta.",
    aplicaSe: temSessao,
  },
  {
    id: "autorizacao",
    nome: "Autenticação x autorização",
    resumo: "Uma diz quem você é; a outra, o que você pode.",
    explicacao: [
      "Autenticar é confirmar a identidade. Autorizar é decidir se aquela identidade pode fazer aquela ação naquele registro. São checagens diferentes e as duas precisam existir.",
      "O erro clássico é parar na primeira: o endpoint confere que há um token válido e devolve o registro pedido — sem conferir se o registro é de quem pediu. Trocar o id na URL passa a devolver o dado de outra pessoa.",
    ],
    armadilha:
      "Confiar num id que veio do cliente. O dono do recurso sai do token, nunca do corpo da requisição.",
    aplicaSe: (r) => r.temAutenticacao,
  },
  {
    id: "oauth",
    nome: "OAuth (entrar com Google)",
    resumo: "Deixar outro serviço confirmar quem é a pessoa, sem você guardar senha.",
    explicacao: [
      "Em vez de criar senha no seu sistema, a pessoa entra numa tela do Google (ou GitHub, ou Apple), autoriza, e o serviço devolve para você a confirmação de quem é ela.",
      "Você nunca vê a senha — e isso é a maior vantagem: senha que você não guarda é senha que você não vaza. Em troca, o fluxo tem mais peças e depende de um serviço externo estar no ar.",
    ],
    armadilha:
      "Confiar no e-mail devolvido sem conferir se ele foi verificado. Alguns provedores devolvem e-mail não confirmado, e aí dá para tomar a conta de outra pessoa.",
    aplicaSe: (r) => r.temAutenticacao && r.tiposDeUsuario === "varios",
  },
  {
    id: "apikeys",
    nome: "API keys",
    resumo: "Uma chave fixa para outro sistema chamar o seu.",
    explicacao: [
      "Quando quem chama não é uma pessoa e sim outro programa, não faz sentido pedir login. A API key é uma chave longa e secreta que identifica o sistema que chama.",
      "Ela precisa poder ser trocada sem mexer no código, e cada integração deve ter a sua — assim, se uma vazar, você cancela só aquela.",
    ],
    armadilha:
      "Chave no código do frontend. Tudo que chega ao navegador é público, inclusive o que está 'escondido' no bundle.",
    aplicaSe: (_r, m) => m.endpoints.some((e) => e.autenticacao === "api_key"),
  },
  {
    id: "webhooks",
    nome: "Webhooks",
    resumo: "O contrário de uma API: é o outro sistema que chama o seu.",
    explicacao: [
      "Quando um pagamento é confirmado, você não fica perguntando ao gateway se já pagou. Ele chama um endereço seu avisando. Esse endereço é o webhook.",
      "Como qualquer um na internet pode chamar esse endereço, ele precisa provar que a chamada veio mesmo de quem diz: quase todo serviço assina o corpo da requisição, e você confere a assinatura antes de acreditar.",
      "Webhooks chegam fora de ordem e podem chegar duas vezes. O seu código precisa aguentar receber o mesmo aviso repetido sem cobrar duas vezes.",
    ],
    armadilha:
      "Confiar no corpo sem conferir a assinatura. Sem essa checagem, qualquer um manda 'pagamento aprovado' para o seu sistema.",
    aplicaSe: (r) => r.temPagamentos || r.temIntegracoes,
  },
  {
    id: "ratelimit",
    nome: "Rate limiting",
    resumo: "Um teto de chamadas por pessoa, por tempo.",
    explicacao: [
      "Sem teto, uma única pessoa (ou um script) pode chamar seu endpoint mil vezes por minuto. Se ele consulta banco, sua aplicação cai; se ele chama um serviço pago, você paga a conta.",
      "O teto vive no servidor, contado por quem chama, e devolve 429 quando estoura. O contador precisa ser compartilhado entre instâncias — guardar em memória não funciona quando o servidor tem mais de uma cópia rodando.",
    ],
    armadilha:
      "Proteger só o login e esquecer o resto. O endpoint mais caro costuma ser o que faz mais trabalho, não o de entrar.",
    aplicaSe: (_r, m) => m.endpoints.some((e) => e.limiteUso.temLimite),
  },
  {
    id: "cors",
    nome: "CORS",
    resumo: "A regra do navegador sobre quem pode chamar sua API de outro endereço.",
    explicacao: [
      "Por padrão, uma página em um domínio não consegue chamar uma API em outro. O CORS é como o servidor autoriza esse cruzamento, listando de quais origens ele aceita chamadas.",
      "É uma proteção do navegador, e só dele: um script fora do navegador chama sua API independentemente do CORS. Por isso CORS não substitui autenticação.",
    ],
    armadilha:
      "Liberar `*` para resolver o erro. Funciona e abre sua API para qualquer site — e com credenciais, o navegador nem permite essa combinação.",
  },
  {
    id: "logs",
    nome: "Logs",
    resumo: "O registro do que aconteceu, para investigar depois.",
    explicacao: [
      "Quando algo quebra em produção você não tem a tela da pessoa nem o momento exato. Tem só o que foi registrado. Registre o que permite reconstruir: qual endpoint, quem chamou, quanto demorou, qual foi o resultado.",
      "E nunca registre senha, token, número de cartão ou dado pessoal. Log costuma ir para serviço de terceiro, ficar guardado por meses e ser lido por muita gente.",
    ],
    armadilha:
      "Registrar o corpo inteiro da requisição 'para facilitar'. É assim que senha vai parar no arquivo de log.",
  },
];

/** Os conceitos que valem para este projeto, na ordem canônica. */
export function conceitosDoProjeto(r: Respostas, m: MapaApi): Conceito[] {
  return CONCEITOS.filter((c) => !c.aplicaSe || c.aplicaSe(r, m));
}

/** Os que ficaram de fora, com o motivo — a ausência vira decisão, não esquecimento. */
export function conceitosForaComMotivo(
  r: Respostas,
  m: MapaApi,
): { conceito: Conceito; porque: string }[] {
  const motivos: Record<string, string> = {
    jwt: "nenhum endpoint deste projeto usa token",
    sessoes: "nenhum endpoint deste projeto usa sessão por cookie",
    autorizacao: "este projeto não tem contas de usuário",
    oauth: "este projeto tem um único tipo de usuário, e login próprio basta",
    apikeys: "nenhum endpoint é chamado por outro sistema",
    webhooks: "este projeto não recebe avisos de sistemas externos",
    ratelimit: "nenhum endpoint deste projeto precisa de teto de chamadas",
  };

  return CONCEITOS.filter((c) => c.aplicaSe && !c.aplicaSe(r, m)).map((conceito) => ({
    conceito,
    porque: motivos[conceito.id] ?? "não se aplica a este projeto",
  }));
}
