# Evolução profunda do Learning System do Pathly

## Objetivo
Transformar o Pathly de uma rota com checklists em um sistema de aprendizado orientado a objetivo, evidência e aplicação prática. A evolução será incremental: autenticação, onboarding, geração de rota, assinatura da rota, sincronização, paywall, Stripe e dados reais atuais serão preservados.

## Diagnóstico atual
- **Base real e preservada:** autenticação, onboarding com autosave, perfil sincronizado, rota personalizada por regras/IA, progresso por assinatura da rota, XP/níveis, streak por data local, projetos derivados da rota, paywall Free/Pro e catálogo de recursos.
- **Ponto forte:** o produto já sabe “onde estou” e “onde quero chegar” e ordena etapas por pré-requisito.
- **Lacuna central:** checklist marcado e etapa concluída ainda são tratados como prova de aprendizado. Não existem aulas estruturadas, tentativas, avaliações, evidências de domínio, revisões espaçadas, desafios persistentes ou tempo real de estudo.
- **Dados simulados remanescentes:** a rota pública de demonstração é intencional; Oportunidades segue fora do menu. Não será usada como dado de usuário.
- **Riscos que serão evitados:** não alterar IDs/assinatura da rota, pré-requisitos, regra local do streak, regras Free/Pro, geração por IA ou o fluxo do Stripe.

## Estratégia de implementação

### Fase A — Fundação persistente e compatível
- Criar um modelo de aprendizado vinculado a `user_id` e `route_signature`, sem substituir `pathly_route_progress`.
- Persistir unidades, tentativas, evidências, domínio, revisões, projetos e eventos de XP com RLS por proprietário.
- Adicionar chaves idempotentes para impedir XP duplicado ao atualizar, repetir ou reenviar uma ação.
- Criar uma camada única de domínio que calcule progresso e próximas ações; as telas não calcularão regras diferentes entre si.
- Migrar suavemente o progresso atual: checklists já concluídos continuam visíveis como histórico, mas não passam automaticamente a representar domínio comprovado.
- Manter fallback local para fluidez e sincronizar o estado autenticado com a nuvem para sobreviver a logout, refresh e troca de dispositivo.

### Fase B — Learning Dashboard
- Fazer a ação principal responder “o que faço agora?”, levando diretamente à sessão, revisão ou projeto correto.
- Mostrar apenas métricas comprováveis: sessão atual, exercícios, minutos estudados, XP por evidência, revisões vencidas, domínio e projeto ativo.
- Substituir o desafio semanal genérico por uma missão calculada com base no ritmo disponível e nas pendências reais.
- Incluir estados de carregamento, vazio, erro e sincronização sem bloquear a navegação.

### Fase C — Learning Path e Skill Tree
- Transformar cada etapa da rota em um grupo de habilidades com estados: bloqueada, disponível, em progresso e dominada.
- Exibir dependências, “por que isso existe”, contribuição para o objetivo profissional, domínio e evidências que faltam.
- No celular, usar progressão vertical e detalhes em tela dedicada; no desktop, manter mapa amplo com painel contextual.
- Preservar os marcos profissionais, projetos, recursos e o bloqueio por plano já existentes.

### Fase D — Sessões de aprendizado e active recall
- Criar uma rota dedicada por unidade de aprendizado com: objetivo, estimativa, dificuldade, conceito, exemplo, teste, prática, checkpoint e próxima ação.
- Converter os itens de checklist existentes em unidades iniciais reais da rota, sem inventar histórico do usuário.
- Implementar componentes reutilizáveis: `LearningSession`, `LessonProgress`, `Activity`, `Quiz`, `Feedback`, `Challenge`, `ReviewSession`, `MasteryBar` e `XPFeedback`.
- Começar com atividades determinísticas e avaliáveis; conteúdo que não puder ser avaliado automaticamente exigirá evidência/projeto, não um clique em “concluir”.
- Feedback de erro explicará o conceito confundido, a forma correta de pensar e oferecerá nova tentativa.

### Fase E — Domínio, XP, desafios e revisões
- Calcular domínio por habilidade com pesos explícitos para conteúdo, recall, exercício, desafio, projeto e retenção.
- Nunca conceder domínio máximo somente por consumo; exigir evidência prática e retenção.
- XP será emitido por eventos idempotentes: baixo para conteúdo, maior para acerto/exercício, alto para desafio/projeto e bônus controlado de consistência.
- Criar revisões por intervalo com base em acerto, confiança e tempo desde a última evidência.
- Criar desafios em quatro níveis — fácil, médio, difícil e projeto — com critérios de conclusão claros e sem estética infantil.
- Evoluir badges existentes para conquistas baseadas em eventos reais.

### Fase F — Projetos e adaptação
- Persistir progresso, entregáveis e evidências dos projetos vinculados às habilidades da rota.
- Ajustar recomendações usando objetivo, conhecimentos declarados, tentativas, erros, domínio, revisões e tempo disponível.
- Exibir recomendações contextuais somente quando houver dados suficientes; nunca fabricar dificuldade ou melhora.

### Fase G — Tutor contextual
- Adicionar tutor dentro da sessão, não como chatbot genérico: explicar de outra forma, dar exemplo, diagnosticar erro, criar pergunta e propor desafio.
- Enviar ao tutor somente o contexto necessário da sessão, habilidade e tentativa atual.
- Usar a integração de IA existente sem substituir o gerador de rota; erros e limites serão mostrados claramente, sem respostas falsas.
- Persistir apenas o necessário para continuidade e respeitar privacidade.

## Arquitetura técnica
- **Banco:** tabelas novas de conteúdo/unidades, estado por unidade, tentativas, domínio por habilidade, eventos de XP, revisões, desafios, projetos e conquistas. Todas com `GRANT`, RLS por `auth.uid()` e índices por usuário/rota/status/data.
- **Compatibilidade:** `pathly_profiles`, `pathly_routes` e `pathly_route_progress` continuam sendo a fonte atual de perfil, rota e legado; nenhum progresso existente será apagado.
- **Estado:** um `LearningProvider` consumirá a rota atual e fornecerá próxima ação, domínio, revisões, sessão atual, métricas e mutações otimistas com rollback em erro.
- **Rotas:** manter `/app`, `/app/rota`, `/app/habilidades`, `/app/projetos` e `/app/perfil`; adicionar páginas autenticadas para sessão e revisão quando a fundação estiver pronta.
- **Performance:** carregar detalhes de sessão sob demanda, memoizar derivados por assinatura da rota, evitar consultas por item e usar animações apenas em transform/opacidade/progresso.

## Entrega desta execução
1. Implementar e aplicar a fundação persistente com segurança.
2. Integrar o novo estado de aprendizado ao contexto atual sem quebrar o progresso legado.
3. Evoluir o dashboard para próxima ação, revisões e métricas reais.
4. Evoluir Caminhos/Aprender para skill tree e domínio baseado em evidência.
5. Implementar a primeira experiência de sessão completa e avaliável, ligada às unidades da rota.
6. Atualizar projetos/perfil para consumir o novo estado quando houver evidência.
7. Criar e manter `docs/LEARNING_SYSTEM.md` e `docs/IMPLEMENTATION_STATUS.md` com estado, arquitetura, banco, fluxos, pendências e testes.
8. Testar cadastro/login disponível, onboarding, dashboard, caminho, sessão, tentativa, XP, domínio, refresh, logout/login e layouts mobile/desktop.

## Continuação planejada
Caso a execução pare antes das fases avançadas, o projeto ficará funcional e documentado ao final da última fase integrada. Tutor por IA, adaptação avançada e expansão editorial de conteúdo só serão marcados como concluídos após chamada real, persistência, estados de erro e testes completos.

## Critérios de aceite
- Nenhuma habilidade chega a “dominada” apenas por abrir conteúdo ou marcar uma caixa.
- XP não duplica ao repetir/recarregar a mesma conclusão.
- O usuário autenticado mantém progresso em outro dispositivo.
- Dashboard, caminho e sessão concordam sobre a mesma próxima ação e o mesmo domínio.
- Toda ação importante tem loading, sucesso e erro claros.
- A experiência prioritária de celular é navegável com alvos adequados e sem conteúdo encoberto.
- Documentação identifica claramente o concluído, em andamento, pendente, bloqueado, bugs conhecidos e próximo passo.
