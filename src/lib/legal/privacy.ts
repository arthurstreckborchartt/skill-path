import type { LegalDocument } from "./types";

/**
 * MINUTA — PENDENTE DE REVISÃO JURÍDICA.
 *
 * As categorias de dados abaixo foram levantadas diretamente do código (src/lib/onboarding.ts
 * e src/lib/route-map.ts) e do que essas telas realmente gravam, para não declarar coleta que
 * não existe nem omitir coleta que existe. Nesta versão, TUDO fica no armazenamento local do
 * navegador (localStorage) — não existe conta, servidor de dados pessoais nem cadastro real
 * ainda. Quando isso mudar, esta Política precisa ser atualizada e a versão, incrementada.
 */
export const PRIVACY_POLICY: LegalDocument = {
  type: "privacy",
  version: "1.0.0-minuta",
  effectiveDate: "2026-08-29",
  title: "Política de Privacidade",
  summary:
    "Esta Política explica quais dados a Pathly trata, por quê, com quem compartilha e como você exerce seus direitos — incluindo o fato de que, nesta versão, seus dados ficam apenas no seu navegador.",
  sections: [
    {
      id: "quem-somos",
      title: "1. Quem trata seus dados",
      blocks: [
        {
          kind: "p",
          text: "O controlador dos dados pessoais tratados pela Pathly é [RAZÃO SOCIAL], inscrita no CNPJ sob o nº [CNPJ], com sede em [ENDEREÇO]. Contato para assuntos de privacidade: [E-MAIL DE CONTATO].",
        },
        {
          kind: "p",
          text: "Esta Política segue a Lei Geral de Proteção de Dados (Lei nº 13.709/2018) e o Marco Civil da Internet (Lei nº 12.965/2014).",
        },
      ],
    },
    {
      id: "onde-ficam-seus-dados",
      title: "2. Nesta versão, seus dados ficam no seu navegador",
      blocks: [
        {
          kind: "callout",
          text: "A Pathly ainda não tem servidor de contas nem banco de dados de usuários. Tudo que você responde no questionário inicial e todo o seu progresso na rota são salvos exclusivamente no armazenamento local (localStorage) do navegador que você está usando — não enviamos, não recebemos nem guardamos essas respostas em nenhum servidor nosso.",
        },
        {
          kind: "p",
          text: "Na prática, isso significa: seus dados não saem do seu aparelho; nós não temos acesso a eles; eles não sincronizam entre navegadores ou dispositivos diferentes; e são apagados se você limpar os dados do site, usar navegação privada ou desinstalar o navegador.",
        },
        {
          kind: "p",
          text: "Quando contas reais e sincronização em nuvem forem lançadas, esta seção será substituída por uma descrição completa de onde e como os dados passam a ser armazenados em servidor, com a versão desta Política incrementada.",
        },
      ],
    },
    {
      id: "dados-coletados",
      title: "3. Quais dados a Pathly trata",
      blocks: [
        { kind: "p", text: "Tratamos apenas as categorias abaixo, e só quando você as informa." },
        { kind: "p", text: "Dados do questionário inicial (onboarding):" },
        {
          kind: "list",
          items: [
            "objetivo principal (ex.: ganhar mais, trocar de área, conseguir emprego);",
            "renda atual e renda desejada, e o prazo em que pretende alcançá-la;",
            "situação atual (empregado, estudante, desempregado, freelancer ou empreendedor) e profissão atual;",
            "área de interesse profissional;",
            "nível de experiência profissional;",
            "habilidades que você já possui e o nível autodeclarado em cada uma;",
            "quantas horas por semana você tem disponíveis para estudar, e sua forma preferida de aprender;",
            "se está disposto a investir dinheiro em cursos e qual modelo de trabalho prefere;",
            "que tipo de oportunidade profissional você busca (emprego, estágio, freela, projeto próprio).",
          ],
        },
        { kind: "p", text: "Dados de progresso na rota:" },
        {
          kind: "list",
          items: [
            "quais etapas e itens de checklist você marcou como concluídos;",
            "sua sequência de dias ativos (streak), calculada a partir das datas reais de conclusão.",
          ],
        },
        { kind: "p", text: "Dados técnicos:" },
        {
          kind: "list",
          items: [
            "registros de erro (mensagem, rota da página, pilha de execução), sem nenhum dado pessoal, enviados apenas quando você acessa a Pathly a partir do ambiente de edição da Lovable — não ocorre em uso normal fora desse ambiente.",
          ],
        },
      ],
    },
    {
      id: "nao-coletamos",
      title: "4. O que não coletamos",
      blocks: [
        { kind: "p", text: "Nesta versão do produto, a Pathly não:" },
        {
          kind: "list",
          items: [
            "usa ferramentas de analytics, pixels de rastreamento ou cookies de publicidade;",
            "coleta sua localização geográfica;",
            "acessa sua câmera, microfone, agenda, contatos ou galeria de fotos;",
            "coleta dados de saúde, biometria, dados de pagamento ou documentos de identidade;",
            "vende ou compartilha seus dados com terceiros para fins de marketing;",
            "cria ou mantém uma conta de usuário em servidor — ver seção 2.",
          ],
        },
      ],
    },
    {
      id: "finalidades-e-bases",
      title: "5. Para que usamos e com que base legal",
      blocks: [
        {
          kind: "p",
          text: "Usamos os dados do questionário exclusivamente para gerar e exibir a sua rota personalizada dentro do seu próprio navegador — o processamento acontece no seu aparelho, a partir de regras determinísticas (não é feito por um provedor externo de IA nem enviado a servidores nossos).",
        },
        {
          kind: "list",
          items: [
            "Execução pré-contratual e execução de funcionalidade (art. 7º, V, LGPD): gerar sua rota e exibir seu progresso.",
            "Consentimento (art. 7º, I, LGPD): você opta por preencher o questionário; pode fechar a aba ou limpar os dados do navegador a qualquer momento para remover essas informações.",
          ],
        },
      ],
    },
    {
      id: "compartilhamento",
      title: "6. Com quem compartilhamos",
      blocks: [
        {
          kind: "p",
          text: "Como os dados do questionário e do progresso não saem do seu navegador (seção 2), não os compartilhamos com ninguém — não há servidor nosso para compartilhar a partir dele.",
        },
        {
          kind: "p",
          text: "A aplicação em si é hospedada por um provedor de nuvem (Cloudflare, via Lovable), que processa o tráfego necessário para entregar as páginas ao seu navegador, sem acesso às respostas que você digita.",
        },
        {
          kind: "p",
          text: "Fontes tipográficas são carregadas do Google Fonts, que recebe o endereço IP do seu dispositivo ao carregar as fontes da página.",
        },
      ],
    },
    {
      id: "seguranca",
      title: "7. Segurança",
      blocks: [
        {
          kind: "p",
          text: "O acesso ao armazenamento local do navegador é, por padrão, restrito ao próprio site que gravou os dados (política de mesma origem dos navegadores) — outro site não consegue ler os dados que a Pathly salva. Ainda assim, qualquer pessoa com acesso físico ou remoto ao seu navegador pode ver esses dados; trate seu aparelho e sua sessão de navegador com o mesmo cuidado que trataria qualquer outro dado pessoal salvo localmente.",
        },
      ],
    },
    {
      id: "retencao-e-exclusao",
      title: "8. Retenção e exclusão",
      blocks: [
        {
          kind: "p",
          text: "Os dados ficam salvos no seu navegador até que você os apague. Para excluir tudo o que a Pathly salvou:",
        },
        {
          kind: "list",
          items: [
            "limpe os dados do site nas configurações de privacidade do seu navegador, ou",
            "abra o console do desenvolvedor do navegador (F12) e execute localStorage.clear() com a Pathly aberta.",
          ],
        },
        {
          kind: "callout",
          text: "Uma opção de exclusão diretamente pela interface, sem depender do navegador, ainda não está disponível — é uma pendência técnica reconhecida, a ser resolvida junto com a implementação de contas reais.",
        },
      ],
    },
    {
      id: "direitos",
      title: "9. Seus direitos como titular",
      blocks: [
        {
          kind: "p",
          text: "A LGPD garante a você, entre outros, os direitos de confirmação de tratamento, acesso, correção, anonimização, eliminação e revogação do consentimento (art. 18). Nesta versão, como os dados ficam só no seu navegador, você exerce a maioria desses direitos diretamente: os dados estão sob seu controle físico, e você pode inspecioná-los, alterá-los (refazendo o questionário) ou apagá-los (seção 8) a qualquer momento, sem precisar de nós.",
        },
        {
          kind: "p",
          text: "Para dúvidas, escreva para [E-MAIL DE CONTATO]. Você também pode peticionar à Autoridade Nacional de Proteção de Dados (ANPD) se entender que seus direitos não foram atendidos.",
        },
      ],
    },
    {
      id: "criancas",
      title: "10. Crianças e adolescentes",
      blocks: [
        {
          kind: "p",
          text: "A Pathly é destinada a maiores de 18 anos. Menores de 18 anos só podem usar a plataforma com consentimento e supervisão de pelo menos um dos pais ou do responsável legal.",
        },
      ],
    },
    {
      id: "alteracoes",
      title: "11. Alterações desta Política",
      blocks: [
        {
          kind: "p",
          text: "Podemos atualizar esta Política conforme o produto evolui — em especial quando contas reais, sincronização em nuvem e eventuais integrações externas forem implementadas. A versão vigente e a data de vigência ficam indicadas no topo desta página.",
        },
      ],
    },
    {
      id: "contato",
      title: "12. Contato",
      blocks: [
        {
          kind: "p",
          text: "Para exercer seus direitos ou tirar dúvidas sobre esta Política, escreva para [E-MAIL DE CONTATO]. Endereço para correspondência: [ENDEREÇO].",
        },
      ],
    },
  ],
};
