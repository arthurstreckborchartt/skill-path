# Pathly Local Bridge

Como conectar uma ferramenta que roda na sua máquina — Revit, VS Code, CAD, CLI — ao Pathly, que
roda na nuvem.

## O problema

A nuvem não alcança `localhost`. É a mesma frase que aparece na pesquisa do Cursor, do Codex, do
Claude Code e do plugin do Obsidian: essas ferramentas rodam na sua máquina, e nenhum servidor do
Pathly consegue falar com elas.

A ponte inverte a direção. Ela roda **na sua máquina** e **conecta para fora**: é ela que procura
o Pathly. Não abre porta, não precisa de IP fixo, atravessa NAT e firewall corporativo, e você
fecha o programa quando quiser.

```
PATHLY CLOUD
   ↓  (a ponte é quem chama, por HTTPS)
PATHLY LOCAL BRIDGE
   ↓
APLICAÇÃO LOCAL
```

## A regra que nada pode violar

**A ponte nunca executa comando recebido do servidor.**

O servidor manda um `acaoId` e parâmetros nomeados. A ponte procura esse id no catálogo **dela** —
compilado dentro dela, não recebido — e se não achar, recusa com `ACAO_DESCONHECIDA`. Nenhuma
mensagem consegue introduzir uma ação nova, porque a lista não vem pela rede.

Não existe uma ação `executar_comando`, nem um parâmetro `args`, `cmd`, `script` ou `shell`. Uma
ação assim tornaria todo o resto teatro: bastaria ela, e as outras viram decoração.

Procure por `spawn` em `ponte/pathly-bridge.mjs`: há uma ocorrência, com o executável fixo no
código e o argumento montado a partir de um caminho já validado e já confinado à pasta do projeto.

## Começando

```bash
node pathly-bridge.mjs parear ABC234   # o código vem de Configurações → Pontes
node pathly-bridge.mjs                 # roda
```

Node 18+, sem dependência nenhuma. É um arquivo, e dá para ler inteiro antes de confiar nele —
deliberadamente: um agente com acesso ao seu disco precisa caber numa leitura de dez minutos.

Variáveis: `PATHLY_URL` (padrão `https://pathlyapp.app`) e `PATHLY_PROJETO` (a pasta que a ponte
enxerga; padrão, o diretório atual).

## Pareamento e identidade

1. Você gera um código de seis letras no Pathly. Vale dez minutos e um uso.
2. A ponte troca o código por um **token**, devolvido uma única vez.
3. O Pathly guarda só o SHA-256 do token. Ele não consegue mostrá-lo de novo porque não o tem.

O alfabeto do código não tem `0/O` nem `1/I/L`: ele é lido numa tela e digitado noutra.

Cada ponte tem id único, nome, plataforma e versão. Plataforma e versão são **dado, não prova** —
servem para você reconhecer qual máquina é qual.

## Permissões

Nenhuma vem concedida no pareamento. Você autoriza **ação por ação**, e cada ação tem capacidade
própria:

| Ação                   | Nível | Altera |
| ---------------------- | ----- | ------ |
| `REVIT_GET_PROJECT`    | READ  | não    |
| `REVIT_READ_MODEL`     | READ  | não    |
| `REVIT_EXPORT`         | WRITE | sim    |
| `REVIT_CREATE_ELEMENT` | WRITE | sim    |
| `REVIT_UPDATE_ELEMENT` | WRITE | sim    |
| `VSCODE_OPEN_FILE`     | READ  | não    |

Todas exigem `BRIDGE_CONNECT`, e as que mexem no modelo exigem também `REVIT_READ_MODEL` — não se
altera o que não se pode ler.

Autorizar uma não autoriza outra, nem do mesmo adaptador. Ler o modelo não abre exportar.

`REVIT_EXPORT` não muda o modelo e ainda assim passa por simulação: ela escreve arquivo no disco, e
você precisa ver onde ele vai cair antes de ele cair lá.

## Simulação, antes de qualquer alteração

Toda ação marcada `altera` passa por uma simulação obrigatória:

```
Serão criados 14 elementos no modelo.
[Cancelar]  [Visualizar alterações]  [Autorizar]
```

`Visualizar` mostra item a item — com o valor atual ao lado do novo, quando é alteração. Existe
porque **aprovar um número não é aprovar uma mudança**: "14 elementos" e "1400 elementos" chegam
como a mesma frase, e a diferença só aparece quando alguém conta.

A simulação carrega a **impressão digital** do estado que a ponte leu. Na execução, ela recalcula:

- impressão diferente → `PLANO_DIVERGENTE`. Alguém mexeu no modelo entre simular e autorizar, e o
  que você aprovou deixou de existir.
- plano ausente da memória da ponte → `PLANO_AUSENTE`. Inclusive depois de um reinício: a ponte
  reiniciada não honra autorização antiga, porque não pode mais garantir que aquela leitura ainda
  descreve o modelo.
- plano vencido (15 minutos) → recusa.

O plano vive **na memória da ponte que o fez**. Um `planoId` inventado pelo servidor não encontra
nada — e isso foi verificado com a ponte rodando, não só no teste de unidade.

## Estado e revogação

A ponte bate a cada 10 segundos, junto com a busca por tarefa. Tolerância de três batidas antes de
sair de `online` — rede ruim perde uma batida sem a ponte ter caído, e um indicador que pisca é um
indicador em que ninguém acredita.

Revogar faz a ponte descobrir na próxima busca: o servidor responde `403` e ela sai sozinha. **O
Pathly não consegue encerrar um programa na sua máquina** — o que ele faz é parar de responder.

## Revit: o que existe e o que não existe

O adaptador do Revit é um **contrato**, não uma automação.

A API do Revit é .NET e só existe **dentro** do processo dele — a Autodesk não expõe HTTP. O
caminho certo é um add-in em C# que suba um pequeno servidor local e converse com a ponte. Esse
add-in **não existe ainda**, e a ponte responde `ADAPTADOR_AUSENTE` até ele existir.

O que deliberadamente não foi feito: fingir automação por navegador, envio de teclas ou captura de
tela. Aquilo funciona na demonstração e corrompe o arquivo de alguém na segunda semana.

O VS Code, esse sim, funciona hoje: ele tem CLI.

## Outras ferramentas

O mesmo protocolo atende Blender (add-on em Python), SketchUp (extensão em Ruby), AutoCAD (plugin
.NET ou AutoLISP) e SolidWorks (add-in .NET). O que muda é o programa do outro lado — a ponte, a
simulação, a validação e a auditoria continuam as mesmas.

Uma ferramenta nova é uma linha em `ACOES`, com capacidade e schema de parâmetros, mais um
adaptador que implemente `disponivel`, `executar` e — quando altera — `simular` e
`impressaoAtual`.

## Auditoria

Toda tarefa fica em `pathly_ponte_tarefas` com o que foi pedido, o que voltou e o motivo da
recusa. Os atos vão para `pathly_hub_auditoria` com `provedor = 'ponte:<id>'` — a mesma trilha do
resto do Hub.

O conteúdo do resultado **não** vai para a auditoria: ela guarda o ato, não o dado.

## Provado por

**160 asserções, 0 falhas** (`bateria-ponte`), escritas para fazer a ponte obedecer o que não
devia.

E, o que vale mais, **a ponte rodando como processo contra um servidor hostil** — um servidor que
fala o protocolo e tenta abusar dela. 9 de 9:

| O que o servidor tentou                           | O que a ponte respondeu                        |
| ------------------------------------------------- | ---------------------------------------------- |
| `EXECUTAR_COMANDO` com `curl … \| sh`             | `ACAO_DESCONHECIDA`                            |
| `VSCODE_RUN_TASK` (inventada, com cara legítima)  | `ACAO_DESCONHECIDA`                            |
| caminho `../../../../Windows/System32/config/SAM` | `PARAMETRO_INVALIDO`                           |
| caminho absoluto `C:\Windows\win.ini`             | `PARAMETRO_INVALIDO`                           |
| parâmetro extra `comando: "rm -rf /"`             | `PARAMETRO_INVALIDO`                           |
| criar elemento sem simulação                      | `PLANO_AUSENTE`                                |
| plano forjado pelo servidor                       | `PLANO_AUSENTE`                                |
| tarefa vencida                                    | `TAREFA_VENCIDA`                               |
| abrir `package.json` (legítima)                   | tentou, e reportou que `code` não está no PATH |

## O que falta

1. **O add-in do Revit**, em C#. É a metade que não é do Pathly.
2. **Testar os endpoints** `/api/ponte` e `/api/ponte/codigo`: os dois precisam de
   `SUPABASE_SERVICE_ROLE_KEY`, que não está no `.env` deste ambiente. Pareamento e fila não foram
   exercitados contra o servidor real.
3. **As transições do gatilho** de `pathly_ponte_tarefas`, pela mesma razão.
