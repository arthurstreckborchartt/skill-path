# Checkout personalizado Pathly

## Resultado
Criar uma etapa de checkout dentro da Pathly, com a logo já fornecida, identidade dark ink, aqua/azul e experiência responsiva. O pagamento continuará sendo concluído com segurança no Stripe.

## Experiência
- Substituir o redirecionamento imediato por uma tela de checkout da Pathly.
- Mostrar resumo do Pathly Pro, 14 dias grátis, preço mensal, benefícios e conta autenticada.
- Incluir estados claros de carregamento, erro e cancelamento, além de aviso de pagamento seguro.
- No celular, priorizar uma sequência vertical curta; no desktop, usar resumo do plano e confirmação lado a lado.
- Ao confirmar, criar a sessão existente e encaminhar para o Stripe sem coletar dados de cartão dentro do app.

## Identidade visual
- Reutilizar a logo oficial já armazenada no projeto.
- Aplicar os tokens atuais de cor, tipografia, borda e sombra da Pathly.
- Usar fundo sofisticado, sinal aqua/azul, destaque âmbar discreto e microinterações com movimento reduzido respeitado.

## Integração
- Preservar autenticação, preço, período grátis, cupom, retorno, portal do assinante e webhook existentes.
- Ajustar os textos enviados ao checkout hospedado quando suportado, sem expor segredos nem alterar a lógica de concessão do plano.

## Validação
- Testar autenticado no desktop e no celular.
- Confirmar que a tela personalizada abre, que o botão chega ao checkout Stripe em modo de teste e que cancelamento/retorno continuam corretos.
