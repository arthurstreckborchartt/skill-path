# Rota gerada por IA

## Dois provedores, um por plano

| Plano | Provedor | Chave | Custo |
|---|---|---|---|
| Gratuito | Gemini (`gemini-2.0-flash`) | `GEMINI_API_KEY` | camada gratuita, sem cartão |
| Pro | Claude Opus 5 | `ANTHROPIC_API_KEY` | por uso |

No Pro o Gemini entra como segunda tentativa: se o Claude cair, estourar limite ou recusar, é
melhor entregar uma rota boa do que nenhuma. Quem pagou não pode ficar sem rota por uma
indisponibilidade que não é dele.

O prompt é **o mesmo para os dois** (`prompt.ts`). O provedor muda, as regras do produto não —
e a versão gratuita é justamente a que mais gente vai ver.

Chave do Gemini: aistudio.google.com/apikey.

## O plano vem do banco, nunca do cliente

`usePlan()` guarda o plano no `localStorage`. Isso é estado de tela e qualquer pessoa edita pelo
devtools. O servidor **ignora** o que o cliente diz e lê a coluna `plano` de `pathly_profiles`.

Duas camadas protegem essa coluna:

1. RLS deixa a pessoa editar só a própria linha — mas `plano` está nessa linha;
2. por isso o grant de UPDATE é **por coluna**: `onboarding`, `goal_text` e `updated_at`. `plano`
   fica de fora, então um PATCH na API pública não promove ninguém.

Quem escreve `plano` é a integração de pagamento, com a service role. Enquanto a Stripe não
existe, ninguém é Pro e todo mundo usa o provedor gratuito — que é o desejado.

## Onde a chave vai (e onde não vai)

A chamada ao Claude acontece **só no servidor**, em `src/routes/api.rota.ts`. O SDK da Anthropic
não entra no bundle do navegador — isso foi verificado no build: `.output/public/` não contém nem
o SDK nem a string `ANTHROPIC_API_KEY`.

| Onde | O que fazer |
|---|---|
| Desenvolvimento | `GEMINI_API_KEY=...` e `ANTHROPIC_API_KEY=sk-ant-...` em **`.env.local`** (ignorado pelo git) |
| Produção | painel de variáveis de ambiente do Cloudflare / Lovable, como **secret** |

**Nunca no `.env`.** Esse arquivo está versionado e vai para o GitHub.

Sem chave nenhuma o app não quebra: a geração devolve `sem-chave`, o endpoint responde 503 e o
cliente cai na rota por regras (`generateRoute`), que é completa.

## Divisão de responsabilidade

A IA escreve **conteúdo de estudo**. Ela não toca em número de dinheiro.

| Quem decide | O quê |
|---|---|
| Claude | título, objetivo, por quê, marco, habilidades, projetos, dificuldade, horas, tarefas |
| Servidor | `id`, `order`, `eta`, `week`, `xp`, `incomeAfter`, `prereqs`, `demandPct`, `status` |

O motivo é de produto, não de arquitetura: um valor de renda escrito por um modelo e exibido numa
tela vira promessa de salário. `incomeAfter` continua sendo a divisão determinística da distância
entre a renda atual e a meta — marco alcançado, não previsão. O prompt em `gerar-rota.ts` proíbe
explicitamente promessa de emprego, de renda, citação de vaga e estatística de mercado inventada.

## Proteções de gasto

Cada geração custa dinheiro real. O endpoint:

1. exige sessão válida do Supabase — o token é **conferido no Supabase**, não só decodificado;
2. recusa mais de uma geração por minuto por pessoa (lê `pathly_routes.created_at`);
3. grava o resultado em `pathly_routes` e no `localStorage`, para não gerar duas vezes o mesmo.

## Quando a geração falha

`gerarRotaIA` no cliente **nunca lança**. Falhou — sem chave, limite de uso, recusa do modelo,
rede — o app segue com a rota por regras. A pessoa não pode ficar sem rota porque um serviço
externo caiu.
