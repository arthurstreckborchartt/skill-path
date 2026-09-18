# Learning System — Implementation Status

## COMPLETED

- Auditoria de autenticação, onboarding, rota, progresso, gamificação, plano e dados reais/mock.
- Migração `0001_create_learning_system_foundation.sql` aplicada com quatro tabelas, GRANTs, RLS e índices.
- Estado por pessoa + rota para sessões, domínio, XP e projetos.
- Fallback local por assinatura da rota.
- Geração de sessões a partir do checklist sem alterar `routeSignature`.
- Sessão com objetivo, conceito, exemplo, active recall, feedback, prática e checkpoint.
- Feedback explica por que a opção está errada e oferece nova tentativa.
- XP de atividade/revisão idempotente.
- Repetição precoce sem ganho de XP/domínio e nota sensível aos erros do quiz.
- Domínio limitado a 80% sem revisão e “Dominada” somente a partir de 85%.
- Agendamento inicial de revisão espaçada.
- Dashboard com próxima sessão/revisão e métricas comprováveis.
- Aprender com domínio real por habilidade.
- Caminho ligado às sessões; etapa pessoal exige todas as evidências.
- Projeto com URL e reflexão persistentes.
- XP e domínio integrados ao Perfil e ao menu.
- Estados local/sincronizado/erro disponíveis na camada de aprendizado.
- Reconciliação de avanços offline com o snapshot da nuvem.
- Paywall aplicado também ao acesso direto de uma sessão.
- Documentação técnica e de continuidade criada.

## IN PROGRESS

- Validação ponta a ponta no navegador: login, onboarding, sessão, tentativa, XP, domínio, refresh e troca de viewport.
- Calibragem visual das novas telas em celular e desktop.
- Projeto prático: persistência está pronta; faltam marcos e avaliação.

## TODO

- Conteúdo editorial específico para todas as áreas e unidades.
- Mais formatos: completar código, verdadeiro/falso, ordenar, identificar erro e resposta aberta.
- Desafios com níveis fácil, médio, difícil e projeto.
- Revisão em lote e histórico de retenção.
- Missões semanais calculadas com recompensa idempotente.
- Conquistas persistidas com data e critérios de evidência.
- Adaptação por erro, desempenho, ritmo e preferência de aprendizagem.
- Tutor contextual com IA e teste real de gateway.
- Lazy loading da experiência de sessão.
- Testes unitários e de integração automatizados.
- QA completo de cadastro por e-mail e Google em ambiente publicado.

## BLOCKED

- Tutor contextual: depende da implementação do fluxo de IA e validação real da chamada; não foi simulado.
- Conteúdo profundo por área: exige autoria/curadoria pedagógica, não deve ser fabricado como dado real.
- Avaliação automática de projetos: exige critérios por projeto ou tutor avaliador.

## KNOWN ISSUES

- Sessões derivadas de checklists usam explicações estruturais genéricas até existir conteúdo editorial próprio.
- Itens legados concluídos permanecem marcados, mas não geram domínio retroativo.
- Não existe suíte automatizada no repositório; a validação atual é manual pelo app.

## Próximo passo recomendado

Produzir e versionar o conteúdo das primeiras unidades de Tecnologia, Dados, Design e Marketing, com duas perguntas e um exercício prático por unidade; depois ligar o tutor contextual às tentativas incorretas.
