import type { LegalDocument } from "./types";

/**
 * MINUTA — PENDENTE DE REVISÃO JURÍDICA.
 *
 * Reflete o estado real do produto nesta versão: sem cadastro funcional, sem cobrança, sem
 * conta persistida em servidor — tudo roda no navegador do usuário. Quando essas funcionalidades
 * existirem de verdade, este documento precisa ser atualizado e a versão, incrementada.
 */
export const TERMS_OF_USE: LegalDocument = {
  type: "terms",
  version: "1.0.0-minuta",
  effectiveDate: "2026-08-29",
  title: "Termos de Uso",
  summary:
    "Estes Termos explicam o que a Pathly é, o que ela não é, e as regras para usar a plataforma. Leia antes de criar sua rota.",
  sections: [
    {
      id: "quem-somos",
      title: "1. Sobre a Pathly",
      blocks: [
        {
          kind: "p",
          text: "A Pathly é operada por [RAZÃO SOCIAL], inscrita no CNPJ sob o nº [CNPJ], com sede em [ENDEREÇO]. Contato: [E-MAIL DE CONTATO].",
        },
        {
          kind: "p",
          text: "Estes Termos seguem a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), o Marco Civil da Internet (Lei nº 12.965/2014) e o Código de Defesa do Consumidor (Lei nº 8.078/1990), no que for aplicável.",
        },
      ],
    },
    {
      id: "o-que-e",
      title: "2. O que a Pathly é — e o que ela não é",
      blocks: [
        {
          kind: "p",
          text: "A Pathly gera uma rota de aprendizado personalizada — etapas, habilidades, projetos e marcos — a partir das respostas que você fornece sobre sua situação atual e seus objetivos de renda e carreira.",
        },
        {
          kind: "callout",
          text: "A Pathly NÃO garante emprego, renda, promoção ou qualquer resultado financeiro específico. A rota é uma recomendação baseada em regras a partir do que você informa — não é uma promessa, consultoria financeira, orientação profissional certificada nem aconselhamento jurídico ou de carreira individualizado por um profissional habilitado.",
        },
        {
          kind: "p",
          text: "Os valores de renda projetada ao longo da rota são estimativas ilustrativas derivadas da sua renda atual e da sua meta declaradas — não são previsão de mercado nem garantia de ganho.",
        },
      ],
    },
    {
      id: "cadastro",
      title: "3. Conta e cadastro",
      blocks: [
        {
          kind: "p",
          text: "Nesta versão, a Pathly ainda não possui criação de conta nem login funcionais — as telas existem, mas não criam nem autenticam uma conta real. Suas respostas do onboarding e seu progresso na rota ficam salvos apenas no armazenamento local do seu navegador (localStorage), não em um servidor.",
        },
        {
          kind: "callout",
          text: "Isso significa que, nesta versão, seus dados de rota não são sincronizados entre aparelhos e podem ser perdidos se você limpar os dados do navegador, trocar de aparelho ou desinstalar o navegador. Quando contas reais existirem, este documento e a Política de Privacidade serão atualizados antes do lançamento dessa funcionalidade.",
        },
      ],
    },
    {
      id: "assinatura",
      title: "4. Planos e cobrança",
      blocks: [
        {
          kind: "p",
          text: "Nesta versão, a Pathly não processa nenhum tipo de pagamento e não existe plano pago disponível. Se um plano pago for lançado no futuro, uma Política de Assinatura própria será publicada antes da cobrança começar, com preço, periodicidade, forma de cancelamento e política de reembolso claros.",
        },
      ],
    },
    {
      id: "uso-aceitavel",
      title: "5. Uso aceitável",
      blocks: [
        { kind: "p", text: "Ao usar a Pathly, você concorda em não:" },
        {
          kind: "list",
          items: [
            "fornecer informações falsas com a intenção de manipular ou testar o sistema de forma abusiva;",
            "tentar acessar, copiar ou extrair em massa o conteúdo das rotas, do catálogo de habilidades ou do código da plataforma;",
            "usar a Pathly para qualquer finalidade ilegal ou que viole direitos de terceiros;",
            "tentar interferir no funcionamento técnico do serviço.",
          ],
        },
      ],
    },
    {
      id: "propriedade-intelectual",
      title: "6. Propriedade intelectual",
      blocks: [
        {
          kind: "p",
          text: "O conteúdo das rotas, textos, identidade visual, marca Pathly e o código da plataforma pertencem a [RAZÃO SOCIAL] ou a seus licenciantes. Você recebe uma licença pessoal, não exclusiva e intransferível para usar a plataforma para fins próprios, não comerciais.",
        },
      ],
    },
    {
      id: "limitacao-responsabilidade",
      title: "7. Limitação de responsabilidade",
      blocks: [
        {
          kind: "p",
          text: 'A Pathly é fornecida "como está". Não garantimos que o serviço estará livre de erros ou interrupções. Na medida máxima permitida por lei, não respondemos por decisões profissionais, financeiras ou de carreira tomadas com base nas recomendações da plataforma — a decisão final e a responsabilidade por ela são sempre suas.',
        },
        {
          kind: "p",
          text: "Nada nestes Termos exclui direitos que não podem ser limitados por lei, incluindo os direitos do consumidor previstos no Código de Defesa do Consumidor.",
        },
      ],
    },
    {
      id: "alteracoes",
      title: "8. Alterações destes Termos",
      blocks: [
        {
          kind: "p",
          text: "Podemos atualizar estes Termos conforme o produto evolui — em especial quando cadastro, conta persistida e cobrança forem implementados de verdade. A versão vigente e a data de vigência ficam indicadas no topo desta página.",
        },
      ],
    },
    {
      id: "contato",
      title: "9. Contato",
      blocks: [
        {
          kind: "p",
          text: "Dúvidas sobre estes Termos podem ser enviadas para [E-MAIL DE CONTATO].",
        },
      ],
    },
  ],
};
