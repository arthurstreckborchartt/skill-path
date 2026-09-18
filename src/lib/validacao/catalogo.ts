import type { ContextoValidacao, Verificacao } from "./contrato";

/**
 * O catálogo de verificações, por domínio.
 *
 * ## A regra para escrever uma verificação aqui
 *
 * `verificar` só existe quando a resposta está nos artefatos do plano. Se a resposta está no
 * código da pessoa, a verificação fica sem `verificar` e aceita confirmação — e isso é honesto.
 * Uma `verificar` que devolve `passou` sem evidência concreta é pior que nenhuma: ela declara
 * verificado o que ninguém conferiu.
 *
 * `bloqueiaEtapa` é raro de propósito. Só para o que quebra o produto ou vaza dado. Se metade da
 * lista bloqueia, a pessoa aprende a contornar o bloqueio em vez de corrigir o problema.
 */

const semAcento = (t: string): string => {
  let s = "";
  for (const ch of t.toLowerCase().normalize("NFD")) {
    const n = ch.codePointAt(0) ?? 0;
    if (n >= 0x300 && n <= 0x36f) continue;
    s += ch;
  }
  return s;
};

/** Todas as colunas do modelo, achatadas, para as verificações não repetirem o laço. */
const colunas = (c: ContextoValidacao) =>
  (c.modelo?.entidades ?? []).flatMap((e) => e.colunas.map((col) => ({ tabela: e.nome, ...col })));

const temModelo = (c: ContextoValidacao) => (c.modelo?.entidades.length ?? 0) > 0;
const temApi = (c: ContextoValidacao) => (c.api?.endpoints.length ?? 0) > 0;

export const CATALOGO: Verificacao[] = [
  // -------------------------------------------------------------------------------------------
  // Arquitetura
  // -------------------------------------------------------------------------------------------
  {
    id: "arq-descrita",
    dominio: "arquitetura",
    titulo: "A arquitetura está escrita, não só na sua cabeça",
    porque:
      "Arquitetura que só existe na cabeça de quem construiu é a primeira coisa que se perde — inclusive para você mesmo, daqui a três meses.",
    comoValidar: "Leia o bloco Técnico do plano. Ele descreve como as partes conversam?",
    verificar: (c) => {
      const a = c.blueprint.tecnico?.arquitetura ?? "";
      return a.length >= 50
        ? { estado: "passou", evidencia: `A arquitetura está descrita em ${a.length} caracteres.` }
        : { estado: "atencao", evidencia: "O bloco Técnico não descreve a arquitetura." };
    },
  },
  {
    id: "arq-sem-excesso",
    dominio: "arquitetura",
    titulo: "A arquitetura não tem peça que o MVP não precisa",
    porque:
      "Microserviço, fila e cache antes de ter usuário são três sistemas para manter e nenhum problema resolvido. Complexidade se acrescenta quando dói, não por precaução.",
    comoValidar:
      "Para cada peça da arquitetura, pergunte: que problema REAL de hoje ela resolve? Se a resposta for 'escala futura', tire.",
    verificar: (c) => {
      const texto = semAcento(c.blueprint.tecnico?.arquitetura ?? "");
      const caras = [
        "microservi",
        "kubernetes",
        "kafka",
        "redis",
        "event sourcing",
        "service mesh",
      ];
      const achadas = caras.filter((x) => texto.includes(x));
      return achadas.length === 0
        ? { estado: "passou", evidencia: "Nenhuma peça de escala prematura na arquitetura." }
        : {
            estado: "atencao",
            evidencia: `A arquitetura cita ${achadas.join(", ")}. Confirme que resolve um problema de hoje.`,
          };
    },
  },

  // -------------------------------------------------------------------------------------------
  // Banco
  // -------------------------------------------------------------------------------------------
  {
    id: "banco-chave-primaria",
    dominio: "banco",
    titulo: "Toda tabela tem chave primária",
    porque:
      "Tabela sem chave primária não tem como referenciar uma linha específica. Atualizar ou apagar vira adivinhação, e duplicata entra sem ninguém ver.",
    comoValidar: "Abra o schema e confira se cada CREATE TABLE declara PRIMARY KEY.",
    aplicaSe: temModelo,
    bloqueiaEtapa: true,
    verificar: (c) => {
      const sem = (c.modelo?.entidades ?? []).filter((e) => e.chavePrimaria.length === 0);
      return sem.length === 0
        ? {
            estado: "passou",
            evidencia: `As ${c.modelo?.entidades.length} tabelas do modelo declaram chave primária.`,
          }
        : {
            estado: "bloqueio",
            evidencia: `Sem chave primária: ${sem.map((e) => e.nome).join(", ")}.`,
          };
    },
  },
  {
    id: "banco-senha-com-hash",
    dominio: "banco",
    titulo: "Nenhuma coluna guarda senha em texto",
    porque:
      "Se o banco vazar, senha legível vira acesso à conta de e-mail, ao banco e a tudo mais onde a pessoa repetiu a senha. O estrago sai do seu produto.",
    comoValidar:
      "Abra a tabela de usuários e olhe a coluna de senha. Se você consegue ler a senha, está errado.",
    aplicaSe: temModelo,
    bloqueiaEtapa: true,
    verificar: (c) => {
      const suspeitas = colunas(c).filter((col) => {
        const n = semAcento(col.nome);
        const ehSenha = n.includes("senha") || n.includes("password") || n === "pwd";
        const pareceHash = n.includes("hash") || n.includes("digest") || n.includes("encrypted");
        return ehSenha && !pareceHash;
      });
      return suspeitas.length === 0
        ? { estado: "passou", evidencia: "Nenhuma coluna de senha sem indicação de hash." }
        : {
            estado: "bloqueio",
            evidencia: `Coluna de senha sem hash no nome: ${suspeitas.map((s) => `${s.tabela}.${s.nome}`).join(", ")}.`,
          };
    },
  },
  {
    id: "banco-sensivel-marcado",
    dominio: "banco",
    titulo: "Os dados pessoais estão marcados como sensíveis",
    porque:
      "A LGPD não pergunta se você sabia. Marcar no modelo é o que permite decidir o que criptografar, o que não registrar em log e o que apagar quando a pessoa pedir.",
    comoValidar:
      "Percorra as colunas e pergunte de cada uma: isto identifica uma pessoa? CPF, telefone, endereço e e-mail identificam.",
    aplicaSe: (c) => temModelo(c) && c.respostas.temDadosSensiveis,
    verificar: (c) => {
      const marcadas = colunas(c).filter((col) => col.sensivel);
      return marcadas.length > 0
        ? {
            estado: "passou",
            evidencia: `${marcadas.length} colunas marcadas como sensíveis: ${marcadas
              .slice(0, 4)
              .map((m) => `${m.tabela}.${m.nome}`)
              .join(", ")}.`,
          }
        : {
            estado: "atencao",
            evidencia:
              "Você marcou que o projeto guarda dado sensível, mas nenhuma coluna está marcada como tal.",
          };
    },
  },
  {
    id: "banco-existe-de-verdade",
    dominio: "banco",
    titulo: "As tabelas do plano existem no banco",
    porque:
      "Tabela planejada e tabela existente são coisas diferentes. Código escrito contra uma tabela que ninguém criou quebra em produção, não no editor.",
    comoValidar:
      "Rode o SQL gerado no seu banco e sonde: uma consulta simples responde, ou dá 'relation does not exist'?",
    aplicaSe: temModelo,
    fonte: "sonda",
    verificar: (c) => {
      if (c.tabelasNoBanco.length === 0) {
        return { estado: "atencao", evidencia: "Ninguém sondou o banco ainda." };
      }

      const faltam = c.tabelasNoBanco.filter((t) => t.existeNoBanco === false);
      /**
       * Indeterminada não entra em `faltam` — e também não pode entrar no silêncio.
       *
       * Sem esta linha, uma sonda que voltou inconclusiva em TODAS as tabelas (wifi fora, sessão
       * expirada) daria `faltam.length === 0` e o relatório anunciaria "as 5 tabelas respondem no
       * banco". A regra do projeto é que inconclusivo não é ausência; o inverso também vale, e é
       * pior: inconclusivo virando presença é o app afirmando que conferiu o que não conferiu.
       */
      const indeterminadas = c.tabelasNoBanco.filter((t) => t.existeNoBanco === null);

      if (faltam.length > 0) {
        return {
          estado: "atencao",
          evidencia: `Ainda não existem: ${faltam.map((t) => t.nome).join(", ")}.`,
        };
      }

      if (indeterminadas.length > 0) {
        return {
          estado: "atencao",
          evidencia: `A sonda não conseguiu determinar ${indeterminadas.length} de ${c.tabelasNoBanco.length} tabelas (${indeterminadas.map((t) => t.nome).join(", ")}). Não dá para afirmar que existem nem que faltam — sonde de novo.`,
        };
      }

      return {
        estado: "passou",
        evidencia: `As ${c.tabelasNoBanco.length} tabelas sondadas respondem no banco.`,
      };
    },
  },

  // -------------------------------------------------------------------------------------------
  // API
  // -------------------------------------------------------------------------------------------
  {
    id: "api-autorizacao-declarada",
    dominio: "api",
    titulo: "Todo endpoint autenticado diz QUEM pode chamá-lo",
    porque:
      "Autenticado não é autorizado. Sem checagem de dono, qualquer pessoa logada lê o dado de qualquer outra trocando um id na URL — é a falha mais comum de API caseira.",
    comoValidar:
      "Crie duas contas. Com o token da primeira, peça um recurso da segunda. Tem que dar 403.",
    aplicaSe: temApi,
    bloqueiaEtapa: true,
    verificar: (c) => {
      const sem = (c.api?.endpoints ?? []).filter(
        (e) => e.autenticacao !== "nenhuma" && e.autorizacao.trim().length < 10,
      );
      return sem.length === 0
        ? { estado: "passou", evidencia: "Todo endpoint autenticado declara a regra de acesso." }
        : {
            estado: "bloqueio",
            evidencia: `Sem regra de autorização: ${sem.map((e) => `${e.metodo} ${e.caminho}`).join(", ")}.`,
          };
    },
  },
  {
    id: "api-erros-documentados",
    dominio: "api",
    titulo: "Cada endpoint documenta os erros que ele devolve",
    porque:
      "A tela precisa saber o que fazer quando dá errado. Endpoint que só documenta o caminho feliz produz tela que trava no primeiro erro real.",
    comoValidar: "Para cada rota, force o erro: sem token, com id inexistente, com campo faltando.",
    aplicaSe: temApi,
    verificar: (c) => {
      const sem = (c.api?.endpoints ?? []).filter((e) => e.erros.length === 0);
      return sem.length === 0
        ? { estado: "passou", evidencia: "Todos os endpoints documentam ao menos um erro." }
        : {
            estado: "atencao",
            evidencia: `Sem erro documentado: ${sem.map((e) => e.caminho).join(", ")}.`,
          };
    },
  },
  {
    id: "api-limite-onde-importa",
    dominio: "api",
    titulo: "As rotas caras ou de login têm limite de uso",
    porque:
      "Rota de login sem limite aceita força bruta. Rota que chama serviço pago sem limite é a sua conta na mão de quem quiser.",
    comoValidar: "Chame a rota em laço e veja se em algum momento ela recusa.",
    aplicaSe: temApi,
    verificar: (c) => {
      const sensiveis = (c.api?.endpoints ?? []).filter((e) => {
        const t = semAcento(`${e.caminho} ${e.finalidade}`);
        return (
          t.includes("login") || t.includes("senha") || t.includes("ia") || t.includes("email")
        );
      });
      if (sensiveis.length === 0) {
        return { estado: "passou", evidencia: "Nenhuma rota de login ou de serviço pago no mapa." };
      }
      const sem = sensiveis.filter((e) => !e.limiteUso.temLimite);
      return sem.length === 0
        ? { estado: "passou", evidencia: `${sensiveis.length} rotas sensíveis, todas com limite.` }
        : {
            estado: "atencao",
            evidencia: `Sem limite: ${sem.map((e) => e.caminho).join(", ")}.`,
          };
    },
  },

  // -------------------------------------------------------------------------------------------
  // Autenticação
  // -------------------------------------------------------------------------------------------
  {
    id: "auth-metodo-definido",
    dominio: "autenticacao",
    titulo: "O método de autenticação está decidido",
    porque:
      "Sem método definido, cada tela resolve login do seu jeito — e o projeto termina com dois sistemas de sessão que discordam.",
    comoValidar: "Leia o bloco Técnico: ele diz qual método, ou está em branco?",
    aplicaSe: (c) => c.respostas.temAutenticacao,
    verificar: (c) => {
      const m = c.blueprint.tecnico?.autenticacao?.metodo ?? "";
      return m.trim().length > 2
        ? { estado: "passou", evidencia: `Método definido: ${m}.` }
        : { estado: "bloqueio", evidencia: "O plano não define o método de autenticação." };
    },
    bloqueiaEtapa: true,
  },
  {
    id: "auth-protecao-de-rotas",
    dominio: "autenticacao",
    titulo: "Está escrito como as rotas privadas são protegidas",
    porque:
      "Esconder o botão não protege nada: a rota continua respondendo para quem souber o endereço. A proteção é no servidor.",
    comoValidar:
      "Deslogue e chame uma rota privada direto pelo endereço. Tem que devolver 401, não a página.",
    aplicaSe: (c) => c.respostas.temAutenticacao,
    verificar: (c) => {
      const p = c.blueprint.tecnico?.autenticacao?.protecaoDeRotas ?? "";
      return p.trim().length >= 20
        ? { estado: "passou", evidencia: "O plano descreve a proteção de rotas." }
        : {
            estado: "atencao",
            evidencia: "O plano não descreve como as rotas privadas são protegidas.",
          };
    },
  },
  {
    id: "auth-papeis",
    dominio: "autenticacao",
    titulo: "Os papéis e o que cada um pode fazer estão definidos",
    porque:
      "Com mais de um tipo de usuário, 'quem pode o quê' precisa estar escrito antes do código — senão vira uma sequência de `if` espalhados que ninguém consegue auditar.",
    comoValidar:
      "Liste os papéis e, para cada um, o que ele NÃO pode fazer. Teste um caso de cada.",
    aplicaSe: (c) => c.respostas.tiposDeUsuario === "varios",
    verificar: (c) => {
      const papeis = c.blueprint.tecnico?.autenticacao?.papeis ?? [];
      return papeis.length > 1
        ? {
            estado: "passou",
            evidencia: `${papeis.length} papéis definidos: ${papeis.map((p) => p.nome).join(", ")}.`,
          }
        : {
            estado: "atencao",
            evidencia:
              "Você marcou vários tipos de usuário, mas o plano não define mais de um papel.",
          };
    },
  },
  {
    id: "auth-reset-de-senha",
    dominio: "autenticacao",
    titulo: "Existe recuperação de senha, e ela expira",
    porque:
      "Sem recuperação, cada senha esquecida é um usuário perdido. Com link que não expira, um e-mail antigo vazado vira acesso permanente à conta.",
    comoValidar:
      "Peça a recuperação, espere o link expirar e tente usar. Tem que recusar. Confira também se o link só serve uma vez.",
    aplicaSe: (c) => c.respostas.temAutenticacao,
  },
  {
    id: "auth-email-validado",
    dominio: "autenticacao",
    titulo: "O e-mail é validado no cadastro",
    porque:
      "Sem validação, alguém cadastra com o e-mail de outra pessoa. E quando a recuperação de senha for para aquele endereço, a conta é de quem tem o e-mail.",
    comoValidar: "Cadastre com um e-mail que você não controla e veja se a conta já nasce ativa.",
    aplicaSe: (c) => c.respostas.temAutenticacao,
  },
  {
    id: "auth-testada",
    dominio: "autenticacao",
    titulo: "Os caminhos de autenticação foram testados de ponta a ponta",
    porque:
      "Login costuma funcionar no caminho feliz e falhar nos outros: senha errada, conta inexistente, token expirado, dois dispositivos.",
    comoValidar:
      "Teste: senha errada, e-mail inexistente, token expirado, logout em um aparelho com sessão em outro.",
    aplicaSe: (c) => c.respostas.temAutenticacao,
  },

  // -------------------------------------------------------------------------------------------
  // Segurança — delegada ao módulo dedicado
  // -------------------------------------------------------------------------------------------
  {
    id: "seg-analise-rodada",
    dominio: "seguranca",
    titulo: "A análise de segurança do projeto foi feita e lida",
    porque:
      "O catálogo de riscos lê o seu plano e aponta o lugar exato: senha sem hash, valor de cobrança vindo do cliente, rota sem checagem de dono. É mais barato ler agora que descobrir depois.",
    comoValidar: "Abra a aba Segurança do projeto e leia os achados com evidência.",
  },
  {
    id: "seg-valor-nao-vem-do-cliente",
    dominio: "seguranca",
    titulo: "Nenhum endpoint aceita valor de cobrança vindo do cliente",
    porque:
      "Tudo que sai do navegador pode ser alterado antes de chegar. Se o preço vem no corpo, alguém troca 199 por 1 e compra pelo valor que quiser.",
    comoValidar:
      "Intercepte a requisição de compra, altere o valor e envie. O servidor tem que cobrar o preço certo.",
    aplicaSe: (c) => temApi(c) && c.respostas.temPagamentos,
    bloqueiaEtapa: true,
    verificar: (c) => {
      const suspeitos = (c.api?.endpoints ?? []).filter((e) =>
        e.corpoRequisicao.some((campo) =>
          /valor|preco|price|amount|total/i.test(semAcento(campo.nome)),
        ),
      );
      return suspeitos.length === 0
        ? { estado: "passou", evidencia: "Nenhum endpoint recebe valor monetário no corpo." }
        : {
            estado: "bloqueio",
            evidencia: `Recebem valor no corpo: ${suspeitos.map((e) => `${e.metodo} ${e.caminho}`).join(", ")}.`,
          };
    },
  },
  {
    id: "seg-logs-sem-dado-sensivel",
    dominio: "seguranca",
    titulo: "Nenhum log registra senha, token ou dado pessoal",
    porque:
      "Log costuma ir para serviço de terceiro e ficar meses guardado. Um token no log é um token vazado, mesmo que ninguém tenha invadido nada.",
    comoValidar: "Leia o que cada endpoint registra. Procure por senha, token, cartão e documento.",
    aplicaSe: temApi,
    verificar: (c) => {
      const ruins = (c.api?.endpoints ?? []).filter((e) =>
        e.logs.some((l) => /senha|password|token|cartao|cpf|secret/i.test(semAcento(l))),
      );
      return ruins.length === 0
        ? { estado: "passou", evidencia: "Nenhum log declarado menciona dado sensível." }
        : {
            estado: "bloqueio",
            evidencia: `Log com dado sensível: ${ruins.map((e) => e.caminho).join(", ")}.`,
          };
    },
  },

  // -------------------------------------------------------------------------------------------
  // Frontend
  // -------------------------------------------------------------------------------------------
  {
    id: "front-tres-estados",
    dominio: "frontend",
    titulo: "Toda tela que busca dado trata carregando, vazio e erro",
    porque:
      "Tela que só desenha o caminho feliz mostra espaço em branco quando a lista está vazia e quebra quando a rede cai. O primeiro uso real encontra os dois.",
    comoValidar:
      "Desligue a internet e abra cada tela. Depois apague os dados e abra de novo. As duas precisam dizer o que está acontecendo.",
  },
  {
    id: "front-sem-regra-de-negocio",
    dominio: "frontend",
    titulo: "Nenhuma regra de negócio vive só no frontend",
    porque:
      "Qualquer pessoa abre o devtools e chama a API direto, sem passar pela sua tela. Validação que só existe no navegador não existe.",
    comoValidar:
      "Escolha uma regra (valor mínimo, campo obrigatório) e chame a API direto sem respeitá-la. O servidor tem que recusar.",
  },

  // -------------------------------------------------------------------------------------------
  // UX
  // -------------------------------------------------------------------------------------------
  {
    id: "ux-erro-em-portugues",
    dominio: "ux",
    titulo: "As mensagens de erro dizem o que fazer, sem jargão",
    porque:
      "'Erro 500' não ajuda ninguém a continuar. A pessoa precisa saber se a culpa foi dela, se adianta tentar de novo, e o que fazer agora.",
    comoValidar:
      "Force cada erro e leia a mensagem como se fosse a primeira vez que você usa o app.",
  },
  {
    id: "ux-caminho-principal-curto",
    dominio: "ux",
    titulo: "O caminho principal do produto foi percorrido inteiro",
    porque:
      "Funcionalidade testada isolada esconde o buraco entre elas. O que a pessoa faz é a sequência, não a peça.",
    comoValidar:
      "Crie uma conta nova e vá do cadastro até o valor principal do produto, sem atalho. Conte quantos passos foram.",
  },

  // -------------------------------------------------------------------------------------------
  // IA
  // -------------------------------------------------------------------------------------------
  {
    id: "ia-precisa-mesmo",
    dominio: "ia",
    titulo: "A necessidade de IA foi analisada antes de implementar",
    porque:
      "A maior parte do que se chama de IA é consulta ordenada ou regra. Descobrir isso antes economiza uma fatura mensal e um sistema para manter.",
    comoValidar: "Abra a aba Arquitetura de IA e leia o veredito e o que foi descartado.",
    aplicaSe: (c) => c.respostas.temIa,
    verificar: (c) =>
      c.planoIa
        ? {
            estado: "passou",
            evidencia: c.planoIa.precisaDeIa
              ? `A análise aprovou ${c.planoIa.funcionalidades.length} funcionalidades e descartou ${c.planoIa.descartadas.length}.`
              : "A análise concluiu que este projeto não precisa de IA.",
          }
        : { estado: "atencao", evidencia: "A arquitetura de IA ainda não foi analisada." },
  },
  {
    id: "ia-tem-fallback",
    dominio: "ia",
    titulo: "Cada funcionalidade de IA tem um caminho para quando a IA falhar",
    porque:
      "Todo provedor sai do ar. Sem fallback, a tela quebra junto — e costuma quebrar no momento em que a pessoa mais precisa dela.",
    comoValidar: "Desligue a chave da IA e use o app. O que acontece na tela?",
    aplicaSe: (c) => c.planoIa?.precisaDeIa === true,
    verificar: (c) => {
      const sem = (c.planoIa?.funcionalidades ?? []).filter(
        (f) => f.nivel !== "sem-ia" && f.fallback.trim().length < 10,
      );
      return sem.length === 0
        ? { estado: "passou", evidencia: "Todas as funcionalidades de IA declaram fallback." }
        : {
            estado: "atencao",
            evidencia: `Sem fallback: ${sem.map((f) => f.nome).join(", ")}.`,
          };
    },
  },
  {
    id: "ia-custo-estimado",
    dominio: "ia",
    titulo: "O custo mensal de IA foi estimado",
    porque:
      "Custo de IA não aparece no desenvolvimento, aparece na fatura. Estimar antes é o que permite decidir se o preço do produto fecha.",
    comoValidar: "Abra a aba Arquitetura de IA e leia o custo por mês e as premissas.",
    aplicaSe: (c) => c.planoIa?.precisaDeIa === true,
  },

  // -------------------------------------------------------------------------------------------
  // Pagamentos
  // -------------------------------------------------------------------------------------------
  {
    id: "pag-webhook-confirma",
    dominio: "pagamentos",
    titulo: "A confirmação do pagamento vem do webhook, não da tela",
    porque:
      "A pessoa pode fechar o navegador depois de pagar. Se a liberação depende do retorno da tela, ela paga e não recebe — e você descobre pelo suporte.",
    comoValidar:
      "Pague e feche a aba antes do redirecionamento. O acesso tem que liberar mesmo assim.",
    aplicaSe: (c) => c.respostas.temPagamentos,
    bloqueiaEtapa: true,
  },
  {
    id: "pag-evento-repetido",
    dominio: "pagamentos",
    titulo: "O mesmo evento de pagamento não é processado duas vezes",
    porque:
      "Provedores reenviam webhook quando não recebem confirmação. Sem controle, o mesmo pagamento credita duas vezes — ou cobra duas vezes.",
    comoValidar:
      "Reenvie o mesmo evento pelo painel do provedor e confira que nada muda na segunda vez.",
    aplicaSe: (c) => c.respostas.temPagamentos,
  },
  {
    id: "pag-assinatura-verificada",
    dominio: "pagamentos",
    titulo: "A assinatura do webhook é verificada",
    porque:
      "Sem verificar a assinatura, qualquer pessoa que descubra o endereço do seu webhook pode dizer que pagou.",
    comoValidar:
      "Mande uma requisição sua para o webhook, sem assinatura válida. Tem que ser recusada.",
    aplicaSe: (c) => c.respostas.temPagamentos,
    bloqueiaEtapa: true,
  },

  // -------------------------------------------------------------------------------------------
  // Testes
  // -------------------------------------------------------------------------------------------
  {
    id: "teste-caminho-critico",
    dominio: "testes",
    titulo: "O caminho que gera dinheiro ou perde dado está testado",
    porque:
      "Testar tudo é caro e ninguém faz. Testar o que quebra o negócio quando falha é barato e quase ninguém faz — é aí que está o retorno.",
    comoValidar:
      "Liste os três caminhos onde uma falha custa mais caro. Existe teste automatizado para eles?",
    verificar: (c) => {
      const t = c.blueprint.operacao?.testes ?? [];
      return t.length > 0
        ? { estado: "passou", evidencia: `O plano recomenda ${t.length} testes.` }
        : { estado: "atencao", evidencia: "O bloco Operação não recomenda nenhum teste." };
    },
  },
  {
    id: "teste-caso-de-erro",
    dominio: "testes",
    titulo: "Os testes cobrem pelo menos um caso de erro",
    porque:
      "Teste que só exercita o caminho feliz passa enquanto o produto quebra. O erro é onde mora o comportamento que ninguém pensou.",
    comoValidar: "Abra seus testes e conte quantos verificam uma falha esperada.",
  },

  // -------------------------------------------------------------------------------------------
  // Deploy
  // -------------------------------------------------------------------------------------------
  {
    id: "deploy-segredo-fora-do-cliente",
    dominio: "deploy",
    titulo: "Nenhum segredo vai para o navegador",
    porque:
      "Variável de build com prefixo público entra no JavaScript que qualquer pessoa baixa. Chave de API ali é chave publicada.",
    comoValidar:
      "Abra o devtools, aba Sources, e procure pelo começo das suas chaves no bundle. Não pode achar nenhuma.",
    bloqueiaEtapa: true,
    verificar: (c) => {
      const vars = c.blueprint.operacao?.deploy?.variaveis ?? [];
      if (vars.length === 0) {
        return { estado: "atencao", evidencia: "O plano não lista as variáveis de ambiente." };
      }
      const publicas = vars.filter((v) => /^(VITE_|NEXT_PUBLIC_|PUBLIC_)/.test(v));
      const suspeitas = publicas.filter((v) => /secret|service_role|private|senha/i.test(v));
      return suspeitas.length === 0
        ? {
            estado: "passou",
            evidencia: `${vars.length} variáveis listadas, nenhuma secreta exposta.`,
          }
        : {
            estado: "bloqueio",
            evidencia: `Segredo em variável pública: ${suspeitas.join(", ")}.`,
          };
    },
  },
  {
    id: "deploy-como-reverter",
    dominio: "deploy",
    titulo: "Está escrito como reverter um deploy",
    porque:
      "A hora de descobrir como voltar não é quando o produto está fora do ar. Deploy sem volta é deploy que ninguém tem coragem de fazer.",
    comoValidar: "Leia o bloco Operação. Ele descreve a volta, ou só a ida?",
    verificar: (c) => {
      const passos = (c.blueprint.operacao?.deploy?.passos ?? []).join(" ").toLowerCase();
      return /revert|rollback|voltar|desfazer/.test(passos)
        ? { estado: "passou", evidencia: "O plano de deploy menciona como reverter." }
        : { estado: "atencao", evidencia: "O plano de deploy não descreve a reversão." };
    },
  },
  {
    id: "deploy-ambiente-separado",
    dominio: "deploy",
    titulo: "Existe um ambiente separado do de produção",
    porque:
      "Testar em produção é testar com os dados de quem confiou em você. Um ambiente à parte custa pouco e evita o erro que não dá para desfazer.",
    comoValidar: "Confira se existe mais de um ambiente e se eles usam bancos diferentes.",
    verificar: (c) => {
      const amb = c.blueprint.operacao?.deploy?.ambientes ?? [];
      return amb.length > 1
        ? { estado: "passou", evidencia: `Ambientes: ${amb.join(", ")}.` }
        : { estado: "atencao", evidencia: "O plano descreve um ambiente só." };
    },
  },
];
