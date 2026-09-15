# Rota gerada por IA

## Onde a chave vai (e onde não vai)

A chamada ao Claude acontece **só no servidor**, em `src/routes/api.rota.ts`. O SDK da Anthropic
não entra no bundle do navegador — isso foi verificado no build: `.output/public/` não contém nem
o SDK nem a string `ANTHROPIC_API_KEY`.

| Onde | O que fazer |
|---|---|
| Desenvolvimento | `ANTHROPIC_API_KEY=sk-ant-...` em **`.env.local`** (ignorado pelo git) |
| Produção | painel de variáveis de ambiente do Cloudflare / Lovable, como **secret** |

**Nunca no `.env`.** Esse arquivo está versionado e vai para o GitHub.

Sem a chave o app não quebra: a geração devolve `sem-chave`, o endpoint responde 503 e o cliente
cai na rota por regras (`generateRoute`), que é completa.

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
