# Pathly como orquestrador de criação de SaaS

## Objetivo

Transformar o Pathly em um ambiente onde a pessoa descreve o SaaS em uma conversa, recebe um plano técnico completo e coordena ferramentas externas para executá-lo. O produto deixa de apresentar estudo, aulas, habilidades, XP e trilhas educacionais.

Cada SaaS será um projeto com conversa, decisões, artefatos e histórico próprios, salvos na conta. Toda ação em uma ferramenta conectada exigirá aprovação explícita antes do envio.

## Experiência principal

1. A área autenticada abre em uma tela de conversa semelhante aos melhores assistentes atuais, com a marca Pathly no topo e o campo principal em destaque.
2. A pessoa descreve o que quer criar, por exemplo: “Quero um ERP para uma empresa”.
3. O Pathly faz perguntas objetivas somente quando faltar informação essencial.
4. A conversa cria o projeto e transforma as respostas no planejamento já existente: Fundação, Produto, Plano Técnico, Banco, API, Segurança, Arquitetura de IA, Operação e Roadmap.
5. Cada projeto ganha uma página própria e um endereço estável. Reabrir o projeto restaura a conversa e todo o contexto.
6. Sugestões que alterem o plano ou acionem ferramentas aparecem como propostas com impacto, destino e botões Aprovar/Rejeitar.
7. A lista de projetos substitui as áreas de estudo como navegação principal.

## Mudanças visíveis

- Remover da navegação e da experiência principal: Início educacional, Caminhos, Aprender, Habilidades, sessões, revisões, domínio, XP, streak e linguagem de estudo.
- Manter o código e os dados antigos sem exclusão destrutiva nesta etapa, evitando regressões e preservando histórico.
- Nova navegação enxuta: **Criar**, **Projetos**, **Integrações**, **Perfil** e **Configurações**.
- Transformar o Copilot lateral em conversa central do projeto, preservando contexto, propostas, decisões e gerador de prompts.
- Reescrever textos públicos, onboarding e estados vazios para criação e execução de SaaS.
- Manter o visual premium atual, adicionando ao campo de conversa um contorno acromático animado e sutil; nada de cores genéricas ou efeitos excessivos.

## Integrações e automação

- Criar uma área de Integrações por usuário, com estados desconectado, conectando, pronto e falhou.
- Usar MCP remoto oficial quando o fornecedor oferecer; usar API oficial somente quando MCP não existir.
- Não prometer integração universal automática: cada fornecedor precisa disponibilizar MCP/API e autorização compatível.
- O Pathly não expõe chaves ao navegador nem compartilha credenciais entre usuários.
- Ferramentas externas serão carregadas no agente apenas para o projeto e usuário ativos.
- Catálogos grandes usarão descoberta sob demanda, evitando enviar centenas de ferramentas ao modelo.
- Toda ferramenta que cria, altera, publica, envia ou gasta recursos terá confirmação obrigatória.
- Começar pelo framework de conexões e por um conector real suportado; Lovable, Codex/OpenAI, Gemini, Runway e Higgsfield entram conforme seus endpoints oficiais e permissões disponíveis.

## Persistência e segurança

- Reutilizar `pathly_projetos`, mensagens, decisões e propostas como base; não duplicar o que já funciona.
- Adicionar apenas as estruturas necessárias para conexões, credenciais protegidas e execuções aprovadas.
- Toda nova tabela terá acesso restrito ao proprietário, permissões explícitas e trilha de auditoria.
- A rota de conversa verificará sessão e propriedade do projeto antes de ler contexto, chamar modelos ou executar ferramentas.
- Não alterar autenticação, Stripe, webhook, configurações do Cloud ou tabelas existentes sem necessidade direta.

## Entregas

### Fase 1 — Novo produto utilizável

- Navegação sem educação.
- Tela inicial de criação por conversa.
- Projetos como conversas persistentes com URL própria.
- Conversa central usando os componentes de chat já instalados.
- Criação do projeto e planejamento técnico a partir da conversa.
- Propostas com aprovação/rejeição.
- Textos, onboarding e páginas públicas alinhados ao novo posicionamento.

### Fase 2 — Conexões e execução

- Cadastro e gerenciamento seguro de conexões por usuário.
- Fluxo OAuth/MCP, callback e desconexão.
- Carregamento das ferramentas conectadas no agente.
- Prévia da ação, confirmação e registro do resultado.
- Primeiro conector real validado de ponta a ponta.

### Fase 3 — Expansão do ecossistema

- Adicionar conectores oficiais de código, design, imagem, vídeo, conteúdo e operação.
- Mostrar capacidades disponíveis por conexão e orientar quando um fornecedor não oferece integração compatível.
- Melhorar coordenação entre ferramentas sem permitir execução silenciosa.

## Validação

- Criar dois projetos e confirmar que cada URL restaura apenas sua própria conversa.
- Recarregar e entrar em outro dispositivo para validar o histórico na conta.
- Confirmar que nenhuma área educacional aparece na navegação ou nos fluxos principais.
- Validar criação do plano, propostas e Aprovar/Rejeitar.
- Testar usuário desconectado, conexão com falha e ferramenta indisponível sem tela quebrada.
- Confirmar que nenhuma ação externa ocorre sem aprovação.
- Validar celular e desktop, tipos, lint, testes e build.

## Riscos e rollback

- **Fornecedores sem MCP/API:** manter a conexão indisponível com explicação clara, sem simular integração.
- **OAuth externo incompleto:** liberar a nova experiência de projetos sem execução externa até o conector estar validado.
- **Regressão em dados antigos:** esconder rotas educacionais sem apagar tabelas ou registros; rollback é restaurar os links anteriores.
- **Ações indevidas:** confirmação obrigatória e registro de cada execução; desconectar revoga o uso futuro da conexão.
