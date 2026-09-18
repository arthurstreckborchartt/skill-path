# Pathly Learning System

## Estado atual

O Pathly possui autenticação, onboarding, rota personalizada, pré-requisitos, progresso legado, XP de etapas, níveis, streak, projetos, recursos e plano Free/Pro. Esta evolução adiciona um sistema educacional baseado em evidência sem substituir esses contratos.

A fonte editorial inicial continua sendo a rota ativa. Cada item do checklist de uma etapa é normalizado como uma sessão curta, mantendo os IDs e títulos usados por `routeSignature`. Assim, uma rota antiga não perde o progresso e uma rota nova continua zerada.

## O que foi alterado

- Criada fundação persistente para sessões, tentativas, tempo estudado, revisões, domínio, eventos de XP e projetos.
- Criada primeira experiência completa de sessão: objetivo, conceito, exemplo, recuperação ativa, prática, confiança, checkpoint, feedback e próxima ação.
- Itens da etapa agora abrem sessões avaliáveis em vez de poderem ser marcados livremente.
- Uma etapa pessoal só pode ser concluída quando todas as suas sessões tiverem evidência concluída.
- Dashboard passou a priorizar sessão ou revisão e exibir sessões, tempo real, domínio e revisões.
- A página Aprender passou a exibir domínio baseado em evidência.
- Projetos aceitam entrega por URL e reflexão, persistidas por usuário e rota.
- XP de sessão/revisão usa eventos idempotentes; repetir ou recarregar a mesma conclusão não duplica a recompensa.
- Falhas de sincronização mantêm cópia local e geram um estado explícito no domínio de aprendizado.

## Arquitetura

### Contratos preservados

- `OnboardingProfile` segue sendo o contrato do diagnóstico inicial.
- `RouteStep.id`, `RouteStep.title` e `routeSignature` não foram alterados.
- `pathly_route_progress` segue sendo a fonte de progresso legado da rota.
- `RouteProgressProvider` continua sendo a única instância do progresso da rota.
- `etapaBloqueadaPorPlano` continua sendo a fonte do paywall Free/Pro.
- A sequência local do streak não foi alterada.
- Geração por regras e por IA continuam funcionando como antes.

### Camada de aprendizado

- `learning-system.ts`: tipos, normalização de sessões, cálculo de XP, revisão e percentual.
- `learning-cloud.ts`: leitura e escrita do estado autenticado com RLS.
- `learning-context.tsx`: estado compartilhado, fallback local, sincronização, próxima ação e mutações.
- `learning-session.tsx`: experiência modular de sessão e checkpoint.

### Componentes criados

- `LearningSystemProvider`
- `LearningSession`
- Reuso de `ProgressBar`, `Chip`, `Panel`, `Btn` e `XpBurst`.

### Rotas alteradas

- `/app`: próxima ação e métricas reais de aprendizado.
- `/app/rota`: itens da etapa direcionam a sessões com evidência.
- `/app/habilidades`: domínio e sequência de aprendizado.
- `/app/projetos`: entrega persistente de projeto.
- `/app/perfil`: XP e domínio provenientes da nova camada.

### Rota criada

- `/app/aprender/$activityId`: sessão autenticada gerada a partir da rota atual.

## Banco de dados

### `pathly_learning_activity_progress`

Uma linha por pessoa, rota e atividade. Guarda tipo, estado, nota, tentativas, minutos, confiança, conclusão, resposta e próxima revisão.

### `pathly_xp_events`

Registro append-only de XP. A combinação pessoa + rota + `event_key` é única para impedir duplicação.

### `pathly_skill_mastery`

Domínio agregado por habilidade dentro de uma rota, com quantidade de evidências e última prática.

### `pathly_project_progress`

Estado, percentual, URL de evidência, reflexão e conclusão de cada projeto.

Todas as tabelas têm permissões explícitas, RLS por proprietário, acesso de serviço e índices por usuário/rota.

## Relações conceituais

```text
Pessoa
  └── Rota (route_signature)
       ├── Etapas existentes
       │    └── Sessões derivadas do checklist
       │         ├── tentativas
       │         ├── tempo
       │         ├── confiança
       │         └── revisão futura
       ├── domínio por habilidade
       ├── eventos de XP idempotentes
       └── evidências de projetos
```

## Estado e fluxos

### Próxima ação

1. Se houver revisão vencida, ela tem prioridade.
2. Caso contrário, busca a primeira sessão incompleta da etapa atual.
3. Se não houver sessão, o usuário volta ao mapa da rota.

### Sessão

1. Objetivo claro.
2. Explicação contextual.
3. Exemplo ligado ao projeto/marco.
4. Pergunta de recuperação ativa.
5. Feedback que explica o raciocínio.
6. Prática e autoavaliação de confiança.
7. Checkpoint persistido.
8. Próxima sessão ou caminho.

### Sincronização

- O estado é lido da nuvem para usuários autenticados.
- Uma cópia local por `route_signature` mantém a experiência disponível em falhas temporárias.
- Escritas são otimistas e tentam sincronizar imediatamente.
- Na hidratação, progresso local mais recente e eventos ainda ausentes são reconciliados com a nuvem antes de compor a tela.
- O esquema RLS impede acesso ao estado de outra pessoa.
- Sessões acima do limite gratuito verificam a mesma regra central do plano, inclusive em acesso direto por URL.

## Gamificação e XP

- XP legado de etapa permanece preservado.
- Sessão: recompensa menor.
- Quiz: recompensa intermediária.
- Desafio: recompensa maior.
- Revisão: recompensa própria.
- Evento único impede repetir uma conclusão para farmar XP.
- Reabrir uma sessão antes da revisão não eleva domínio nem cria nova evidência; erros no teste reduzem a nota registrada.
- Nível usa XP legado + XP comprovado.
- Não há ranking ou competição artificial.

## Skill mastery

- Uma primeira conclusão eleva domínio, mas o teto sem revisão é 80%.
- Revisões podem levar a habilidade acima de 80% e até 100%.
- Erros ainda contam como prática mínima, sem produzir domínio alto.
- Uma habilidade é “Dominada” somente a partir de 85%.
- O cálculo atual é incremental por evidência; calibragem por tipo de atividade é a próxima evolução.

## Sistema de revisão

- Nota 90–100: revisão inicial em 7 dias; revisões posteriores podem ir para 14 dias.
- Nota 70–89: revisão em 3 dias.
- Abaixo de 70: nova tentativa/revisão no mesmo dia.
- Revisões vencidas aparecem como próxima ação no dashboard.

## Sistema de desafios

A última sessão de cada etapa é normalizada como desafio. Ela recebe mais XP e exige o mesmo checkpoint avaliável. Níveis editoriais adicionais (fácil, médio, difícil e projeto/boss) ainda precisam de conteúdo próprio por área.

## Sistema de projetos

Cada projeto da rota pode receber URL da entrega e reflexão. A evidência persiste entre aparelhos. Avaliação automática/manual, progresso por marcos e XP de projeto ainda não foram ativados.

## IA / tutor

A IA existente continua responsável pela geração de rota. O tutor contextual ainda não foi ligado: ele só será habilitado após existirem limites de contexto, tratamento de erros/créditos, privacidade e teste real de chamada.

## Responsividade e acessibilidade

- Sessão em coluna única, priorizada para celular.
- Ações com altura mínima adequada ao toque.
- Barra inferior do app e áreas seguras continuam preservadas.
- Pergunta usa `radiogroup` e feedback textual, não apenas cor.
- Movimento respeita `prefers-reduced-motion` pelo sistema global.

## Pendências

- Conteúdo editorial próprio por área, em vez de explicação estrutural derivada da rota.
- Banco de perguntas com múltiplas questões e embaralhamento.
- Exercícios de código, ordenação, verdadeiro/falso e respostas abertas.
- Avaliação e marcos de projetos.
- Tutor contextual com IA.
- Recomendação adaptativa baseada em padrões de erro.
- Histórico completo e visual de revisões.
- Testes automatizados unitários e de integração.

## Bugs conhecidos

- Sessões de rotas antigas são derivadas do checklist e, por isso, têm conteúdo introdutório genérico até receberem conteúdo editorial específico.
- O progresso legado marcado antes desta evolução é exibido como histórico; ele não cria domínio automaticamente.
- O fallback local é por navegador; troca de dispositivo depende da sincronização na nuvem.

## Próxima etapa recomendada

Criar conteúdo editorial e bancos de atividades por área para as primeiras etapas de Tecnologia, Dados, Design e Marketing; depois ampliar tipos de exercício e calibrar domínio com peso por atividade.

## Testes realizados

Ver `docs/IMPLEMENTATION_STATUS.md` para a matriz atualizada de validação.
