# Correção dos erros confirmados do Pathly

## Escopo

Corrigir quatro falhas confirmadas, sem alterar regras de produto nem abrir acesso anônimo:

1. Restaurar o acesso autenticado às tabelas centrais usadas pelo aplicativo.
2. Fazer o checklist de segurança salvar de verdade e desfazer a marcação quando a gravação falhar.
3. Preservar MySQL ou SQLite ao regenerar o modelo de dados.
4. Manter o relatório de segurança visível quando a busca de riscos por IA falhar.

## Implementação

### Permissões e checklist

- Aplicar uma migração aditiva com privilégios mínimos para `authenticated` nas tabelas centrais, mantendo RLS por proprietário.
- Garantir que `pathly_seguranca` aceite INSERT/UPDATE somente quando `auth.uid() = user_id` e o projeto pertença ao mesmo usuário.
- Manter `service_role` com acesso operacional e nenhum acesso anônimo aos dados pessoais.
- No checklist, verificar o retorno da gravação, restaurar o estado anterior em caso de falha e mostrar uma mensagem acionável.

### Dialeto do banco

- Ao regenerar um modelo já existente, reutilizar o dialeto salvo em vez de recalculá-lo pela stack.
- No cliente, preservar o dialeto atual como proteção adicional se a resposta não trouxer um valor válido.

### Relatório de segurança

- Separar erro da busca de riscos extras do estado principal do relatório.
- Preservar análise estática, checklist e dados já carregados durante falhas de IA ou conexão.
- Exibir o erro junto ao botão de nova tentativa, sem exigir recarregar a página.

## Riscos e proteção

- **Risco:** permissões excessivas. **Proteção:** grants somente para operações realmente usadas e RLS vinculada ao usuário/projeto.
- **Risco:** uma migração divergir do banco atual. **Proteção:** consultar políticas e privilégios vivos antes de aplicar SQL idempotente.
- **Risco:** estado otimista divergir do servidor. **Proteção:** rollback visual e mensagem de erro quando a gravação falhar.

## Testes

- Confirmar políticas e privilégios resultantes no banco.
- Validar leitura e escrita autenticadas nas tabelas afetadas, sem acesso entre usuários.
- Verificar regeneração mantendo PostgreSQL, MySQL e SQLite.
- Simular falha da IA e confirmar que relatório/checklist permanecem visíveis com nova tentativa.
- Executar a verificação de tipos e revisar os alertas de segurança e monitoramento.

## Rollback

- Reverter os grants/policies para o estado anterior com uma migração compensatória, se necessário.
- Reverter isoladamente as mudanças de estado do checklist, dialeto e relatório sem tocar nos dados persistidos.
