# Assinatura pelo Stripe

## Variáveis de ambiente

Todas são **secrets de servidor**. Nenhuma pode ter prefixo `VITE_` — isso a colocaria no bundle
do navegador. Verificado no build: `.output/public/` não contém nenhuma delas.

| Variável | Onde pegar |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe → Developers → API keys → Secret key (`sk_test_...`) |
| `STRIPE_PRICE_PRO` | já criado: `price_1UFyvALrCF4XONGkxIDv4FG6` |
| `STRIPE_WEBHOOK_SECRET` | Stripe → Developers → Webhooks → o endpoint → Signing secret (`whsec_...`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → `service_role` |

O webhook precisa da service role porque `plano` **não** é atualizável por `authenticated` — é
justamente o que impede alguém de se promover a Pro com um PATCH na API pública. Quem concede
acesso é o Stripe, confirmando pagamento, ou ninguém.

## Endpoint do webhook

`https://pathlyapp.app/api/stripe-webhook`

Eventos a assinar:

- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `checkout.session.completed`

## Por que a assinatura HMAC é conferida

O endpoint é público — o Stripe precisa alcançá-lo sem credencial nossa. Sem conferir a
assinatura, qualquer pessoa que descobrisse a URL mandaria um POST dizendo "fulano virou Pro" e
viraria Pro de graça.

Três detalhes que não são estilo:

1. o corpo é lido como **texto cru**; reserializar o JSON muda bytes e invalida a conferência;
2. há janela de tempo de 5 minutos, senão uma requisição capturada uma vez seria reenviável para
   sempre;
3. a comparação é em tempo constante — um `===` vazaria, pelo tempo de resposta, quantos
   caracteres iniciais o atacante acertou.

## Fluxo

1. A pessoa clica em "Assinar o Pro" → `POST /api/assinatura`
2. O endpoint confere a sessão no Supabase e cria o checkout com **14 dias grátis**
3. Ela paga no Stripe e volta para `/app/planos?assinatura=ok`
4. O Stripe chama o webhook → `plano = 'pro'` no banco
5. `usePlan()` lê do banco; o `localStorage` é só cache de tela

Quem já assina cai no **portal** do Stripe em vez de um segundo checkout — senão acabaria com
duas assinaturas e duas cobranças.

`trialing` conta como acesso: os 14 dias valem como Pro.

## O que ainda não existe

- Só modo de teste. A conta (NEXOS LTDA) não tem produção habilitada.
- Nenhuma cobrança real aconteceu. Nada disto foi exercitado ponta a ponta.
