import type { LegalDocument } from "./types";

/**
 * MINUTA — PENDENTE DE REVISÃO JURÍDICA.
 *
 * As categorias de dados abaixo foram levantadas diretamente do código (src/lib/onboarding.ts,
 * src/lib/route-map.ts, src/lib/auth.ts, src/lib/telemetry.ts e src/components/pathly/feedback-form.tsx)
 * e do que essas telas realmente gravam, para não declarar coleta que não existe nem omitir
 * coleta que existe.
 *
 * Divisão atual: conta (e-mail, senha, nome) e feedback ficam em servidor, no Supabase; as
 * respostas do questionário e o progresso na rota continuam SÓ no navegador. Ao mexer em
 * qualquer um dos arquivos acima, revise esta Política e incremente a versão.
 */
export const PRIVACY_POLICY: LegalDocument = {
  type: "privacy",
  version: "1.1.0-minuta",
  effectiveDate: "2026-09-14",
  title: "Política de Privacidade",
  summary:
    "Esta Política explica quais dados a Pathly trata, por quê, com quem compartilha e como você exerce seus direitos — incluindo o que fica na sua conta, em servidor, e o que continua apenas no seu navegador.",
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
      title: "2. O que fica em servidor e o que fica no seu navegador",
      blocks: [
        {
          kind: "callout",
          text: "Em servidor fica só o necessário para existir uma conta: seu e-mail, sua senha (guardada apenas como hash, nunca em texto legível), o nome que você informa no cadastro e, se você enviar, o texto do seu feedback. As suas respostas do questionário inicial e todo o seu progresso na rota continuam exclusivamente no armazenamento local (localStorage) do navegador que você está usando.",
        },
        {
          kind: "p",
          text: "Na prática: o conteúdo mais sensível do produto — a sua renda atual, a renda que você quer, sua profissão e suas habilidades — nunca é enviado para nenhum servidor nosso. Ele não sincroniza entre navegadores ou aparelhos, e é apagado se você limpar os dados do site, usar navegação privada ou trocar de navegador.",
        },
        {
          kind: "p",
          text: "A conta é hospedada no Supabase, que atua como operador dos dados em nosso nome (ver seção 6). Se você optar por entrar com o Google, o Google confirma sua identidade e nos informa o e-mail associado — nós não recebemos a sua senha do Google.",
        },
        {
          kind: "p",
          text: "Quando a sincronização da rota em nuvem for implementada, esta seção será atualizada para descrever o que passa a sair do navegador, com a versão desta Política incrementada.",
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
        { kind: "p", text: "Dados de conta (estes ficam em servidor):" },
        {
          kind: "list",
          items: [
            "e-mail e senha — a senha é guardada apenas como hash, e nunca temos acesso ao texto dela;",
            "o nome que você digita no cadastro;",
            "um identificador interno da sua conta e as datas de criação e de último acesso;",
            "se você entrar com o Google: o e-mail e o identificador que o Google devolve.",
          ],
        },
        { kind: "p", text: "Feedback que você envia (este fica em servidor):" },
        {
          kind: "list",
          items: [
            "o texto que você escreve, o tipo escolhido (erro, ideia ou outro), a tela em que você estava e a data — vinculados à sua conta para que possamos responder.",
          ],
        },
        { kind: "p", text: "Dados técnicos:" },
        {
          kind: "list",
          items: [
            "registros de erro (mensagem, rota da página, pilha de execução e dados do navegador), enviados ao serviço de monitoramento Sentry quando ocorre uma falha. A ferramenta é configurada para não anexar dados pessoais, e as respostas do seu questionário não são enviadas junto;",
            "registros de erro, sem dado pessoal, enviados também quando você acessa a Pathly a partir do ambiente de edição da Lovable — não ocorre em uso normal fora desse ambiente.",
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
            "usa ferramentas de analytics comportamental, pixels de rastreamento, gravação de sessão ou cookies de publicidade — o monitoramento descrito na seção 3 registra falhas técnicas, não o que você faz no app;",
            "envia para servidor as suas respostas do questionário (renda, profissão, habilidades) nem o seu progresso na rota — ver seção 2;",
            "coleta sua localização geográfica;",
            "acessa sua câmera, microfone, agenda, contatos ou galeria de fotos;",
            "coleta dados de saúde, biometria, dados de pagamento ou documentos de identidade;",
            "vende ou compartilha seus dados com terceiros para fins de marketing.",
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
            "Execução de contrato (art. 7º, V, LGPD): manter sua conta, autenticar seu acesso e permitir que você entre de volta no produto.",
            "Execução pré-contratual e execução de funcionalidade (art. 7º, V, LGPD): gerar sua rota e exibir seu progresso.",
            "Consentimento (art. 7º, I, LGPD): você opta por preencher o questionário e por enviar feedback; pode limpar os dados do navegador a qualquer momento para remover as respostas.",
            "Legítimo interesse (art. 7º, IX, LGPD): registrar falhas técnicas para corrigir defeitos e manter o produto seguro e funcionando, tratando o mínimo necessário para isso.",
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
          text: "Os dados do questionário e do progresso não saem do seu navegador (seção 2), então não há como compartilhá-los. Os dados de conta e de feedback são tratados pelos operadores abaixo, que agem sob nossas instruções e não podem usar seus dados para finalidade própria:",
        },
        {
          kind: "list",
          items: [
            "Supabase — banco de dados e autenticação: guarda seu e-mail, o hash da sua senha, seu nome e o feedback que você envia.",
            "Sentry — monitoramento de erros: recebe os registros de falha descritos na seção 3.",
            "Cloudflare (via Lovable) — hospedagem: processa o tráfego necessário para entregar as páginas ao seu navegador, sem acesso às respostas que você digita.",
            "Google — apenas se você escolher entrar com a conta Google, para confirmar sua identidade.",
            "Google Fonts — recebe o endereço IP do seu dispositivo ao carregar as fontes da página.",
          ],
        },
        {
          kind: "callout",
          text: "Transferência internacional: esses provedores podem processar e armazenar dados em servidores fora do Brasil, inclusive nos Estados Unidos. A transferência é feita com base no art. 33 da LGPD, para viabilizar a execução do contrato com você e o funcionamento do produto.",
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
        {
          kind: "p",
          text: "Do lado do servidor: o tráfego entre o seu navegador e a Pathly é criptografado (HTTPS), a senha é guardada apenas como hash, e o banco usa regras de acesso por linha, de modo que o feedback enviado por uma pessoa não fica acessível a outra.",
        },
      ],
    },
    {
      id: "retencao-e-exclusao",
      title: "8. Retenção e exclusão",
      blocks: [
        {
          kind: "p",
          text: "As respostas do questionário e o progresso ficam salvos no seu navegador até que você os apague. Para excluir:",
        },
        {
          kind: "list",
          items: [
            "limpe os dados do site nas configurações de privacidade do seu navegador, ou",
            "abra o console do desenvolvedor do navegador (F12) e execute localStorage.clear() com a Pathly aberta.",
          ],
        },
        {
          kind: "p",
          text: "Os dados de conta ficam guardados enquanto a sua conta existir. Os registros de erro são mantidos pelo prazo de retenção do serviço de monitoramento e descartados depois disso.",
        },
        {
          kind: "callout",
          text: "A exclusão da conta pela própria interface ainda não está disponível — é uma pendência técnica reconhecida. Enquanto isso, peça a exclusão pelo e-mail de contato da seção 12 e apagaremos sua conta e o feedback vinculado a ela.",
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
