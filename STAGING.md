# Ambiente de staging

A branch staging e a area de homologacao do projeto. Mudancas devem chegar aqui por pull request antes de qualquer merge em main.

## Fluxo seguro

1. Criar uma branch de trabalho a partir de staging.
2. Implementar e revisar a mudanca na branch de trabalho.
3. Abrir um PR da branch de trabalho para staging.
4. Testar a aplicacao em staging.
5. So depois abrir ou aprovar o PR de staging para main.

## Validacao local

bun install --frozen-lockfile
bun run lint
bun run build

Para visualizar a aplicacao durante a homologacao:

bun run dev

## Protecao

Nao fazer force-push, rebase, amend ou squash do historico publicado. Nao mesclar staging em main sem revisar o PR e confirmar a validacao.

O GitHub Actions ainda nao foi habilitado neste repositorio porque a conexao atual nao possui a permissao especifica para criar workflows. Quando essa permissao estiver disponivel, o workflow deve executar automaticamente lint e build nos PRs.
