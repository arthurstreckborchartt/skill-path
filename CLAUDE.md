# PATHLY — contexto operacional

Antes de iniciar qualquer mudança, leia `AGENTS.md`, confira `git status --short` e preserve alterações existentes que não pertençam à tarefa. Não reescreva histórico publicado: este projeto sincroniza com Lovable.

Para contexto do produto, use a skill global `pathly-command-center`. Ela aponta para o vault em `C:\Users\Usuario\Desktop\VAULTS OBSIDIAN\PATHLY`.

Regras essenciais:

- Leia somente o pacote de contexto ligado à tarefa; não carregue o vault inteiro.
- Repositório, branch, commit e ambiente são a fonte de verdade. Se divergirem do vault, registre a divergência e atualize o estado antes de seguir.
- Não exponha ou copie chaves, tokens, PII, dados de pagamento ou logs sensíveis para notas ou conversas.
- Antes de código de pagamentos, autenticação, migração, permissão, deploy ou integração externa: apresente plano, riscos, testes e rollback; aguarde aprovação quando a ação for sensível.
- Ao concluir, registre evidência (commit/PR/teste/deploy) no vault, quando a mudança for relevante para operação ou decisão futura.

## SQL gerado não é SQL executado

Separe os estados: `gerado` → `aprovado` → `executado` → `validado` (ou `falhou`). O registro vive em `supabase/ESTADO-SQL.md` e em `04-DATABASE/` no vault.

Nunca escreva "tabela criada", "RLS configurada" ou "estrutura disponível" só porque o arquivo `.sql` existe. Sem evidência, a frase é "SQL gerado, aguardando execução no Supabase".

**`tsc` limpo e `build` verde não são evidência.** Acrescentar a tabela em `src/integrations/supabase/types.ts` faz o app compilar como se ela existisse.

A sonda que vale, do console do app com sessão aberta:

```js
const { error } = await supabase.from('tabela').select('*').limit(0);
```

`42501` prova que a tabela **existe** (permissão negada só acontece sobre algo que existe). `PGRST205` prova que **não existe**. Qualquer outro código é inconclusivo — e inconclusivo não é ausência.

Confirmação humana ("rodei") é registrada como confirmação humana, nunca como prova.

## Duas armadilhas do Supabase, descobertas em teste

- **Um `grant` nunca restringe.** As DEFAULT PRIVILEGES do schema `public` já concedem tudo a `anon` e `authenticated`; conceder de novo é aditivo. Para tirar privilégio é preciso `revoke` explícito — o padrão das migrations `0002` e `0003` é `REVOKE ALL` seguido de `GRANT` do necessário, que declara o estado final.
- **RLS sem policy bloqueia em silêncio.** Com RLS ligada e sem policy de UPDATE, o comando volta sem erro e afeta zero linhas. Quem chamou não distingue "fui barrado" de "não havia o que atualizar".

## As três camadas de IA, para não confundir

| | O que é | Onde mora |
|---|---|---|
| Infra de provedores | Como o Pathly chama Gemini/Groq/Claude. | `src/lib/ia/` |
| AI Architecture | Decide se o SaaS **do usuário** precisa de IA. | `src/lib/arquitetura-ia/` |
| Copilot | Chat que ajuda o usuário **a construir**. | `src/lib/copilot/` |

Não misture o Copilot com a infraestrutura de provedores, e não duplique a cadeia de fallback: use `gerarJson` de `src/lib/ia/`.

## Formatação

Fim de linha é LF, garantido pelo `.gitattributes`. Arquivos gerados (`routeTree.gen.ts`, `src/integrations/supabase/types.ts`) estão no `.prettierignore` — não os formate.

O repositório tem dívida de formatação pré-existente em ~42 arquivos. Não conserte de carona numa feature: normalização merece commit próprio.
