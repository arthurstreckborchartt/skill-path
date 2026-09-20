import type { ContextoLancamento, Passo } from "./contrato";

/**
 * O catálogo do lançamento.
 *
 * ## Como ler um passo
 *
 * `verificar` existe → o app deriva do plano da pessoa e ela **não tem o que clicar**.
 * `verificar` ausente → a resposta está no código dela, na conta do provedor, ou no mundo. Aí ela
 * confirma, e a confirmação vale menos.
 *
 * A tentação aqui é tornar tudo confirmável, porque é mais fácil de escrever. O resultado seria
 * uma lista que a pessoa percorre marcando — e o que ela aprenderia é a marcar.
 *
 * ## Onde o app consegue derivar, e onde não
 *
 * O Pathly enxerga o plano (blueprint, modelo de dados, mapa de API, plano de IA) e o banco real,
 * pela sonda. Ele **não** enxerga o repositório, o painel do provedor, o DNS, nem a conta de
 * ninguém. Então "as variáveis estão declaradas" é verificável e "as variáveis estão no cofre do
 * provedor" não é — e essa fronteira está em cada passo, não escondida numa nota de rodapé.
 */

const TODOS = ["desenvolvimento", "staging", "producao"] as const;

function temAutenticacao(c: ContextoLancamento): boolean {
  return c.blueprint.tecnico?.autenticacao?.necessaria === true;
}

function temIa(c: ContextoLancamento): boolean {
  return c.planoIa?.precisaDeIa === true;
}

function entidades(c: ContextoLancamento): string[] {
  return (c.modelo?.entidades ?? []).map((e) => e.nome).filter(Boolean);
}

export const CATALOGO: Passo[] = [
  // =============================================================================================
  // PRÉ-LANÇAMENTO
  // =============================================================================================

  {
    id: "ambientes-declarados",
    trilha: "pre-lancamento",
    ambientes: TODOS,
    titulo: "Os ambientes estão declarados, e são mais de um",
    porque:
      "Quase todo desastre de lançamento cabe numa frase: alguém achou que estava num ambiente e " +
      "estava em outro. Declarar quais existem é o primeiro passo para não confundi-los.",
    ensina:
      "Um ambiente é um conjunto completo: um endereço, um banco, um conjunto de variáveis e um " +
      "jeito de subir código. Não é uma pasta nem uma branch. Dois ambientes que compartilham o " +
      "banco são um ambiente só, com dois endereços — e o primeiro teste destrutivo prova isso.\n\n" +
      "O mínimo defensável são dois: onde você desenvolve e onde as pessoas usam. O staging " +
      "entra quando quebrar em produção passa a custar caro — e ele custa dinheiro, então é " +
      "decisão, não obrigação.",
    armadilha:
      "Chamar de staging um ambiente que aponta para o banco de produção. Isso não adia o risco: " +
      "concentra todo ele no dia em que você rodar um teste que escreve.",
    porAmbiente: {
      desenvolvimento: "Na sua máquina. Pode nascer e morrer a cada `git clone`.",
      staging: "Precisa ser igual a produção em forma e separado dela em conteúdo.",
      producao: "O único que tem gente dentro. Tudo que chega aqui chega por um caminho previsto.",
    },
    comoValidar:
      "Liste os ambientes e, para cada um, responda: qual endereço, qual banco, quais variáveis. " +
      "Se duas respostas se repetirem entre ambientes diferentes, eles não são dois.",
    fonte: "automatica",
    bloqueiaLancamento: true,
    verificar: (c) => {
      const amb = c.blueprint.operacao?.deploy?.ambientes ?? [];
      if (amb.length === 0) {
        return {
          estado: "bloqueio",
          evidencia:
            "O plano não declara ambiente nenhum. Sem isso, não há como dizer onde o código roda.",
        };
      }
      if (amb.length === 1) {
        return {
          estado: "bloqueio",
          evidencia: `Só um ambiente declarado ("${amb[0]}"). Desenvolver e servir pessoas no mesmo lugar significa que todo erro seu é um erro delas.`,
        };
      }
      return {
        estado: "passou",
        evidencia: `${amb.length} ambientes declarados no plano: ${amb.join(", ")}.`,
      };
    },
    tarefa: (c) =>
      `Separar os ambientes ${(c.blueprint.operacao?.deploy?.ambientes ?? ["desenvolvimento", "produção"]).join(", ")}: arquivos de configuração por ambiente, sem nenhum valor compartilhado entre eles, e um jeito de saber em qual ambiente o código está rodando em tempo de execução.`,
  },

  {
    id: "variaveis-declaradas",
    trilha: "pre-lancamento",
    ambientes: TODOS,
    titulo: "As variáveis de ambiente estão listadas pelo nome",
    porque:
      "Variável que só existe na máquina de quem escreveu o código é uma bomba-relógio: o deploy " +
      "funciona até o dia em que outra pessoa — ou outro servidor — precisa subir o projeto.",
    ensina:
      "Variável de ambiente é como o código descobre em que mundo está rodando sem ser reescrito. " +
      "A mesma linha `lerEnv('BANCO_URL')` aponta para lugares diferentes em cada ambiente, e é " +
      "isso que permite um build só servir aos três.\n\n" +
      "A regra prática é separar **nome** de **valor**. O nome é documentação e pertence ao " +
      "repositório, num `.env.example` com as chaves e nenhum valor. O valor é segredo e pertence " +
      "ao cofre do provedor. Quem clona o projeto descobre o que precisa preencher sem descobrir " +
      "o que você preencheu.",
    armadilha:
      "Commitar o `.env` de verdade uma vez e apagar depois. O arquivo sai do topo mas continua " +
      "no histórico do git, legível para sempre por quem clonar. Apagar não é remover: se isso " +
      "acontecer, a chave está vazada e o caminho é trocá-la, não escondê-la.",
    comoValidar:
      "Abra o `.env.example` e confira que toda variável usada no código está lá, com valor vazio. " +
      "Depois clone o projeto numa pasta nova e tente subir: o que faltar, aparece.",
    fonte: "automatica",
    verificar: (c) => {
      const vars = c.blueprint.operacao?.deploy?.variaveis ?? [];
      if (vars.length === 0) {
        return {
          estado: "atencao",
          evidencia:
            "O plano não lista nenhuma variável de ambiente. Se o projeto tem banco, autenticação ou qualquer serviço externo, ele tem variáveis — elas só não foram escritas.",
        };
      }
      return {
        estado: "passou",
        evidencia: `${vars.length} variáveis declaradas no plano: ${vars.slice(0, 6).join(", ")}${vars.length > 6 ? ` e mais ${vars.length - 6}` : ""}.`,
      };
    },
    tarefa: (c) =>
      `Criar um .env.example com estas variáveis, só os nomes e valores vazios: ${(c.blueprint.operacao?.deploy?.variaveis ?? []).join(", ") || "as que o código lê"}. Garantir que .env e .env.local estão no .gitignore, e que o código falha com mensagem clara quando uma variável obrigatória falta, em vez de falhar em silêncio mais adiante.`,
  },

  {
    id: "variaveis-por-ambiente",
    trilha: "pre-lancamento",
    ambientes: ["staging", "producao"],
    titulo: "A mesma variável tem valor diferente em cada ambiente",
    porque:
      "Variável com o mesmo valor nos três ambientes significa que os três apontam para o mesmo " +
      "lugar. Aí não são três ambientes.",
    ensina:
      "O teste é simples e desconfortável: pegue cada variável e pergunte se o valor dela em " +
      "desenvolvimento é igual ao de produção. Para `BANCO_URL`, `STRIPE_KEY`, qualquer chave de " +
      "API — se for igual, o seu localhost tem poder sobre dados reais.\n\n" +
      "Algumas variáveis podem repetir legitimamente: o nome do produto, um fuso horário. A " +
      "distinção é se ela dá **acesso** a alguma coisa. Acesso nunca se compartilha entre " +
      "ambientes.",
    porAmbiente: {
      desenvolvimento: "Chaves de teste, banco local ou descartável, e-mail que não sai.",
      staging: "Chaves de teste próprias — não as mesmas do desenvolvimento, para poder revogar.",
      producao: "As chaves reais, e só aqui.",
    },
    comoValidar:
      "Liste as variáveis em duas colunas, desenvolvimento e produção. Para cada linha em que os " +
      "valores forem iguais, responda: essa variável dá acesso a algo? Se sim, é um problema.",
    bloqueiaLancamento: true,
  },

  {
    id: "dominio",
    trilha: "pre-lancamento",
    ambientes: ["staging", "producao"],
    titulo: "O domínio está registrado e no seu nome",
    porque:
      "O domínio é o único ativo do lançamento que você não consegue recriar. Código se reescreve, " +
      "servidor se troca; um domínio perdido vai para outra pessoa.",
    ensina:
      "Registre no seu nome e com o seu e-mail — não no e-mail de uma agência, de um sócio, nem " +
      "no do provedor de hospedagem. Ligue a renovação automática e confira que o cartão não " +
      "vence antes do domínio.\n\n" +
      "Staging costuma viver num subdomínio (`staging.seudominio.com`) em vez de um domínio " +
      "próprio: é mais barato e deixa óbvio que é o mesmo produto.",
    armadilha:
      "Deixar o domínio expirar por causa de um e-mail de renovação que foi para spam. É a forma " +
      "mais boba de perder um produto, e acontece todo dia.",
    comoValidar:
      "No painel do registrador: o titular é você, o contato é um e-mail que você lê, a renovação " +
      "automática está ligada, e a data de expiração está a mais de 30 dias.",
  },

  {
    id: "dns",
    trilha: "pre-lancamento",
    ambientes: ["staging", "producao"],
    titulo: "O DNS aponta para o servidor e propagou",
    porque:
      "Entre configurar o DNS e ele valer para todo mundo existe uma janela em que metade do " +
      "mundo vê o site novo e a outra metade vê erro. Saber disso evita pânico.",
    ensina:
      "DNS traduz nome em endereço. Você vai mexer em dois tipos de registro: `A` aponta um nome " +
      "para um endereço IP; `CNAME` aponta um nome para outro nome — é o que provedores modernos " +
      "pedem, porque o IP deles muda.\n\n" +
      "O `TTL` diz por quanto tempo o mundo pode guardar a resposta antiga. Antes de uma mudança " +
      "planejada, baixe o TTL para alguns minutos e espere o TTL **antigo** passar; depois mude. " +
      "Assim a janela de confusão é curta.",
    armadilha:
      "Testar só no seu navegador, que já guardou a resposta, e concluir que não funcionou. Use " +
      "`nslookup` ou `dig` apontando para um servidor público antes de mexer de novo.",
    comoValidar:
      "`nslookup seudominio.com 8.8.8.8` devolve o endereço do seu servidor. Abrir de um celular " +
      "no 4G, fora do seu wi-fi, mostra o site certo.",
  },

  {
    id: "ssl",
    trilha: "pre-lancamento",
    ambientes: ["staging", "producao"],
    titulo: "HTTPS válido, e HTTP redireciona para ele",
    porque:
      "Sem HTTPS, qualquer rede no caminho lê e altera o que trafega — inclusive senha e cookie " +
      "de sessão. E navegador marca o site como não seguro, o que encerra a conversa com quem " +
      "acabou de chegar.",
    ensina:
      "Certificado é gratuito e automático na maioria dos provedores, via Let's Encrypt. O que " +
      "costuma faltar não é o certificado: é o **redirecionamento**. Se `http://` continua " +
      "servindo o site, a proteção é opcional, e o atacante escolhe.\n\n" +
      "Depois do redirecionamento vem o `HSTS`: um cabeçalho que manda o navegador nunca mais " +
      "tentar `http://` neste domínio. Ligue com validade curta primeiro — HSTS com validade " +
      "longa e um certificado quebrado tira o site do ar para quem já visitou, e não há como " +
      "desfazer do seu lado.",
    comoValidar:
      "Abrir `http://seudominio.com` e terminar em `https://`. O cadeado aparece, e a validade do " +
      "certificado está a mais de 15 dias. Confira também `www` e a raiz — costuma faltar num dos dois.",
    bloqueiaLancamento: true,
  },

  {
    id: "deploy-repetivel",
    trilha: "pre-lancamento",
    ambientes: ["staging", "producao"],
    titulo: "Subir é um comando, não uma sequência lembrada de cabeça",
    porque:
      "Deploy que depende de memória falha exatamente quando você está com pressa — que é quando " +
      "você vai fazer deploy.",
    ensina:
      "CI/CD é isto e nada mais místico: um servidor que, a cada commit, faz o que você faria à " +
      "mão. Instala dependências, roda a checagem de tipos, roda os testes, constrói, e só então " +
      "publica. O valor não está em automatizar — está em **o mesmo processo rodar sempre**, sem " +
      "a etapa que você às vezes pula.\n\n" +
      "A ordem importa: o que pode reprovar vem antes do que publica. Um pipeline que publica e " +
      "depois testa avisa sobre o problema com ele já no ar.",
    porAmbiente: {
      desenvolvimento: "Nada precisa ser automático. Rodar à mão é o ponto.",
      staging: "Deploy automático a cada commit na branch. É o ensaio.",
      producao: "Deploy deliberado — por tag, aprovação ou botão. Automático demais aqui assusta.",
    },
    comoValidar:
      "Apague a pasta de dependências, clone o projeto numa pasta nova e siga só os passos " +
      "escritos. Se precisar de algo que não está lá, os passos estão incompletos.",
    fonte: "automatica",
    verificar: (c) => {
      const passos = c.blueprint.operacao?.deploy?.passos ?? [];
      const estrategia = c.blueprint.operacao?.deploy?.estrategia ?? "";
      if (passos.length === 0) {
        return {
          estado: "atencao",
          evidencia:
            "O plano não descreve os passos de deploy. Enquanto eles só existirem na sua cabeça, só você consegue subir o projeto — e só enquanto lembrar.",
        };
      }
      return {
        estado: "passou",
        evidencia: `${passos.length} passos de deploy descritos no plano${estrategia ? `, com estratégia "${estrategia}"` : ""}.`,
      };
    },
    tarefa: () =>
      "Criar um pipeline de CI que, a cada push, instale dependências, rode a checagem de tipos, o lint e os testes, e construa o projeto. O deploy só acontece se tudo passar. Publicar automaticamente em staging e deixar produção como passo manual.",
  },

  // =============================================================================================
  // SEGURANÇA
  // =============================================================================================

  {
    id: "segredos-fora-do-repo",
    trilha: "seguranca",
    ambientes: TODOS,
    titulo: "Nenhum segredo está no repositório, nem no histórico",
    porque:
      "Repositório é feito para ser copiado. Todo clone leva o histórico inteiro, e chave em " +
      "histórico é chave pública com atraso.",
    ensina:
      "Segredo é qualquer coisa que dá acesso: chave de API, senha de banco, token, certificado. " +
      "O lugar deles é o cofre do provedor de hospedagem, injetado como variável de ambiente na " +
      "hora de rodar.\n\n" +
      "Se um segredo já foi commitado, o único caminho é **trocá-lo**. Remover do histórico é " +
      "difícil, quebra clones alheios, e não alcança quem já copiou. Trocar é rápido e funciona.",
    armadilha:
      "Achar que repositório privado resolve. Resolve enquanto for privado, enquanto ninguém sair " +
      "da equipe, e enquanto nenhuma integração de terceiro tiver acesso de leitura.",
    comoValidar:
      "`git log -p | grep -iE 'api[_-]?key|secret|password|token'` no repositório inteiro. " +
      "Qualquer resultado com valor de verdade significa que essa chave precisa ser trocada hoje.",
    bloqueiaLancamento: true,
  },

  {
    id: "segredos-rotacionaveis",
    trilha: "seguranca",
    ambientes: ["producao"],
    titulo: "Você consegue trocar qualquer segredo em minutos",
    porque:
      "Vazamento não é hipótese remota: é uma questão de quando. O que separa um susto de um " +
      "incidente é quanto tempo leva para a chave vazada parar de valer.",
    ensina:
      "Para cada segredo, saiba de antemão: onde ele é gerado, onde é guardado, e quem quebra " +
      "quando ele muda. Chave usada em três lugares e anotada em nenhum vira um dia inteiro de " +
      "caça.\n\n" +
      "Segredo com prefixo de versão — o próprio Pathly faz isso no `cripto.ts`, com `v1.` — " +
      "permite conviver com a chave velha e a nova durante a troca, em vez de parar tudo.",
    comoValidar:
      "Escolha o segredo mais importante e cronometre: gerar novo, colocar no cofre, subir, " +
      "conferir que funciona, revogar o antigo. Se passar de dez minutos, documente os passos.",
  },

  {
    id: "chaves-de-ia-protegidas",
    trilha: "seguranca",
    ambientes: TODOS,
    titulo: "As chaves dos provedores de IA nunca chegam ao navegador",
    porque:
      "Chave de IA no frontend é a forma mais cara de vazar um segredo: quem achar usa na sua " +
      "conta, e você descobre pela fatura.",
    ensina:
      "Toda chamada a provedor de IA passa pelo seu servidor. O navegador fala com a sua API, e " +
      "a sua API fala com o provedor. Isso não é só sobre a chave — é o único ponto onde dá para " +
      "impor limite de uso por pessoa.\n\n" +
      "Em projetos com bundler, a regra é o prefixo: variável que começa com `VITE_` ou " +
      "`NEXT_PUBLIC_` **vai para dentro do código que o navegador baixa**. Chave nunca leva esse " +
      "prefixo.",
    armadilha:
      "Prefixar a chave com `VITE_` para 'resolver' um erro de variável indefinida no frontend. " +
      "O erro some e a chave vai junto com o bundle, para sempre.",
    comoValidar:
      "Construa o projeto e procure a chave dentro da pasta de build: " +
      "`grep -r 'sk-' dist/`. Qualquer resultado é vazamento.",
    aplicaSe: temIa,
    bloqueiaLancamento: true,
    tarefa: () =>
      "Mover toda chamada a provedor de IA para rotas de servidor. O navegador chama a própria API do projeto, que lê a chave de variável de ambiente sem prefixo público. Acrescentar limite de uso por usuário nessas rotas.",
  },

  {
    id: "sessao-em-producao",
    trilha: "seguranca",
    ambientes: ["producao"],
    titulo: "A sessão é segura no transporte e no armazenamento",
    porque:
      "Roubar a sessão de alguém dispensa a senha dessa pessoa. É o alvo mais fácil de um app com " +
      "login.",
    ensina:
      "Se a sessão vive em cookie, ele precisa de três atributos: `Secure` (só trafega em HTTPS), " +
      "`HttpOnly` (o JavaScript da página não lê, então um XSS não a rouba) e `SameSite` (limita " +
      "o envio a partir de outros sites).\n\n" +
      "Se vive no `localStorage`, `HttpOnly` não existe e qualquer script na página alcança — o " +
      "que torna a proteção contra XSS a sua única defesa. É uma escolha legítima, mas precisa " +
      "ser escolha, não descuido.",
    comoValidar:
      "Nas ferramentas do navegador, aba de cookies, no site em produção: os atributos aparecem " +
      "na listagem. Testar também se a sessão expira — sessão eterna é conta eterna para quem roubar.",
    aplicaSe: temAutenticacao,
  },

  {
    id: "cabecalhos-de-seguranca",
    trilha: "seguranca",
    ambientes: ["producao"],
    titulo: "Os cabeçalhos de segurança estão ligados",
    porque:
      "São algumas linhas de configuração que fecham categorias inteiras de ataque. É a melhor " +
      "relação entre esforço e proteção que existe no lançamento.",
    ensina:
      "Os que importam primeiro: `Strict-Transport-Security` obriga HTTPS; " +
      "`X-Content-Type-Options: nosniff` impede o navegador de adivinhar o tipo de um arquivo; " +
      "`Content-Security-Policy` limita de onde scripts podem vir — é o mais poderoso contra XSS " +
      "e o mais trabalhoso de acertar.\n\n" +
      "Comece pela CSP em modo relatório, que avisa sem bloquear. Ligar CSP restritiva direto em " +
      "produção costuma quebrar a própria aplicação e ser desligada às pressas.",
    comoValidar:
      "`curl -I https://seudominio.com` mostra os cabeçalhos da resposta. Confira um por um.",
  },

  // =============================================================================================
  // BANCO DE DADOS
  // =============================================================================================

  {
    id: "banco-de-producao-separado",
    trilha: "banco",
    ambientes: ["producao"],
    titulo: "O banco de produção é exclusivo de produção",
    porque:
      "É a linha que, quando cruzada, transforma um erro de desenvolvimento em perda de dado de " +
      "outra pessoa.",
    ensina:
      "Separado quer dizer: outra instância, outras credenciais, outro endereço. Não é outro " +
      "schema no mesmo servidor, nem a mesma base com prefixo diferente nas tabelas.\n\n" +
      "Vale ir além e tornar o engano difícil: credenciais de produção só no cofre do provedor, " +
      "nunca no seu `.env.local`, e nome de banco que se distinga num piscar de olhos.",
    armadilha:
      "Copiar a URL do banco de produção para o `.env.local` 'só para depurar uma coisa rápida' — " +
      "e esquecer. A partir daí todo teste que você rodar acontece nos dados reais.",
    comoValidar:
      "Abra o `.env.local` e confira que a credencial ali não funciona em produção. Se funcionar, " +
      "troque-a antes de continuar.",
    bloqueiaLancamento: true,
  },

  {
    id: "migrations-versionadas",
    trilha: "banco",
    ambientes: TODOS,
    titulo: "Mudança de schema vive no repositório, em ordem",
    porque:
      "Schema alterado à mão no painel não existe para mais ninguém. O próximo ambiente vai " +
      "divergir, e a divergência aparece como um erro que não reproduz.",
    ensina:
      "Migration é um arquivo versionado que muda o schema um passo por vez, numa ordem que o " +
      "banco registra. Rodar duas vezes não repete o efeito; rodar do zero reconstrói tudo.\n\n" +
      "A regra que evita a maior parte da dor: **migration não volta atrás sozinha.** Antes de " +
      "apagar uma coluna, faça uma migration que para de usá-la, publique, espere, e só então " +
      "apague noutra. Apagar e restaurar no mesmo passo é onde se perde dado.",
    armadilha:
      "Gerar o SQL e concluir que o banco mudou. Este projeto aprendeu isso do jeito difícil e " +
      "escreveu uma regra inteira sobre o assunto: SQL gerado não é SQL executado.",
    comoValidar:
      "Crie um banco vazio, rode todas as migrations na ordem e compare com produção. Qualquer " +
      "diferença é uma mudança que alguém fez à mão.",
    fonte: "automatica",
    aplicaSe: (c) => entidades(c).length > 0,
    verificar: (c) => {
      const n = entidades(c).length;
      return {
        estado: "atencao",
        evidencia: `O modelo tem ${n} ${n === 1 ? "entidade" : "entidades"}. O Pathly não enxerga o seu repositório, então não consigo confirmar que existem migrations versionadas para elas — isto fica como lembrete, não como aprovação.`,
      };
    },
    tarefa: (c) =>
      `Criar migrations versionadas para as entidades do modelo (${entidades(c).slice(0, 8).join(", ")}), uma por mudança, idempotentes e na ordem de dependência. Incluir no repositório e documentar como rodar em cada ambiente.`,
  },

  {
    id: "migrations-aplicadas",
    trilha: "banco",
    ambientes: TODOS,
    titulo: "O que está planejado existe mesmo no banco",
    porque:
      "É a diferença entre o plano e a realidade, e a única forma de saber é perguntar ao banco.",
    ensina:
      "A sonda pergunta ao banco real se cada tabela do modelo responde. É a evidência mais forte " +
      "que este app consegue produzir, porque não depende do que você escreveu em lugar nenhum — " +
      "depende do que o banco responde.\n\n" +
      "Código que compila não é prova: declarar a tabela nos tipos do cliente faz o projeto " +
      "compilar como se ela existisse.",
    comoValidar:
      "Abra a tela de banco do projeto e rode a sonda. Cada tabela planejada responde, ou diz por " +
      "que não.",
    fonte: "sonda",
    aplicaSe: (c) => entidades(c).length > 0,
    bloqueiaLancamento: true,
    verificar: (c) => {
      const sondadas = c.tabelasNoBanco;
      if (sondadas.length === 0) {
        return {
          estado: "atencao",
          evidencia:
            "Ninguém sondou o banco ainda. Não saber é diferente de não existir — rode a sonda antes de lançar.",
        };
      }
      const faltam = sondadas.filter((t) => t.existeNoBanco === false).map((t) => t.nome);
      const indeterminadas = sondadas.filter((t) => t.existeNoBanco === null).map((t) => t.nome);

      if (faltam.length > 0) {
        return {
          estado: "bloqueio",
          evidencia: `A sonda não encontrou no banco: ${faltam.join(", ")}. Lançar assim significa que a primeira pessoa a usar essa parte vê um erro.`,
        };
      }
      if (indeterminadas.length > 0) {
        return {
          estado: "atencao",
          evidencia: `A sonda não conseguiu determinar o estado de: ${indeterminadas.join(", ")}. Inconclusivo não é ausência, mas também não é presença.`,
        };
      }
      return {
        estado: "passou",
        evidencia: `A sonda encontrou as ${sondadas.length} tabelas planejadas respondendo no banco.`,
      };
    },
  },

  {
    id: "backup-automatico",
    trilha: "banco",
    ambientes: ["producao"],
    titulo: "Existe backup automático, e você sabe de quando é o último",
    porque:
      "A pergunta que importa num desastre não é se existe backup: é quanto tempo de trabalho das " +
      "pessoas cabe entre o último backup e agora.",
    ensina:
      "Duas medidas resolvem a conversa. **Quanto você aceita perder** define a frequência: " +
      "backup diário significa aceitar perder até um dia. **Quanto tempo você aceita ficar fora** " +
      "define o quanto o restore precisa ser rápido.\n\n" +
      "Serviços gerenciados costumam ter backup automático ligado por padrão, com retenção de " +
      "alguns dias — o que é ótimo e insuficiente para o caso em que você descobre o problema " +
      "depois da janela de retenção.",
    comoValidar:
      "No painel do provedor: backup ligado, com a data do último. Anote a retenção em dias e " +
      "pergunte-se se ela cobre o tempo que você levaria para perceber um problema silencioso.",
    bloqueiaLancamento: true,
  },

  {
    id: "restore-testado",
    trilha: "banco",
    ambientes: ["producao"],
    titulo: "Você já restaurou um backup pelo menos uma vez",
    porque:
      "Backup nunca restaurado é uma crença, não uma cópia. O dia do desastre é o pior momento " +
      "para descobrir que o arquivo está corrompido, incompleto ou inutilizável.",
    ensina:
      "Restaure num banco descartável — nunca por cima de produção. Depois confira se os dados " +
      "estão inteiros: conte linhas das tabelas principais e abra alguns registros.\n\n" +
      "Cronometre. O número que você quer saber não é 'funciona?', é 'em quanto tempo?'. Esse " +
      "número é o que você vai prometer a alguém no dia em que o site cair.",
    armadilha:
      "Testar o restore e esquecer de apagar o banco temporário — que fica lá, com dados reais, " +
      "sem ninguém cuidando dele. Um backup restaurado e esquecido é um vazamento esperando.",
    comoValidar:
      "Restaure o backup mais recente num banco novo, conte as linhas das tabelas principais, " +
      "confira que batem com produção, e apague o banco temporário.",
  },

  {
    id: "storage-de-arquivos",
    trilha: "banco",
    ambientes: ["producao"],
    titulo: "Arquivos têm lugar, limite e controle de acesso",
    porque:
      "Upload sem limite é conta sem limite, e arquivo sem controle de acesso é arquivo público — " +
      "inclusive o documento que alguém mandou achando que só você veria.",
    ensina:
      "Arquivo não vai para o banco nem para o disco do servidor: vai para um serviço de objetos " +
      "(S3, R2, Supabase Storage). O banco guarda o caminho.\n\n" +
      "Três decisões antes de aceitar o primeiro upload: **tamanho máximo** por arquivo, **tipos " +
      "aceitos** conferidos no servidor — nunca só no navegador, que é contornável — e **quem " +
      "pode ler**. Para conteúdo privado, o padrão são URLs assinadas que expiram, em vez de " +
      "endereços permanentes que vazam por encaminhamento.",
    armadilha:
      "Deixar o bucket público 'por enquanto' para a imagem aparecer. Endereço de bucket público " +
      "é descoberto por varredura, e o 'por enquanto' costuma durar até alguém avisar.",
    comoValidar:
      "Tente abrir o endereço direto de um arquivo privado numa janela anônima. Se abrir, é " +
      "público. Tente subir um arquivo grande demais e um tipo não permitido: os dois devem ser " +
      "recusados pelo servidor.",
  },

  // =============================================================================================
  // DESEMPENHO
  // =============================================================================================

  {
    id: "requisitos-mensuraveis",
    trilha: "desempenho",
    ambientes: ["staging", "producao"],
    titulo: "Os requisitos de desempenho dizem como medir",
    porque:
      "'Tem que ser rápido' não é requisito: não dá para passar nem para falhar. Requisito sem " +
      "medida é opinião.",
    ensina:
      "Um requisito útil tem número e condição: 'a busca responde em menos de 500 ms para 95% " +
      "das chamadas, com 10 mil produtos'. Dá para medir, dá para reprovar, e dá para saber " +
      "quando piorou.\n\n" +
      "Prefira **percentil** a média. A média esconde justamente as chamadas ruins, que são as " +
      "que a pessoa lembra.",
    comoValidar:
      "Para cada requisito, responda: qual número, medido como, em que condição. Se faltar um dos " +
      "três, o requisito ainda não existe.",
    fonte: "automatica",
    verificar: (c) => {
      const reqs = c.blueprint.operacao?.requisitosNaoFuncionais ?? [];
      if (reqs.length === 0) {
        return {
          estado: "atencao",
          evidencia:
            "O plano não tem requisitos não-funcionais. Sem eles, não há como dizer se o app está rápido o bastante — só se está no ar.",
        };
      }
      const semMedida = reqs.filter((r) => !r.comoMedir || r.comoMedir.trim().length < 8);
      if (semMedida.length > 0) {
        return {
          estado: "atencao",
          evidencia: `${semMedida.length} de ${reqs.length} requisitos não dizem como medir: ${semMedida
            .slice(0, 3)
            .map((r) => r.categoria)
            .join(", ")}.`,
        };
      }
      return {
        estado: "passou",
        evidencia: `${reqs.length} requisitos não-funcionais, todos com forma de medir declarada.`,
      };
    },
  },

  {
    id: "indices",
    trilha: "desempenho",
    ambientes: TODOS,
    titulo: "As consultas frequentes têm índice",
    porque:
      "É a diferença entre um app que fica mais lento conforme cresce e um que não fica. E ela " +
      "só aparece quando já há dados — ou seja, depois que há gente.",
    ensina:
      "Sem índice, o banco lê a tabela inteira para achar uma linha. Com dez registros ninguém " +
      "nota; com cem mil, trava.\n\n" +
      "A regra prática: toda coluna que aparece em `where`, em `join` ou em `order by` frequente " +
      "é candidata. Chave estrangeira quase sempre precisa — e vários bancos **não** criam esse " +
      "índice sozinhos, ao contrário do que se imagina. Índice também custa: cada um deixa a " +
      "escrita um pouco mais lenta e ocupa espaço.",
    comoValidar:
      "Rode `EXPLAIN` nas consultas mais usadas. Se aparecer varredura sequencial numa tabela que " +
      "vai crescer, falta índice.",
    fonte: "automatica",
    aplicaSe: (c) => entidades(c).length > 0,
    verificar: (c) => {
      const ents = entidades(c).length;
      const idx = c.modelo?.indices?.length ?? 0;
      if (idx === 0) {
        return {
          estado: "atencao",
          evidencia: `${ents} entidades no modelo e nenhum índice planejado além das chaves primárias. Funciona enquanto a tabela for pequena.`,
        };
      }
      return {
        estado: "passou",
        evidencia: `${idx} índices planejados para ${ents} entidades.`,
      };
    },
  },

  {
    id: "limite-de-uso",
    trilha: "desempenho",
    ambientes: ["producao"],
    titulo: "Existe teto de uso no que custa dinheiro",
    porque:
      "Endpoint caro sem limite é um cartão de crédito aberto para quem descobrir o endereço. E " +
      "descobrem.",
    ensina:
      "Limite por pessoa e por janela de tempo, aplicado no servidor. O ponto não é punir quem " +
      "usa muito: é que sem teto, um laço — próprio ou alheio — vira fatura.\n\n" +
      "Decida também o que acontece quando o contador não responde. Deixar passar transforma uma " +
      "falha de infraestrutura em conta sem teto; recusar transforma uma falha curta em produto " +
      "fora do ar. A resposta muda por endpoint, conforme o que cada chamada pode custar.",
    comoValidar:
      "Chame o endpoint mais caro em laço, com a sua própria conta, e confira que ele passa a " +
      "recusar. Confira também o que acontece com o contador fora do ar.",
    aplicaSe: (c) => temIa(c) || (c.api?.endpoints?.length ?? 0) > 0,
    tarefa: () =>
      "Aplicar limite de uso por usuário e por hora nas rotas que chamam serviços pagos. Declarar explicitamente, por rota, se a falta do contador deixa passar ou recusa, e por quê.",
  },

  {
    id: "custo-conhecido",
    trilha: "desempenho",
    ambientes: ["producao"],
    titulo: "Você sabe quanto custa manter isso no ar",
    porque:
      "Produto que custa mais do que se imaginava fecha por motivo financeiro, não técnico. E a " +
      "conta chega no fim do mês, depois do estrago.",
    ensina:
      "Some o que é fixo — hospedagem, banco, domínio — e estime o que varia com uso: chamadas " +
      "de IA, storage, banda. O segundo grupo é o que surpreende, porque cresce junto com o " +
      "sucesso.\n\n" +
      "Ligue alerta de gasto em cada serviço que cobra por uso, com valor bem abaixo do que " +
      "dói. Alerta é mais barato que limite e evita a descoberta pela fatura.",
    comoValidar:
      "Escreva o custo mensal estimado por componente e compare com a primeira fatura real. A " +
      "diferença ensina mais que a estimativa.",
    fonte: "automatica",
    verificar: (c) => {
      const infra = c.blueprint.operacao?.infraestrutura ?? [];
      if (infra.length === 0) {
        return {
          estado: "atencao",
          evidencia:
            "O plano não lista componentes de infraestrutura, então não há custo estimado.",
        };
      }
      const semCusto = infra.filter((i) => !i.custoEstimado || i.custoEstimado.trim().length < 2);
      if (semCusto.length > 0) {
        return {
          estado: "atencao",
          evidencia: `${semCusto.length} de ${infra.length} componentes sem custo estimado: ${semCusto
            .slice(0, 3)
            .map((i) => i.componente)
            .join(", ")}.`,
        };
      }
      return {
        estado: "passou",
        evidencia: `${infra.length} componentes de infraestrutura, todos com custo estimado.`,
      };
    },
  },

  // =============================================================================================
  // PRODUÇÃO — o dia seguinte
  // =============================================================================================

  {
    id: "rollback",
    trilha: "producao",
    ambientes: ["producao"],
    titulo: "Existe caminho de volta, e ele já foi percorrido",
    porque:
      "Toda publicação pode dar errado. O que separa um susto de um incidente é quanto tempo leva " +
      "para voltar ao que funcionava.",
    ensina:
      "Rollback de código é a parte fácil: a maioria dos provedores guarda as versões anteriores " +
      "e volta num clique. A parte difícil é o **banco** — se a publicação rodou uma migration " +
      "que apagou coluna, voltar o código não traz o dado de volta.\n\n" +
      "Por isso mudanças de schema se fazem em duas etapas separadas por uma publicação: " +
      "primeiro o código para de usar, depois o schema muda. Entre as duas, dá para voltar.",
    armadilha:
      "Descobrir o procedimento de rollback durante o incidente. Faça uma vez com calma, num dia " +
      "normal, e anote o tempo.",
    comoValidar:
      "Em staging: publique, volte para a versão anterior, cronometre. O número é o que você tem " +
      "a oferecer quando algo der errado.",
    fonte: "automatica",
    bloqueiaLancamento: true,
    verificar: (c) => {
      const e = (c.blueprint.operacao?.deploy?.estrategia ?? "").toLowerCase();
      if (!e) {
        return {
          estado: "atencao",
          evidencia:
            "O plano não descreve estratégia de deploy, então não diz como se volta atrás.",
        };
      }
      const mencionaVolta = /rollback|revert|volta|anterior|desfaz/.test(e);
      return mencionaVolta
        ? {
            estado: "passou",
            evidencia: `A estratégia de deploy do plano fala em voltar atrás: "${e.slice(0, 120)}".`,
          }
        : {
            estado: "atencao",
            evidencia: `A estratégia de deploy ("${e.slice(0, 90)}") não menciona como desfazer. Publicar é metade do procedimento.`,
          };
    },
    tarefa: () =>
      "Documentar e exercitar o procedimento de rollback: como voltar o código à versão anterior, o que fazer quando a publicação incluiu migration, e quanto tempo leva. Testar em staging e anotar o tempo medido.",
  },

  {
    id: "erros-chegam-em-alguem",
    trilha: "producao",
    ambientes: ["staging", "producao"],
    titulo: "Os erros chegam a algum lugar que você olha",
    porque:
      "Erro que só aparece no navegador da pessoa não existe para você. Ela desiste em silêncio, " +
      "e o problema continua.",
    ensina:
      "Um serviço de rastreamento de erros captura a exceção com pilha, versão, navegador e o " +
      "caminho até ali, agrupa as repetidas e avisa quando aparece uma nova. É a diferença entre " +
      "saber que 'às vezes dá erro' e ter a linha exata.\n\n" +
      "Configure o **ambiente** e a **versão** na inicialização. Sem isso, erro de staging e de " +
      "produção se misturam na mesma lista, e você não sabe se a correção funcionou.",
    armadilha:
      "Mandar dados pessoais junto do erro. O contexto ajuda a depurar e vira um banco de dados " +
      "pessoais em um serviço de terceiro. Filtre antes de enviar.",
    comoValidar:
      "Provoque um erro de propósito em staging e confira que ele aparece no painel, com o " +
      "ambiente certo.",
  },

  {
    id: "logs-uteis",
    trilha: "producao",
    ambientes: ["staging", "producao"],
    titulo: "Os logs respondem perguntas, e não guardam dado pessoal",
    porque:
      "Log existe para o dia em que algo inexplicável acontece. Se não dá para procurar nele, " +
      "ele não serve; se ele guarda o que não devia, virou um problema por conta própria.",
    ensina:
      "Log estruturado é log em campos, não em frase. `{evento: 'pagamento_recusado', pedido: " +
      "123, motivo: 'saldo'}` é pesquisável; 'Falha ao processar pedido 123' não é.\n\n" +
      "Inclua um identificador de requisição que acompanhe a chamada inteira — é o que permite " +
      "reconstruir a história de um erro. E nunca registre senha, token, cartão ou o corpo cru de " +
      "uma requisição que pode conter qualquer um dos três.",
    comoValidar:
      "Procure nos logs por um identificador de requisição e reconstrua o que aconteceu. Depois " +
      "procure por 'password', 'token' e 'authorization': não pode haver resultado com valor.",
  },

  {
    id: "monitoramento",
    trilha: "producao",
    ambientes: ["producao"],
    titulo: "Alguém é avisado quando o app cai",
    porque:
      "Descobrir que o site está fora pela mensagem de um usuário é tarde, e é constrangedor.",
    ensina:
      "Comece pelo mais simples que funciona: um serviço externo que chama uma rota de saúde a " +
      "cada poucos minutos e avisa quando ela para de responder. Isso cobre a maior parte das " +
      "quedas reais.\n\n" +
      "A rota de saúde deve conferir as dependências — banco responde, serviços essenciais " +
      "respondem — e não apenas devolver 200. Um `/health` que responde OK com o banco fora " +
      "mente com ar de competência.\n\n" +
      "Monitore de fora. Um monitor hospedado no mesmo servidor cai junto com ele.",
    comoValidar:
      "Derrube o serviço de propósito em staging e cronometre até o alerta chegar. Se não chegar, " +
      "o monitoramento é decorativo.",
    tarefa: () =>
      "Criar uma rota de saúde que confira banco e dependências essenciais e devolva 503 quando alguma falhar. Ligar um monitor externo que a chame periodicamente e avise por um canal que a pessoa lê.",
  },

  {
    id: "primeira-hora",
    trilha: "producao",
    ambientes: ["producao"],
    titulo: "Você sabe o que olhar na primeira hora depois de publicar",
    porque:
      "A maior parte dos problemas de uma publicação aparece nos primeiros minutos. Saber onde " +
      "olhar transforma isso numa correção rápida em vez de um dia perdido.",
    ensina:
      "Antes de publicar, decida as três coisas que você vai acompanhar: a taxa de erro, o tempo " +
      "de resposta, e um sinal de que o produto está sendo usado — alguém se cadastrou, alguém " +
      "completou a ação principal.\n\n" +
      "O terceiro é o que mais se esquece e o mais revelador. Erro zero com uso zero não é " +
      "sucesso: é ninguém conseguindo entrar.",
    comoValidar:
      "Escreva os três números e onde cada um é lido, antes de publicar. Depois da publicação, " +
      "olhe os três em intervalos curtos na primeira hora.",
  },
];

export function acharPasso(id: string): Passo | null {
  return CATALOGO.find((p) => p.id === id) ?? null;
}
