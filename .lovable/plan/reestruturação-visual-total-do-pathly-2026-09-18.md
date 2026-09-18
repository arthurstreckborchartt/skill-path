# Reestruturação visual total do Pathly

## Direção fechada

- Usar as duas imagens anexadas como blueprint direto de composição, proporção, densidade, sidebar, cabeçalho, cartões, botões e campos.
- Identidade exclusivamente acromática: preto, branco e cinza, tanto no modo claro quanto no escuro.
- Remover verde, azul, ciano, roxo, âmbar e qualquer gradiente colorido da interface.
- Eliminar glow, reflexos, brilho especular, halos, vidro excessivo e movimentos ornamentais.
- Adotar tipografia editorial e discreta próxima do Claude; usar Instrument Sans como alternativa pública adequada à Claude Sans.
- Preservar integralmente dados, autenticação, APIs, integrações, regras, persistência e comportamento atual.

## Implementação

### 1. Sistema visual central

- Redefinir tokens semânticos de fundo, texto, superfícies, bordas, campos, estados, raios, sombras, tipografia e transições.
- Criar pares claro/escuro equivalentes e estritamente neutros.
- Manter estados de erro distinguíveis por contraste, ícone e texto sem introduzir uma cor de marca.
- Remover utilitários de halo, brilho e gradientes coloridos; manter apenas transições curtas de opacidade, cor e deslocamento mínimo.

### 2. Componentes compartilhados

- Refazer logo para símbolo e texto pretos no claro, brancos no escuro, sem bloco colorido ou efeito.
- Normalizar botões, campos, painéis, chips, abas, progresso, indicadores, skeletons, cabeçalhos e estados vazios.
- Primary: preto com texto branco no claro; branco com texto preto no escuro.
- Secondary: superfície transparente ou cinza discreto, borda fina e feedback sutil.
- Reduzir raios, sombras e elevação para reproduzir a sobriedade das referências.

### 3. Estrutura global

- Reconstruir o shell desktop com sidebar estreita, calma e persistente; navegação ativa por contraste de superfície, sem cor.
- Criar cabeçalho minimalista alinhado ao conteúdo, com busca/comando visual quando útil e ações compactas.
- Ajustar largura, colunas, gutters e densidade para a composição das referências.
- No mobile, reorganizar navegação, topo, conteúdo e Copilot para uso confortável sem apenas comprimir o desktop.

### 4. Dashboard e áreas principais

- Reorganizar Início, Caminhos, Aprender, Projetos, Perfil e Configurações com hierarquia editorial, cards discretos e métricas compactas.
- Manter todos os números, próximos passos, XP, streak, progresso e ações existentes sem mudar cálculos.
- Reduzir blocos promocionais e grandes superfícies de destaque em favor de densidade controlada e leitura rápida.

### 5. Projetos e módulos técnicos

- Unificar visualmente Blueprint, Roadmap, Banco de Dados, API, Segurança, Validação e Arquitetura de IA.
- Padronizar cabeçalhos, seletores de modo, abas, painéis de conteúdo, listas, código, checklists, avisos e ações.
- Preservar geração, edição, tentativas, validações, estados e permissões existentes.

### 6. Copilot

- Manter toda a lógica atual, mas reconstruir a apresentação sobre AI Elements para conversa, mensagens, resposta, composer e loading.
- Aplicar mensagens do assistente sem bolha; mensagem do usuário com superfície neutra de alto contraste.
- Melhorar markdown, blocos de código, propostas, ações contextuais, estados de carregamento e painel móvel.
- Substituir o símbolo genérico de IA por uma identidade Pathly monocromática.

### 7. Páginas públicas e entrada

- Aplicar a mesma identidade à landing, login, cadastro, onboarding, planos e páginas legais.
- Remover halos e gradientes da landing e dos estados de geração, mantendo conteúdo e fluxo atuais.
- Harmonizar checkout anterior ao Stripe com o novo sistema monocromático sem alterar preço ou fluxo.

### 8. Revisão completa

- Revisar todas as rotas em modo claro e escuro.
- Conferir desktop, tablet, mobile e tela pequena com capturas reais.
- Verificar contraste, foco, teclado, redução de movimento, textos longos, abas horizontais, modais e painéis laterais.
- Executar lint, checagem de tipos e build após a composição do Copilot.

## Detalhes técnicos

- A implementação será concentrada primeiro em `src/styles.css`, no documento raiz, no shell e em `src/components/pathly/ui.tsx`; páginas herdarão os tokens antes de receber ajustes locais.
- Cores continuam sendo consumidas por tokens semânticos, sem valores visuais espalhados pelos componentes.
- Componentes do Copilot usarão os primitives oficiais de AI Elements; adaptações locais ficarão restritas à identidade e aos dados do Pathly.
- Nenhum arquivo de banco, SQL, autenticação, integração, API ou regra de negócio será alterado.

## Critérios de aceite

- Nenhuma cor cromática visível na identidade em light ou dark.
- Logo monocromática correta nos dois temas.
- Sem glow, reflexo, neon ou glassmorphism decorativo.
- Sidebar, cabeçalho, cartões, inputs e botões visualmente próximos às referências.
- Todos os fluxos atuais continuam funcionando com o mesmo conteúdo e comportamento.
- A experiência continua legível, estável e bem organizada de 320 px até desktop amplo.
