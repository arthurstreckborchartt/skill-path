/**
 * Cabeçalhos para falar com o Supabase a partir do servidor, com a chave de serviço.
 *
 * O detalhe que justifica um módulo: o Supabase tem dois formatos de chave. As antigas são JWT e
 * vão em `Authorization: Bearer <jwt>`; as novas (`sb_secret_...`, `sb_publishable_...`) são
 * strings opacas e **não** são bearer tokens — mandar uma no Authorization faz a requisição ser
 * rejeitada.
 *
 * O cliente gerado (`src/integrations/supabase/client.ts`) já trata isso removendo o header, e o
 * projeto está no formato novo. Sem esta função, toda escrita com a service role falharia em
 * silêncio — e as duas que existem são justamente as que concedem acesso pago e gravam conteúdo.
 */

function ehChaveNova(chave: string): boolean {
  return chave.startsWith("sb_publishable_") || chave.startsWith("sb_secret_");
}

export function cabecalhosServico(chave: string, extra?: Record<string, string>) {
  return {
    apikey: chave,
    // Só a chave antiga (JWT) vai no Authorization.
    ...(ehChaveNova(chave) ? {} : { Authorization: `Bearer ${chave}` }),
    ...(extra ?? {}),
  };
}
