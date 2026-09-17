# 034 — Library Background Context Menu

## Objetivo

Adicionar um menu contextual personalizado ao fundo da Biblioteca `/videos`.

Quando o usuário clicar com o botão direito em uma área livre da página — sem estar sobre vídeo, pasta ou controle interativo — abrir um menu contextual do WatchMap.

Primeiras ações:

- Nova pasta
- Enviar vídeo

A estrutura deve permitir adicionar novas ações futuramente sem reconstruir o componente.

---

## 1. Área de ativação

Na rota:

`/videos`

o clique com botão direito em uma área vazia da área principal da Biblioteca deve abrir o menu contextual.

Considerar como área válida:

- fundo da Biblioteca;
- espaço vazio entre elementos;
- áreas livres das seções de conteúdo.

Não abrir este menu quando o clique ocorrer sobre:

- card de vídeo;
- card de pasta;
- context menu existente;
- botão;
- input;
- select;
- toolbar;
- link;
- modal/dialog;
- qualquer outro elemento interativo.

Esses elementos devem preservar seus próprios comportamentos.

---

## 2. Prioridade dos context menus

A hierarquia deve ser:

### Clique direito em vídeo

Abrir:

`VideoContextMenu`

### Clique direito em pasta

Abrir:

`FolderContextMenu`

### Clique direito no fundo da Biblioteca

Abrir:

`LibraryContextMenu`

Nunca abrir dois menus simultaneamente.

O evento do vídeo ou pasta deve impedir propagação para o menu global da Biblioteca.

---

## 3. Menu da Biblioteca

Criar um componente reutilizável:

`LibraryContextMenu`

Primeiras ações:

`Nova pasta`

`Enviar vídeo`

Sugestão visual:

`Nova pasta`
ícone de folder/add

`Enviar vídeo`
ícone de upload

Separadores podem ser usados futuramente quando existirem grupos de ações.

---

## 4. Nova pasta

Ao clicar em:

`Nova pasta`

deve abrir exatamente o fluxo/modal de criação de pasta já existente.

Não duplicar:

- estado;
- formulário;
- validação;
- mutation;
- modal.

O context menu deve apenas acionar o fluxo existente.

---

## 5. Enviar vídeo

Ao clicar em:

`Enviar vídeo`

deve abrir exatamente o UploadDialog já existente.

Não criar outro modal ou fluxo de upload.

---

## 6. Comportamento do menu

Seguir o mesmo padrão dos context menus existentes.

O menu deve:

- abrir próximo ao cursor;
- permanecer dentro da viewport;
- fechar ao clicar fora;
- fechar com Escape;
- fechar em scroll;
- fechar em resize;
- fechar após selecionar uma ação;
- possuir animação curta e discreta.

O clique que abre o menu deve impedir o menu nativo do navegador somente quando estiver dentro da área elegível da Biblioteca.

---

## 7. Visual

Reutilizar o mesmo design dos context menus de vídeo e pasta:

- background;
- border;
- radius;
- shadow;
- padding;
- tamanho dos items;
- icons;
- hover;
- typography.

Não criar um terceiro padrão visual de context menu.

O menu deve parecer parte nativa da aplicação.

---

## 8. Arquitetura extensível

Preparar o componente para receber novas ações futuramente.

Evitar uma implementação rigidamente acoplada apenas a dois botões.

Preferir uma estrutura conceitual de ações como:

- id;
- label;
- icon;
- action;
- separator/group opcional;
- disabled opcional.

Isso deve permitir futuramente adicionar ações como:

- ordenar;
- criar outros recursos;
- importar;
- atualizar;
- ações administrativas;

sem precisar reconstruir o menu.

Não implementar essas ações agora.

---

## 9. Áreas vazias dentro das seções

O menu também deve funcionar quando o usuário clicar no espaço vazio dentro da área de conteúdo da Biblioteca.

Exemplo:

- abaixo dos cards;
- ao lado dos cards;
- espaço vazio do grid.

Desde que o alvo real não seja um componente interativo.

---

## 10. Browser context menu

Fora da área da Biblioteca, preservar o comportamento padrão do navegador.

Não aplicar bloqueio global de `contextmenu` em:

- document;
- window;
- aplicação inteira.

O tratamento deve estar limitado ao container da Biblioteca.

---

## 11. Mobile

Essa funcionalidade é primariamente desktop.

Não implementar long press customizado em touch nesta versão.

As ações continuam disponíveis normalmente através dos botões existentes.

---

## 12. Não alterar

Não alterar:

- criação de pasta;
- upload;
- card de vídeo;
- card de pasta;
- banco;
- rotas;
- drag and drop;
- filtros;
- busca;
- menu contextual existente dos vídeos;
- menu contextual existente das pastas.

Somente integrar o novo contexto da Biblioteca.

---

## Critérios de aceite

- Clique direito em área vazia de `/videos` abre menu personalizado.
- Menu possui `Nova pasta`.
- Menu possui `Enviar vídeo`.
- `Nova pasta` reutiliza o modal existente.
- `Enviar vídeo` reutiliza o UploadDialog existente.
- Clique direito em vídeo continua abrindo menu do vídeo.
- Clique direito em pasta continua abrindo menu da pasta.
- Nunca aparecem dois context menus simultaneamente.
- Clique direito em input, botão ou toolbar não abre o menu da Biblioteca.
- Menu respeita os limites da viewport.
- Menu fecha com Escape.
- Menu fecha ao clicar fora.
- Menu fecha em scroll/resize.
- Menu fecha após selecionar uma ação.
- Fora da Biblioteca, menu nativo do navegador continua funcionando.
- Estrutura permite adicionar novas ações facilmente no futuro.