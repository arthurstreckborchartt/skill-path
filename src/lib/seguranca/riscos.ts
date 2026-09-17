import type { ModeloDeDados } from "@/lib/banco/contrato";
import type { MapaApi } from "@/lib/api/contrato";
import type { Blueprint } from "@/lib/blueprint/contrato";
import type { Respostas } from "@/lib/blueprint/respostas";

/**
 * O catálogo de riscos de segurança — e a análise estática sobre os artefatos do projeto.
 *
 * ## Por que o catálogo é código e não geração
 *
 * SQL injection é SQL injection em todo lugar. Pedir à IA que "analise a segurança deste projeto"
 * devolve uma lista plausível que muda a cada execução: numa vez ela vê a senha sem hash, na
 * outra não. Para um relatório que a pessoa vai usar para decidir se pode lançar, "às vezes" é
 * pior que nada — dá a sensação de segurança sem a segurança.
 *
 * ## O que este módulo tem que os outros não tinham
 *
 * O modelo de dados e o mapa de APIs já estão no banco. Isso permite **detectar** risco em vez de
 * só listá-lo: se existe uma coluna chamada `senha` sem hash, eu sei — olhando o modelo, não
 * perguntando. `detectar` devolve a evidência concreta; sem evidência, o risco continua na lista
 * como algo a conferir à mão, e a tela deixa clara a diferença.
 *
 * ## O que este módulo se recusa a fazer
 *
 * Não entrega trecho de código pronto para colar. Segurança copiada sem entendimento é o modo
 * mais comum de criar uma vulnerabilidade nova achando que fechou a antiga — a pessoa cola um
 * middleware de CORS de um blog, libera `*`, e acha que resolveu. Aqui `comoPrevenir` explica o
 * que fazer e por quê, e `comoValidar` diz como conferir que funcionou.
 */

export type ContextoSeguranca = {
  respostas: Respostas;
  blueprint: Blueprint;
  modelo: ModeloDeDados | null;
  api: MapaApi | null;
};

export type Categoria = "identidade" | "dados" | "entrada" | "infra" | "operacao";

export const ROTULO_CATEGORIA: Record<Categoria, string> = {
  identidade: "Quem entra e o que pode fazer",
  dados: "Proteção dos dados",
  entrada: "O que chega de fora",
  infra: "Infraestrutura e segredos",
  operacao: "Operação do dia a dia",
};

export type Gravidade = "critico" | "alto" | "medio";

export type Risco = {
  id: string;
  titulo: string;
  categoria: Categoria;
  gravidade: Gravidade;
  /** RISCO — o que pode acontecer, em termos concretos. */
  oQuePodeAcontecer: string;
  /** POR QUE IMPORTA — a explicação para quem nunca pensou nisso. */
  porqueImporta: string;
  /** COMO PREVENIR — o que fazer. Sem código para colar; com o motivo de cada passo. */
  comoPrevenir: string[];
  /** COMO VALIDAR — como a pessoa confere que está protegida. */
  comoValidar: string[];
  /** Quando este risco existe neste projeto. `undefined` = sempre. */
  aplicaSe?: (c: ContextoSeguranca) => boolean;
  /**
   * Evidência encontrada nos artefatos do projeto.
   *
   * Lista vazia não significa seguro — significa que a análise estática não viu nada. A tela
   * precisa dizer isso, porque "nenhum achado" lido como "está tudo bem" é exatamente a falsa
   * sensação de segurança que este módulo existe para evitar.
   */
  detectar?: (c: ContextoSeguranca) => string[];
};

function semAcento(t: string): string {
  let s = "";
  for (const ch of t.toLowerCase().normalize("NFD")) {
    const n = ch.codePointAt(0) ?? 0;
    if (n >= 0x300 && n <= 0x36f) continue;
    s += ch;
  }
  return s;
}

/** Todas as colunas do modelo, achatadas, para as detecções não repetirem o laço. */
function colunas(c: ContextoSeguranca) {
  return (c.modelo?.entidades ?? []).flatMap((e) =>
    e.colunas.map((col) => ({ tabela: e.nome, ...col })),
  );
}

export const RISCOS: Risco[] = [
  // ------------------------------------------------------------------------------------------
  // Identidade
  // ------------------------------------------------------------------------------------------
  {
    id: "senha-em-texto",
    titulo: "Senha guardada sem hash",
    categoria: "identidade",
    gravidade: "critico",
    oQuePodeAcontecer:
      "Se o banco vazar, todas as senhas ficam legíveis. E como a maioria das pessoas repete senha, o vazamento passa a valer também para o e-mail e o banco delas.",
    porqueImporta:
      "Você não precisa saber a senha de ninguém para o login funcionar. O servidor só precisa confirmar que a senha digitada gera o mesmo resultado que ele guardou — e esse resultado não volta a ser senha.",
    comoPrevenir: [
      "Guarde só o hash, gerado por bcrypt ou argon2. Esses algoritmos são lentos de propósito: isso é o que impede testar milhões de senhas por segundo.",
      "Nunca use MD5 nem SHA-256 puro para senha. Eles foram feitos para ser rápidos, e velocidade é exatamente o que o atacante quer.",
      "Nomeie a coluna `senha_hash`, e não `senha`. O nome lembra a próxima pessoa que mexer ali.",
    ],
    comoValidar: [
      "Abra a tabela de usuários no banco e olhe a coluna da senha. Se você consegue ler a senha, está errado.",
      "Um hash de bcrypt começa com `$2a$`, `$2b$` ou `$2y$` e tem 60 caracteres. Qualquer coisa curta ou legível não é hash.",
    ],
    aplicaSe: (c) => c.respostas.temAutenticacao,
    detectar: (c) =>
      colunas(c)
        .filter((col) => {
          const n = semAcento(col.nome);
          return (n.includes("senha") || n.includes("password")) && !n.includes("hash");
        })
        .map((col) => `${col.tabela}.${col.nome} parece guardar a senha, não o hash dela.`),
  },
  {
    id: "autorizacao-ausente",
    titulo: "Autenticado, mas sem checagem de dono",
    categoria: "identidade",
    gravidade: "critico",
    oQuePodeAcontecer:
      "Alguém logado troca o id na URL e vê o dado de outra pessoa. É a falha mais comum em sistema feito por uma pessoa só, e a mais fácil de explorar: basta trocar um número.",
    porqueImporta:
      "Conferir que existe um token válido responde 'quem é você'. Não responde 'você pode mexer NESTE registro'. São duas perguntas, e quase todo mundo só faz a primeira.",
    comoPrevenir: [
      "Em toda rota que recebe um id, confirme que o registro pertence a quem chamou. O dono sai sempre da identidade autenticada, nunca de um campo do corpo da requisição.",
      "Quando o banco permitir, coloque essa regra no próprio banco (no PostgreSQL, Row Level Security). Assim ela vale mesmo se você esquecer numa rota.",
      "Devolver 404 em vez de 403 quando o registro é de outro: 403 confirma que aquele id existe, e isso já é informação.",
    ],
    comoValidar: [
      "Crie duas contas. Com o token da conta A, chame uma rota usando um id que pertence à conta B. Se voltar o dado, a falha existe.",
      "Repita para CADA rota que recebe id. Uma só desprotegida já basta.",
    ],
    aplicaSe: (c) => c.respostas.temAutenticacao,
    detectar: (c) =>
      (c.api?.endpoints ?? [])
        .filter(
          (e) =>
            e.autenticacao !== "nenhuma" &&
            e.parametrosRota.length > 0 &&
            e.autorizacao.trim().length < 10,
        )
        .map((e) => `${e.metodo} ${e.caminho} recebe id e não diz quem pode chamá-lo.`),
  },
  {
    id: "rbac",
    titulo: "Papéis sem verificação no servidor",
    categoria: "identidade",
    gravidade: "alto",
    oQuePodeAcontecer:
      "Um usuário comum chama a rota de administrador direto e ela funciona, porque a única coisa que escondia o botão era a tela.",
    porqueImporta:
      "Esconder o botão no frontend é design, não segurança. Quem quiser abre o devtools, vê o endereço da rota e chama sem passar pela sua tela.",
    comoPrevenir: [
      "Guarde o papel no servidor, ligado ao usuário no banco — nunca num campo que o cliente envia.",
      "Verifique o papel dentro da rota, não só antes de mostrar o botão.",
      "Prefira listar o que cada papel PODE fazer a listar o que ele não pode: a lista de permissões cresce sozinha quando você adiciona uma rota nova e esquece de bloqueá-la.",
    ],
    comoValidar: [
      "Entre com uma conta comum, pegue o endereço de uma rota de administrador e chame direto. Tem que voltar 403.",
      "Confira que o papel não vem do corpo da requisição em lugar nenhum do código.",
    ],
    aplicaSe: (c) => c.respostas.temAutenticacao && c.respostas.tiposDeUsuario === "varios",
  },
  {
    id: "brute-force",
    titulo: "Login sem teto de tentativas",
    categoria: "identidade",
    gravidade: "alto",
    oQuePodeAcontecer:
      "Um script testa milhares de senhas por minuto contra a sua rota de login até acertar uma. Com listas de senhas vazadas, isso funciona mais do que parece.",
    porqueImporta:
      "Senha forte protege contra adivinhação humana. Contra um programa que tenta sem parar, o que protege é o limite de tentativas.",
    comoPrevenir: [
      "Limite tentativas por conta E por origem. Só por conta, um atacante testa uma senha comum contra milhares de contas; só por origem, ele troca de IP.",
      "Aumente a espera a cada erro seguido, em vez de bloquear de vez — bloqueio permanente vira ataque contra o dono da conta.",
      "Responda a mesma coisa para e-mail inexistente e senha errada. Mensagens diferentes contam quais e-mails estão cadastrados.",
    ],
    comoValidar: [
      "Chame a rota de login em laço com senha errada. Depois de poucas tentativas tem que voltar 429.",
      "Tente com um e-mail que não existe e com um que existe: a resposta e o tempo de resposta devem ser iguais.",
    ],
    aplicaSe: (c) => c.respostas.temAutenticacao,
    detectar: (c) =>
      (c.api?.endpoints ?? [])
        .filter(
          (e) =>
            /login|sessao|sessoes|auth|entrar|token/i.test(e.caminho) &&
            e.metodo === "POST" &&
            !e.limiteUso.temLimite,
        )
        .map((e) => `${e.metodo} ${e.caminho} é rota de entrada e não tem limite de tentativas.`),
  },
  {
    id: "tokens",
    titulo: "Token sem prazo ou guardado errado",
    categoria: "identidade",
    gravidade: "alto",
    oQuePodeAcontecer:
      "Um token vazado continua valendo para sempre, e não há como cancelá-lo. Quem o tiver entra como a pessoa, mesmo depois de ela trocar a senha.",
    porqueImporta:
      "Diferente da sessão, o token não é consultado no servidor a cada uso — ele se autovalida. Isso o torna rápido e impossível de revogar antes de expirar.",
    comoPrevenir: [
      "Prazo curto no token de acesso, com um token de renovação separado e revogável.",
      "Nunca coloque senha nem dado sensível dentro do token: o conteúdo é assinado, não cifrado, e qualquer um lê.",
      "No navegador, cookie `HttpOnly` protege melhor que `localStorage`, que qualquer script injetado consegue ler.",
    ],
    comoValidar: [
      "Cole seu token em jwt.io e veja o conteúdo. Se tiver algo que você não mostraria na tela, está errado.",
      "Confira o campo de expiração. Se não existir, o token é eterno.",
    ],
    aplicaSe: (c) =>
      c.respostas.temAutenticacao &&
      (c.api?.endpoints ?? []).some((e) => e.autenticacao === "token"),
  },
  {
    id: "sessoes",
    titulo: "Cookie de sessão sem proteção",
    categoria: "identidade",
    gravidade: "alto",
    oQuePodeAcontecer:
      "Um script injetado na sua página lê o cookie e assume a conta de quem estiver usando.",
    porqueImporta:
      "O cookie é a identidade da pessoa. Sem as marcações certas, ele fica acessível a qualquer JavaScript da página e viaja em conexão não cifrada.",
    comoPrevenir: [
      "`HttpOnly` impede o JavaScript de ler o cookie. `Secure` impede que ele trafegue fora de HTTPS. `SameSite` reduz o risco de CSRF.",
      "Encerre a sessão no servidor no logout, não só apague o cookie no navegador.",
      "Gere um identificador novo depois do login, para o valor que existia antes não continuar valendo.",
    ],
    comoValidar: [
      "Abra o devtools, aba Application, e olhe o cookie. As três marcações precisam estar lá.",
      "No console, rode `document.cookie`. O cookie de sessão não pode aparecer.",
    ],
    aplicaSe: (c) => (c.api?.endpoints ?? []).some((e) => e.autenticacao === "sessao"),
  },

  // ------------------------------------------------------------------------------------------
  // Dados
  // ------------------------------------------------------------------------------------------
  {
    id: "exposicao-dados",
    titulo: "Dado sensível saindo na resposta",
    categoria: "dados",
    gravidade: "critico",
    oQuePodeAcontecer:
      "A API devolve o objeto inteiro do banco, incluindo campos que ninguém pediu — hash de senha, CPF, telefone. A tela não mostra, mas o dado saiu.",
    porqueImporta:
      "Qualquer pessoa vê a resposta crua no devtools. O que a tela escolhe não desenhar continua tendo saído do seu servidor.",
    comoPrevenir: [
      "Monte a resposta com os campos que aquela tela precisa, em vez de devolver a linha do banco.",
      "Trate `select *` como sinal de alerta em qualquer consulta que alimenta uma resposta.",
      "Marque os campos sensíveis no modelo de dados e confira essa lista contra cada resposta.",
    ],
    comoValidar: [
      "Abra o devtools na aba Network, use o app normalmente e leia o JSON de cada resposta.",
      "Procure por hash, documento, telefone e endereço. Se aparecer sem a tela precisar, é vazamento.",
    ],
    detectar: (c) => {
      const achados: string[] = [];
      for (const e of c.api?.endpoints ?? []) {
        for (const campo of e.respostaSucesso.corpo) {
          const n = semAcento(campo.nome);
          if (n.includes("senha") || n.includes("password") || n.includes("hash")) {
            achados.push(`${e.metodo} ${e.caminho} devolve \`${campo.nome}\` na resposta.`);
          } else if (campo.sensivel) {
            achados.push(
              `${e.metodo} ${e.caminho} devolve \`${campo.nome}\`, marcado como sensível.`,
            );
          }
        }
      }
      return achados;
    },
  },
  {
    id: "sql-injection",
    titulo: "SQL injection",
    categoria: "entrada",
    gravidade: "critico",
    oQuePodeAcontecer:
      "Alguém digita um trecho de SQL num campo do seu formulário e o banco executa. Dá para ler qualquer tabela, apagar dados, ou criar um usuário administrador.",
    porqueImporta:
      "Acontece quando você monta a consulta juntando texto: se o valor digitado vira parte do comando, quem digita passa a escrever o comando junto com você.",
    comoPrevenir: [
      "Use sempre consulta parametrizada — o valor vai por um canal separado do comando, e o banco nunca o interpreta como instrução.",
      "ORM resolve o caso comum, mas não o `raw` que você escrever à mão. É justamente ali que a falha costuma entrar.",
      "Nome de tabela e de coluna não podem vir do usuário. Se precisar, compare contra uma lista fixa que você escreveu.",
    ],
    comoValidar: [
      "Num campo de texto qualquer, digite `' OR '1'='1` e envie. Se a busca devolver tudo, a falha existe.",
      "Procure no código por concatenação de string dentro de consulta. Todo lugar onde houver `+` ou template montando SQL merece uma olhada.",
    ],
  },
  {
    id: "xss",
    titulo: "XSS — script injetado na sua página",
    categoria: "entrada",
    gravidade: "alto",
    oQuePodeAcontecer:
      "Alguém salva um trecho de script num campo de texto. Quando outra pessoa abre a tela que mostra aquele texto, o script roda no navegador dela — e pode roubar a sessão.",
    porqueImporta:
      "O navegador não distingue o texto que você escreveu do texto que outra pessoa gravou. Se o conteúdo vira HTML, o que estiver dentro dele vira código.",
    comoPrevenir: [
      "Frameworks modernos escapam por padrão. O risco mora nas exceções: `dangerouslySetInnerHTML`, `v-html`, `innerHTML` direto.",
      "Se precisar aceitar formatação, use uma biblioteca de sanitização com lista do que é permitido — não uma lista do que é proibido.",
      "Cookie `HttpOnly` limita o estrago: o script roda, mas não lê a sessão.",
    ],
    comoValidar: [
      "Salve `<img src=x onerror=alert(1)>` num campo de texto e abra a tela que o exibe. Se aparecer o alerta, a falha existe.",
      "Procure no código por toda escrita direta de HTML e confirme que o conteúdo ali nunca vem do usuário.",
    ],
  },
  {
    id: "csrf",
    titulo: "CSRF — ação disparada de outro site",
    categoria: "entrada",
    gravidade: "alto",
    oQuePodeAcontecer:
      "A pessoa está logada no seu sistema e abre outro site. Aquele site dispara uma requisição para o seu, e o navegador manda o cookie junto — a ação acontece sem ela saber.",
    porqueImporta:
      "O navegador envia o cookie automaticamente em qualquer requisição para o seu domínio, inclusive nas que começaram em outro lugar.",
    comoPrevenir: [
      "`SameSite=Lax` ou `Strict` no cookie resolve a maior parte dos casos, e é a medida mais barata.",
      "Para ações que mudam dados, exija um token de CSRF que o outro site não tem como adivinhar.",
      "Quem usa token no cabeçalho em vez de cookie não tem esse problema: o outro site não consegue montar o cabeçalho.",
    ],
    comoValidar: [
      "Monte uma página HTML simples, fora do seu domínio, com um formulário que envia para uma rota sua que altera dados. Estando logado, abra e envie. Não pode funcionar.",
    ],
    aplicaSe: (c) => (c.api?.endpoints ?? []).some((e) => e.autenticacao === "sessao"),
  },
  {
    id: "ssrf",
    titulo: "SSRF — seu servidor chamando o que mandarem",
    categoria: "entrada",
    gravidade: "alto",
    oQuePodeAcontecer:
      "Sua aplicação busca uma URL que o usuário informou. Ele informa um endereço interno da sua própria infraestrutura, e o servidor busca — devolvendo o que só ele enxergava.",
    porqueImporta:
      "O seu servidor está dentro da rede. Um pedido feito por ele alcança coisas que ninguém de fora alcança, inclusive o serviço de metadados do provedor de nuvem, onde ficam credenciais.",
    comoPrevenir: [
      "Não aceite URL do usuário. Se for inevitável, compare o domínio contra uma lista fixa de permitidos.",
      "Bloqueie endereços de rede interna e de loopback, inclusive depois de seguir redirecionamento — é por aí que o bloqueio ingênuo é burlado.",
      "Se o serviço só precisa buscar de um lugar, deixe o endereço fixo no código e receba do usuário só o identificador.",
    ],
    comoValidar: [
      "Num campo que aceita URL, informe `http://localhost` e um endereço de rede interna. Nenhum dos dois pode ser buscado.",
    ],
    aplicaSe: (c) => c.respostas.temIntegracoes || c.respostas.temUploads,
  },
  {
    id: "upload",
    titulo: "Upload de arquivo sem limites",
    categoria: "entrada",
    gravidade: "alto",
    oQuePodeAcontecer:
      "Alguém envia um arquivo enorme e enche seu disco, ou envia um arquivo executável que acaba sendo servido de volta como página.",
    porqueImporta:
      "Arquivo enviado é entrada de usuário como qualquer outra — só que maior, e guardada. A extensão no nome não diz nada sobre o conteúdo.",
    comoPrevenir: [
      "Limite tamanho antes de ler o arquivo inteiro na memória.",
      "Confira o tipo pelo conteúdo, não pela extensão. Renomeie o arquivo ao salvar, em vez de confiar no nome que veio.",
      "Guarde fora da pasta que o servidor publica, e sirva por uma rota que confere permissão.",
    ],
    comoValidar: [
      "Tente enviar um arquivo muito maior que o limite. Tem que ser recusado sem derrubar o servidor.",
      "Renomeie um arquivo `.html` para `.png` e envie. Depois tente abrir a URL dele: não pode ser servido como HTML.",
    ],
    aplicaSe: (c) => c.respostas.temUploads,
  },
  {
    id: "validacao",
    titulo: "Entrada aceita sem validação no servidor",
    categoria: "entrada",
    gravidade: "alto",
    oQuePodeAcontecer:
      "Um campo a mais no corpo da requisição escreve algo que não deveria — como `admin: true` — porque o servidor repassou tudo para o banco.",
    porqueImporta:
      "A validação da tela existe para a pessoa não errar. A do servidor existe porque a tela não é o único jeito de chamar sua API.",
    comoPrevenir: [
      "Declare o que cada rota aceita e rejeite o que não estiver na lista, em vez de ignorar em silêncio.",
      "Valide antes de tocar no banco: tipo, tamanho e formato.",
      "Nunca repasse o corpo inteiro para uma operação de escrita.",
    ],
    comoValidar: [
      "Envie um campo extra que não existe no contrato. Tem que voltar erro, não 200.",
      "Envie um texto muito longo num campo curto. Tem que voltar erro, não 500.",
    ],
    detectar: (c) =>
      (c.api?.endpoints ?? [])
        .filter(
          (e) =>
            e.corpoRequisicao.length > 0 &&
            e.corpoRequisicao.every((campo) => campo.validacao.trim().length === 0),
        )
        .map(
          (e) => `${e.metodo} ${e.caminho} recebe corpo e nenhum campo declara regra de validação.`,
        ),
  },

  // ------------------------------------------------------------------------------------------
  // Infraestrutura
  // ------------------------------------------------------------------------------------------
  {
    id: "secrets",
    titulo: "Segredo no código ou no repositório",
    categoria: "infra",
    gravidade: "critico",
    oQuePodeAcontecer:
      "Uma chave de API vai junto com o código para o repositório. Bots varrem o GitHub procurando exatamente isso, e a chave é usada em minutos.",
    porqueImporta:
      "Git guarda histórico. Apagar a chave num commit novo não a remove — ela continua acessível no commit anterior, para sempre.",
    comoPrevenir: [
      "Segredo vive em variável de ambiente, configurada no painel do serviço. Nunca em arquivo versionado.",
      "`.env` no `.gitignore` antes do primeiro commit. Um `.env.example` com os nomes das variáveis e nenhum valor ajuda quem chegar depois.",
      "Se um segredo já foi commitado, trocar a chave é obrigatório. Reescrever o histórico sozinho não basta: ela já pode ter sido copiada.",
    ],
    comoValidar: [
      "Rode `git log -p` e procure por algo parecido com chave. Procure também no histórico, não só no estado atual.",
      "Confira se `.env` está no `.gitignore` e se ele não aparece em `git ls-files`.",
    ],
  },
  {
    id: "env-frontend",
    titulo: "Segredo exposto no frontend",
    categoria: "infra",
    gravidade: "critico",
    oQuePodeAcontecer:
      "Uma chave que deveria ser só do servidor é incluída no pacote que vai para o navegador. Qualquer pessoa abre o devtools e copia.",
    porqueImporta:
      "Tudo que chega ao navegador é público. Variáveis com prefixo público (`VITE_`, `NEXT_PUBLIC_`) são embutidas no código e viajam junto — não existe 'escondido' ali.",
    comoPrevenir: [
      "Só marque como pública a variável que pode ser lida por qualquer um: URL da API, chave anônima feita para ser pública.",
      "Chave de serviço, chave de IA e segredo de pagamento nunca podem ter prefixo público.",
      "Quando o navegador precisar de algo que exige chave secreta, faça a chamada passar pelo seu servidor.",
    ],
    comoValidar: [
      "Abra o app publicado, veja o código-fonte carregado e procure pelo começo das suas chaves.",
      "Liste as variáveis com prefixo público e confirme, uma a uma, que você publicaria cada valor numa rede social.",
    ],
  },
  {
    id: "cors",
    titulo: "CORS liberado para qualquer origem",
    categoria: "infra",
    gravidade: "medio",
    oQuePodeAcontecer:
      "Qualquer site consegue chamar sua API a partir do navegador de quem estiver logado.",
    porqueImporta:
      "CORS é o que o navegador usa para decidir se uma página de outro domínio pode ler a resposta da sua API. Liberar tudo remove essa checagem.",
    comoPrevenir: [
      "Liste as origens permitidas explicitamente. Em desenvolvimento, o endereço local; em produção, o seu domínio.",
      "Não use `*` junto com credenciais — o navegador nem aceita essa combinação, e tentar contornar é sinal de que a configuração está errada.",
      "Lembre que CORS não substitui autenticação: quem chama de fora do navegador ignora essa regra.",
    ],
    comoValidar: [
      "Abra o console em qualquer outro site e chame sua API. A resposta tem que ser bloqueada.",
      "Confira o cabeçalho `Access-Control-Allow-Origin` na resposta: não pode ser `*` numa API autenticada.",
    ],
  },
  {
    id: "https",
    titulo: "Tráfego sem HTTPS",
    categoria: "infra",
    gravidade: "alto",
    oQuePodeAcontecer:
      "Numa rede pública, qualquer um entre a pessoa e o seu servidor lê o que trafega — inclusive senha e token.",
    porqueImporta:
      "Sem cifragem, os dados viajam legíveis por cada equipamento no caminho. Wi-Fi de café é o caso clássico.",
    comoPrevenir: [
      "HTTPS em tudo, sem exceção para desenvolvimento em rede.",
      "Redirecione HTTP para HTTPS e use HSTS para o navegador nem tentar a versão insegura na próxima vez.",
      "Quase todo serviço de hospedagem moderno entrega certificado automático — se o seu não entrega, é motivo para trocar.",
    ],
    comoValidar: [
      "Acesse o endereço com `http://` e confirme que ele redireciona.",
      "Procure por conteúdo misto: uma página HTTPS que carrega algo por HTTP quebra a proteção.",
    ],
  },
  {
    id: "dependencias",
    titulo: "Dependência com falha conhecida",
    categoria: "infra",
    gravidade: "alto",
    oQuePodeAcontecer:
      "Uma biblioteca que você instalou tem uma falha pública. Quem procura por sistemas com aquela versão acha o seu, e o ataque já vem pronto.",
    porqueImporta:
      "A maior parte do código que roda no seu projeto não foi escrita por você. A falha pode estar a três níveis de profundidade numa dependência que você nem sabe que instalou.",
    comoPrevenir: [
      "Rode a auditoria do seu gerenciador de pacotes (`npm audit`, `bun audit`) e resolva o que for de gravidade alta.",
      "Mantenha o arquivo de lock versionado, para todo mundo instalar exatamente as mesmas versões.",
      "Atualize em passos pequenos e frequentes. Ficar dois anos sem atualizar transforma a atualização num projeto próprio.",
    ],
    comoValidar: [
      "Rode a auditoria e confira que não há nada de gravidade alta ou crítica em aberto.",
      "Ligue o alerta automático de segurança do seu repositório.",
    ],
  },
  {
    id: "backup",
    titulo: "Sem backup testado",
    categoria: "operacao",
    gravidade: "alto",
    oQuePodeAcontecer:
      "Um comando errado apaga dados em produção e não há de onde voltar. Ou existe backup, mas ele nunca foi restaurado e não funciona.",
    porqueImporta:
      "Backup que nunca foi restaurado é hipótese, não backup. A hora de descobrir que ele está corrompido não pode ser a hora em que você precisa dele.",
    comoPrevenir: [
      "Backup automático diário, guardado em lugar diferente do banco.",
      "Restaure num ambiente separado pelo menos uma vez e confirme que os dados voltaram inteiros.",
      "Saiba quanto tempo a restauração leva. Isso muda o que você promete a quem usa.",
    ],
    comoValidar: [
      "Faça uma restauração de verdade num banco vazio e confira a contagem de linhas das tabelas principais.",
      "Confirme a data do backup mais recente. Se for de semanas atrás, ele não está rodando.",
    ],
  },

  // ------------------------------------------------------------------------------------------
  // Operação
  // ------------------------------------------------------------------------------------------
  {
    id: "logs-sensiveis",
    titulo: "Dado sensível registrado em log",
    categoria: "operacao",
    gravidade: "alto",
    oQuePodeAcontecer:
      "Senha, token ou CPF vai parar no arquivo de log. Log costuma ir para um serviço de terceiro, ficar guardado por meses e ser lido por várias pessoas.",
    porqueImporta:
      "Log é o lugar menos protegido onde dado sensível pode acabar, e o mais fácil de esquecer que existe.",
    comoPrevenir: [
      "Registre identificador e resultado, não o corpo inteiro da requisição.",
      "Mantenha uma lista de campos que nunca entram em log e aplique-a num lugar só, no meio do caminho.",
      "Log de erro costuma incluir o objeto que causou o erro — é por aí que a senha entra.",
    ],
    comoValidar: [
      "Faça um login e leia o log gerado. Procure pela senha que você digitou.",
      "Force um erro numa rota que recebe dado pessoal e leia o que foi registrado.",
    ],
    detectar: (c) => {
      const achados: string[] = [];
      for (const e of c.api?.endpoints ?? []) {
        for (const linha of e.logs) {
          const n = semAcento(linha);
          if (/\bsenha\b|\bpassword\b|\btoken\b|\bcpf\b|cartao/.test(n)) {
            achados.push(`${e.metodo} ${e.caminho} registra em log: "${linha}"`);
          }
        }
      }
      return achados;
    },
  },
  {
    id: "erros-vazam",
    titulo: "Mensagem de erro revelando o sistema por dentro",
    categoria: "operacao",
    gravidade: "medio",
    oQuePodeAcontecer:
      "O erro do banco chega inteiro na tela, com nome de tabela, coluna e trecho de SQL. Quem está sondando seu sistema recebe o mapa de graça.",
    porqueImporta:
      "Cada detalhe interno que vaza encurta o caminho de quem procura uma falha. E não ajuda quem está usando: ninguém sabe o que fazer com 'duplicate key violates constraint'.",
    comoPrevenir: [
      "Duas mensagens para cada erro: uma para a pessoa ler, curta e sem jargão, e um identificador que você usa para achar o detalhe no log.",
      "Em produção, nunca devolva o rastro de pilha.",
      "Trate o erro genérico como último recurso — se todo erro vira 'algo deu errado', ninguém consegue se ajudar.",
    ],
    comoValidar: [
      "Force um erro de banco (duplicar um valor único, por exemplo) e leia a resposta da API.",
      "Se aparecer nome de tabela, de coluna ou caminho de arquivo, está vazando.",
    ],
  },
  {
    id: "rate-limit-geral",
    titulo: "API sem teto de chamadas",
    categoria: "operacao",
    gravidade: "alto",
    oQuePodeAcontecer:
      "Uma pessoa, ou um script, chama sua rota mais pesada em laço. A aplicação fica lenta para todo mundo, e se a rota usa serviço pago, você paga a conta.",
    porqueImporta:
      "Sem teto, o custo de atacar é o de rodar um laço, e o custo de ser atacado é seu.",
    comoPrevenir: [
      "Proteja primeiro as rotas caras: as que fazem muito trabalho ou chamam serviço pago. A de login é a mais lembrada e raramente a mais cara.",
      "O contador precisa ser compartilhado entre instâncias e incrementado de forma atômica — ler e depois gravar deixa cem chamadas simultâneas passarem juntas.",
      "Responda 429 com `Retry-After`, para quem chama saber quando voltar.",
    ],
    comoValidar: [
      "Chame a rota mais pesada em laço. Tem que voltar 429 antes de a aplicação ficar lenta.",
      "Confira que o limite vale com mais de uma instância rodando, se for o seu caso.",
    ],
    detectar: (c) => {
      const endpoints = c.api?.endpoints ?? [];
      if (endpoints.length === 0) return [];
      return endpoints.some((e) => e.limiteUso.temLimite)
        ? []
        : ["Nenhum endpoint do seu mapa de API declara limite de chamadas."];
    },
  },
  {
    id: "webhooks",
    titulo: "Webhook sem verificação de assinatura",
    categoria: "entrada",
    gravidade: "critico",
    oQuePodeAcontecer:
      "Qualquer pessoa na internet chama seu endereço de webhook dizendo 'pagamento aprovado'. Se você acreditar, entregou o produto de graça.",
    porqueImporta:
      "O endereço do webhook é público por natureza — precisa ser, para o serviço externo alcançá-lo. A única coisa que separa o aviso verdadeiro do falso é a assinatura.",
    comoPrevenir: [
      "Confira a assinatura sobre o corpo CRU da requisição, antes de qualquer parse. Alterar o corpo antes de conferir invalida a checagem.",
      "Compare a assinatura em tempo constante, para não vazar informação pelo tempo de resposta.",
      "Recuse eventos antigos e aguente receber o mesmo aviso duas vezes sem processar duas vezes — webhooks repetem e chegam fora de ordem.",
    ],
    comoValidar: [
      "Chame seu webhook com `curl`, sem assinatura, mandando um evento de sucesso. Tem que ser recusado.",
      "Mande o mesmo evento válido duas vezes e confirme que o efeito aconteceu uma vez só.",
    ],
    aplicaSe: (c) => c.respostas.temPagamentos || c.respostas.temIntegracoes,
    detectar: (c) =>
      (c.api?.endpoints ?? [])
        .filter(
          (e) =>
            /webhook|callback/i.test(e.caminho) &&
            !e.seguranca.some((s) => /assinatura|signature|hmac/i.test(s)),
        )
        .map((e) => `${e.metodo} ${e.caminho} é webhook e não menciona verificação de assinatura.`),
  },
  {
    id: "pagamentos",
    titulo: "Valor de cobrança vindo do cliente",
    categoria: "dados",
    gravidade: "critico",
    oQuePodeAcontecer:
      "O preço vai para o servidor no corpo da requisição. Alguém troca 199 por 1 antes de enviar e compra pelo valor que quiser.",
    porqueImporta:
      "Tudo que sai do navegador pode ser alterado antes de chegar. O único valor confiável é o que o servidor busca por conta própria.",
    comoPrevenir: [
      "O servidor busca o preço no banco a partir do id do produto. O cliente manda o que quer comprar, nunca quanto custa.",
      "Confirme o pagamento pelo webhook do provedor, não pelo retorno da tela — a pessoa pode fechar o navegador antes.",
      "Guarde o identificador da transação e recuse processar o mesmo duas vezes.",
    ],
    comoValidar: [
      "Intercepte a requisição de compra, altere o valor e envie. O servidor tem que cobrar o preço certo.",
      "Confira se existe alguma rota que aceita valor no corpo. Se existir, ela é o problema.",
    ],
    aplicaSe: (c) => c.respostas.temPagamentos,
    detectar: (c) =>
      (c.api?.endpoints ?? [])
        .filter((e) =>
          e.corpoRequisicao.some((campo) =>
            /valor|preco|price|amount|total/i.test(semAcento(campo.nome)),
          ),
        )
        .map(
          (e) =>
            `${e.metodo} ${e.caminho} recebe valor no corpo da requisição — confirme que o servidor não confia nele.`,
        ),
  },
  {
    id: "lgpd",
    titulo: "Dado pessoal sem regra de retenção",
    categoria: "dados",
    gravidade: "alto",
    oQuePodeAcontecer:
      "Você guarda dado pessoal para sempre, sem saber por quê. Quando alguém pedir exclusão pela LGPD, não há processo — e o dado guardado à toa é o que mais dói num vazamento.",
    porqueImporta:
      "A LGPD exige base legal para guardar dado pessoal, e dá à pessoa o direito de pedir remoção. Dado que você não guarda é dado que não vaza.",
    comoPrevenir: [
      "Liste que dado pessoal você guarda, por que, e por quanto tempo. A lista costuma revelar campos que ninguém usa.",
      "Tenha um caminho de exclusão: o que apagar, o que anonimizar, e o que a lei obriga a manter (nota fiscal, por exemplo).",
      "Não colete o que não usa. Cada campo a mais no cadastro é responsabilidade a mais.",
    ],
    comoValidar: [
      "Percorra as colunas marcadas como sensíveis e responda, para cada uma, por que ela existe.",
      "Simule um pedido de exclusão do começo ao fim e veja se sobra dado identificável.",
    ],
    aplicaSe: (c) =>
      c.respostas.temDadosSensiveis ||
      (c.modelo?.entidades ?? []).some((e) => e.colunas.some((col) => col.sensivel)),
  },
  {
    id: "permissoes-banco",
    titulo: "Aplicação conectando ao banco como administrador",
    categoria: "infra",
    gravidade: "alto",
    oQuePodeAcontecer:
      "Uma falha em qualquer rota vira acesso total ao banco, porque a conexão tem permissão para tudo — inclusive apagar tabelas.",
    porqueImporta:
      "A permissão da conexão é o teto do estrago. Se a aplicação só precisa ler e escrever em cinco tabelas, é isso que ela deve poder fazer.",
    comoPrevenir: [
      "Crie um usuário de banco só para a aplicação, com permissão nas tabelas que ela usa e nada além.",
      "Revogue antes de conceder: em vários bancos o padrão já vem permissivo, e conceder por cima não tira o que já estava lá.",
      "Guarde a credencial de administrador separada, para migrações — não na variável que a aplicação usa.",
    ],
    comoValidar: [
      "Conecte com a credencial da aplicação e tente apagar uma tabela. Tem que ser recusado.",
      "Liste as permissões desse usuário e confirme que não há nada além do necessário.",
    ],
  },
];

export type Achado = {
  risco: Risco;
  /** Evidência encontrada nos artefatos. Vazio = risco aplicável, sem evidência automática. */
  evidencias: string[];
};

export type Analise = {
  /** Riscos com evidência concreta nos artefatos do projeto. Ordenados por gravidade. */
  confirmados: Achado[];
  /** Riscos que se aplicam, mas que a análise estática não consegue confirmar sozinha. */
  paraConferir: Achado[];
  /** Os que não se aplicam a este projeto, com o motivo. */
  foraDoProjeto: { risco: Risco; porque: string }[];
};

const MOTIVOS_FORA: Record<string, string> = {
  "senha-em-texto": "este projeto não tem contas de usuário",
  "autorizacao-ausente": "este projeto não tem contas de usuário",
  rbac: "este projeto tem um único tipo de usuário",
  "brute-force": "este projeto não tem login",
  tokens: "nenhum endpoint deste projeto usa token",
  sessoes: "nenhum endpoint deste projeto usa sessão por cookie",
  csrf: "nenhum endpoint deste projeto usa sessão por cookie",
  ssrf: "este projeto não busca endereços externos nem recebe arquivos",
  upload: "este projeto não recebe arquivos",
  webhooks: "este projeto não recebe avisos de sistemas externos",
  pagamentos: "este projeto não cobra dinheiro",
  lgpd: "este projeto não guarda dado pessoal declarado",
};

const PESO: Record<Gravidade, number> = { critico: 0, alto: 1, medio: 2 };

export function analisar(c: ContextoSeguranca): Analise {
  const confirmados: Achado[] = [];
  const paraConferir: Achado[] = [];
  const foraDoProjeto: { risco: Risco; porque: string }[] = [];

  for (const risco of RISCOS) {
    if (risco.aplicaSe && !risco.aplicaSe(c)) {
      foraDoProjeto.push({
        risco,
        porque: MOTIVOS_FORA[risco.id] ?? "não se aplica a este projeto",
      });
      continue;
    }

    const evidencias = risco.detectar?.(c) ?? [];
    if (evidencias.length > 0) confirmados.push({ risco, evidencias });
    else paraConferir.push({ risco, evidencias: [] });
  }

  const ordenar = (a: Achado, b: Achado) => PESO[a.risco.gravidade] - PESO[b.risco.gravidade];
  return {
    confirmados: confirmados.sort(ordenar),
    paraConferir: paraConferir.sort(ordenar),
    foraDoProjeto,
  };
}

/**
 * O que a análise estática consegue enxergar, dito em voz alta.
 *
 * Existe porque "nenhum problema encontrado" é a mensagem mais perigosa que um relatório de
 * segurança pode dar. A pessoa precisa saber que a checagem leu o plano dela, não o código.
 */
export function limitesDaAnalise(c: ContextoSeguranca): string[] {
  const limites = [
    "Esta análise lê o seu plano — modelo de dados, mapa de APIs e respostas do questionário. Ela não lê o seu código.",
    "Um risco sem achado automático não é um risco ausente: é um que só a conferência à mão resolve. Por isso todos eles aparecem na lista.",
  ];
  if (!c.modelo) {
    limites.push(
      "Você ainda não projetou o banco. Sem ele, as checagens de senha, dado sensível e permissão não têm o que analisar.",
    );
  }
  if (!c.api) {
    limites.push(
      "Você ainda não projetou a API. Sem ela, as checagens de autorização, limite de chamadas, webhook e log não têm o que analisar.",
    );
  }
  return limites;
}
