# Fontes de conteúdo — o que pode e o que não pode entrar no catálogo

Toda linha da tabela `resources` precisa de `source` e `source_license` preenchidos. Este arquivo
é a razão: nem toda fonte gratuita permite que a gente copie o conteúdo para dentro do produto.
Gratuito para ler não é o mesmo que livre para redistribuir.

## Não pode copiar

**roadmap.sh** (`nilbuild/developer-roadmap`, antigo `kamranahmedse`) — 93 roadmaps, 156 tópicos só
em back-end, com links curados e tipados. É a fonte mais rica que existe, e foi a primeira que
avaliamos. A licença proíbe:

> "You are allowed to use this material for personal use but are not allowed to use it for any
> other purpose including publishing... the content... in any form either digital, non-digital,
> textual, graphical or written formats. You are allowed to share the links to the repository or
> the website roadmap.sh but not the content."

Ou seja: **linkar para roadmap.sh é permitido, copiar o conteúdo não.** Se um dia alguém importar
esses arquivos para o banco, vira violação de direito autoral num produto pago.

**The Odin Project** (`TheOdinProject/curriculum`) — licença "NOASSERTION" no GitHub. Precisa de
leitura manual do arquivo de licença antes de qualquer uso. Não usar até isso ser feito.

## Pode usar

| Fonte                                    | Licença        | O que permite                                                        |
| ---------------------------------------- | -------------- | -------------------------------------------------------------------- |
| freeCodeCamp                             | BSD-3-Clause   | Uso comercial, com aviso de copyright preservado                     |
| free-programming-books (EbookFoundation) | CC-BY-4.0      | Uso comercial, com atribuição                                        |
| Curadoria própria                        | nossa          | Título e descrição escritos por nós, apontando para o link original  |
| YouTube Data API                         | ToS do YouTube | Metadados (título, canal, duração) exibidos conforme as regras deles |
| GitHub API                               | ToS do GitHub  | Metadados de repositório (fatos: nome, estrelas, licença)            |

## A regra prática

Link e fato não são protegidos: a URL de um curso gratuito, o nome do canal, o título do vídeo.
O que é protegido é o **texto curado** de terceiros — a descrição que outra pessoa escreveu, a
ordem editorial que ela montou.

Então o catálogo do Pathly aponta para conteúdo de terceiros com descrição escrita por nós,
em vez de importar a descrição deles.
