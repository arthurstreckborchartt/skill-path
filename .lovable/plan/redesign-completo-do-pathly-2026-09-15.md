# Redesign completo do Pathly

## Direção aprovada

- **Paleta:** verde progresso — `#F6F8F7`, `#111816`, `#147D64`, `#B9E7D3`, `#E7B758`.
- **Tipografia:** Urbanist para títulos e Epilogue para interface e leitura.
- **Estrutura:** caminho central, inspirada na composição arquitetônica escolhida.
- **Tom:** fintech de carreira, adulto, preciso e recompensador; sem estética infantil, excesso de cards, neon ou “IA genérica”.
- A estrutura do protótipo será traduzida para o tema claro aprovado; cores, conteúdo fictício e excessos de vidro do protótipo não serão copiados.

## O que será preservado

- Login, cadastro, recuperação de senha, Google OAuth e proteção das áreas internas.
- Onboarding conversacional, geração de rota por IA e fallback atual.
- Progresso salvo, assinatura da rota, checklist, pré-requisitos, XP, streak e sincronização com a nuvem.
- Regras Free/Pro, checkout Stripe, portal do assinante e webhook.
- Configurações, feedback, tema, termos e privacidade.
- Os cálculos e identificadores atuais não serão alterados para não invalidar o progresso existente.

## Implementação

### 1. Fundamentos visuais

- Refazer tokens de cor, superfícies, bordas, sombras, foco, tipografia, espaçamento e movimento.
- Evoluir os componentes compartilhados: botões, campos, painéis, badges, avatar, progresso, tabs, modal, tooltip, skeleton, indicador de XP/nível, conquista e node de caminho.
- Criar estados acessíveis e movimento reduzido; remover inclinação e animações ornamentais.

### 2. Navegação e estrutura

- Simplificar para cinco destinos: **Início, Caminhos, Aprender, Projetos e Perfil**.
- Desktop com navegação arquitetônica compacta e contexto de evolução.
- Mobile com barra inferior confortável para o polegar; Planos e Configurações ficam acessíveis pelo Perfil.
- Unificar loading, vazio, erro e bloqueio de onboarding.

### 3. Dashboard como centro do produto

- Saudação curta com nível, XP e streak.
- “Próximo passo” como ação dominante, com duração, XP, motivo e CTA.
- Caminho ativo em checkpoints, mostrando posição atual, destino, avanço e etapas restantes.
- Métricas abertas e compactas, sem grade de cards administrativa.
- Desafio semanal e conquista recente derivados somente do progresso existente.
- Feedback encadeado ao concluir: confirmação → XP → avanço → desbloqueio → novo próximo passo.

### 4. Caminhos e aprendizado

- Redesenhar Minha Rota como progressão central responsiva: horizontal no desktop e vertical no celular.
- Preservar as três visões, detalhes, checklist, projetos, recursos, pré-requisitos e paywall.
- Transformar Habilidades em **Aprender**, removendo os dados mock atuais e usando apenas habilidades declaradas, concluídas e futuras da rota real.
- Usar módulos, dificuldade, tempo e recompensa sem imitar página de curso tradicional.

### 5. Projetos, portfólio e perfil

- Projetos seguem a sequência **Aprender → Praticar → Construir → Provar**, derivados da rota real.
- Perfil vira registro de evolução profissional: objetivo, nível, XP, sequência, skills, projetos e conquistas.
- Conquistas terão estados bloqueado/desbloqueado e descrições adultas, sem inventar conclusão.
- Estados vazios levam à ação correta em vez de mensagens genéricas.

### 6. Gamificação adulta

- Consolidar os sete níveis existentes em linguagem Pathly e apresentar requisitos/recompensa com clareza.
- Manter XP e streak reais; melhorar sua comunicação visual.
- Conquistas continuam derivadas de eventos reais.
- Desafio semanal será calculado a partir das próximas etapas, sem criar progresso falso ou novo backend.

### 7. Páginas complementares

- Aplicar o sistema à landing, login, cadastro, onboarding, planos, configurações e páginas legais.
- Manter Oportunidades fora da navegação enquanto depender de dados fictícios.
- Harmonizar estados de geração de rota, carregamento e erros com o novo produto.

### 8. Checkout e e-mails

- Redesenhar a experiência Pathly anterior ao checkout Stripe com a nova identidade, preservando preço de **R$ 29,90/mês**, teste de 14 dias e fluxo seguro existente.
- Atualizar os seis e-mails de autenticação com a nova paleta, tipografia compatível, logo pública e hierarquia visual consistente.
- Não alterar configuração do remetente, domínio, Stripe ou webhook.

### 9. Validação

- Testar autenticação, onboarding, geração de rota, conclusão de etapa, checklist, persistência, troca de rota, bloqueios Free/Pro, checkout e configurações.
- Revisar desktop, notebook, tablet, mobile e tela pequena com capturas reais.
- Verificar teclado, foco, contraste, leitores de tela e movimento reduzido.
- Conferir que nenhuma tela usa dados fictícios como se fossem do usuário.

## Limites desta entrega

- Não será criado backend fictício para cursos, certificados, notificações ou oportunidades.
- Funcionalidades sem dados reais aparecerão apenas como estados vazios honestos ou permanecerão fora da navegação.
- A IA continuará em segundo plano; o redesign não mudará provedores, prompts ou regras de geração.
