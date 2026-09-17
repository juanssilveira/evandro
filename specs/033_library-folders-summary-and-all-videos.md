# Spec 033 — Library Folders Summary and All Videos

## Objetivo

Refinar a página `/videos` para que ela fique mais útil e informativa.

Esta spec deve:
- fazer a seção de vídeos listar todos os vídeos da conta na Biblioteca, inclusive os que estão dentro de pastas;
- indicar em cada card de vídeo em qual pasta ele está;
- melhorar visualmente a seção de pastas;
- melhorar visualmente o cabeçalho das seções "Pastas" e "Vídeos".

Não implementar funcionalidades fora disso.

## Escopo

### 1. Biblioteca: seção de vídeos deve listar todos os vídeos da conta

Na página raiz da Biblioteca (`/videos`), a seção "Vídeos" não deve mais mostrar apenas vídeos soltos na raiz.

Ela deve listar:
- vídeos sem pasta;
- vídeos que estão dentro de pastas.

Ou seja:
a listagem da Biblioteca deve ser uma visão geral de todos os vídeos da conta.

Importante:
- isso vale para a Biblioteca principal;
- não alterar o comportamento de telas específicas de pasta, caso exista rota específica para exibir apenas os vídeos de uma pasta.

### 2. Busca e filtros devem atuar sobre todos os vídeos da Biblioteca

A busca da seção "Vídeos" deve funcionar sobre a lista completa da Biblioteca.

Ou seja:
ao buscar, deve considerar todos os vídeos da conta, independentemente de estarem ou não dentro de pasta.

O mesmo vale para:
- ordenação;
- filtros já existentes;
- contagem total da seção.

### 3. Card de vídeo deve indicar a pasta

Na Biblioteca principal, quando um vídeo estiver dentro de uma pasta, o card deve mostrar isso de forma explícita.

Adicionar uma badge de pasta no card do vídeo com:
- nome da pasta;
- cor da pasta.

Diretrizes:
- a badge deve reutilizar a cor configurada da pasta;
- precisa ser fácil de identificar visualmente;
- deve parecer informação secundária, sem competir com o título do vídeo.

Se o vídeo não estiver em nenhuma pasta:
- não precisa inventar badge obrigatória;
- pode não mostrar nada, ou mostrar "Sem pasta" apenas se já houver consistência visual e ficar bom.

### 4. Melhorar os cards de pasta

Os cards de pasta precisam ficar mais úteis e bonitos.

Cada card de pasta deve exibir:
- nome da pasta;
- quantidade de vídeos;
- armazenamento usado pela pasta;
- total de plays da pasta.

Essas métricas devem ser calculadas a partir dos vídeos vinculados à pasta.

Diretrizes:
- manter leitura simples;
- não transformar o card em dashboard pesado;
- dar mais sensação de utilidade e organização.

### 5. Estrutura visual do card de pasta

Melhorar a hierarquia visual dos cards de pasta.

Esperado:
- ícone/color chip da pasta;
- nome da pasta com destaque;
- linha secundária com resumo;
- métricas fáceis de bater o olho;
- menu de ações continua acessível.

As informações podem ser organizadas em uma estrutura semelhante a:
- nome;
- "X vídeos";
- "Y MB";
- "Z plays".

Não precisa seguir literalmente esse layout, mas o card deve ficar mais rico e bonito do que o atual.

### 6. Melhorar cabeçalhos das seções

Melhorar visualmente os cabeçalhos:
- Pastas;
- Vídeos.

Hoje o título + ícone estão fracos visualmente.

Ajustar:
- ícones;
- peso visual;
- alinhamento;
- spacing;
- tratamento do contador.

Objetivo:
deixar essas seções com aparência mais refinada e consistente com o restante do app.

### 7. Refinar a composição da página

Melhorar a disposição dos elementos da página `/videos`, especialmente:
- espaçamento entre cabeçalho da página, seção de pastas e seção de vídeos;
- equilíbrio visual entre ações e conteúdo;
- organização dos cards de pasta;
- leitura da tela como um todo.

Importante:
não reconstruir a página do zero.
É uma rodada de refinamento e melhoria de layout.

## Regras de implementação

- Reutilizar o design system já existente no projeto.
- Consultar os arquivos de design e instruções do projeto antes de alterar.
- Não inventar um estilo novo desconectado do resto do app.
- Se houver dúvida de UI, preferir uma solução simples, limpa e consistente.
- Não alterar a lógica de páginas específicas do vídeo.
- Não alterar a lógica central de folders além do necessário para suportar os novos resumos e a listagem completa na Biblioteca.

## Critérios de aceite

- [x] Na página `/videos`, a seção "Vídeos" lista todos os vídeos da conta, inclusive os que estão dentro de pastas.
- [x] Busca e filtros da Biblioteca funcionam sobre todos os vídeos.
- [x] Card de vídeo mostra a pasta quando o vídeo pertence a uma pasta.
- [x] A badge da pasta usa a cor da própria pasta.
- [x] Card de pasta mostra quantidade de vídeos.
- [x] Card de pasta mostra armazenamento usado.
- [x] Card de pasta mostra total de plays da pasta.
- [x] O design dos cards de pasta ficou mais útil e visualmente melhor.
- [x] O cabeçalho das seções "Pastas" e "Vídeos" foi refinado.
- [x] A composição geral da página `/videos` ficou mais organizada e bonita.