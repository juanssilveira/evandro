# 026 — Library UI and Video Actions

## Objetivo

Melhorar visualmente a Biblioteca para que ela tenha aparência de um SaaS mais maduro, mantendo a interface limpa e funcional.

Não adicionar métricas ou blocos apenas para preencher espaço.

Também adicionar ações contextuais em cada vídeo.

Antes de implementar, consultar o material de design e instruções existentes no projeto.

---

## 1. Estrutura da Biblioteca

Manter a Biblioteca como página principal de gestão dos vídeos.

Estrutura:

- título "Biblioteca";
- texto curto de apoio;
- botão "Enviar vídeo";
- toolbar da biblioteca;
- listagem dos vídeos.

Não trazer novamente informações de plano para esta página.

---

## 2. Toolbar

Adicionar uma toolbar acima da listagem contendo:

- busca por nome do vídeo;
- filtro por status;
- ordenação.

Ordenações iniciais:

- Mais recentes;
- Mais antigos;
- Nome.

Usar componentes e padrões já existentes no projeto.

---

## 3. Cards de vídeo

Melhorar os cards atuais sem transformar a página em um dashboard.

Cada vídeo deve apresentar de forma clara:

- thumbnail/poster;
- título;
- nome do arquivo quando disponível;
- duração;
- status;
- Plays do mês daquele vídeo;
- última atualização.

O card inteiro continua sendo o ponto principal para abrir/editar o vídeo.

Melhorar:

- hierarquia tipográfica;
- espaçamento;
- bordas;
- estados de hover;
- alinhamento das informações;
- consistência entre cards.

Evitar excesso de badges ou informação visual.

---

## 4. Menu contextual do vídeo

Ao clicar com o botão direito sobre um card de vídeo, impedir o menu padrão do navegador naquele card e abrir um menu contextual próprio na posição do cursor.

Ações iniciais:

- Baixar;
- Editar;
- Excluir.

### Editar

Abrir o mesmo fluxo/página de edição já existente.

### Excluir

Reutilizar o fluxo de exclusão existente.

A ação deve continuar exigindo confirmação antes da exclusão definitiva.

Apresentar "Excluir" como ação destrutiva e visualmente separada das demais.

### Baixar

Usar o mecanismo de download disponível para o vídeo.

Não criar uma implementação falsa ou baixar uma URL inadequada apenas para preencher a funcionalidade.

Se a arquitetura atual não possuir um arquivo/rendition realmente disponível para download, identificar essa dependência antes de inventar uma solução nova.

---

## 5. Comportamento do menu

O menu contextual deve:

- abrir próximo ao cursor;
- permanecer dentro da viewport;
- fechar ao clicar fora;
- fechar com Escape;
- fechar após selecionar uma ação;
- não disparar a navegação normal do card ao abrir ou usar uma ação.

O clique esquerdo normal no vídeo continua funcionando como atualmente.

O clique direito fora de um vídeo não deve ser alterado.

---

## 6. Estados da página

Revisar visualmente:

- loading;
- biblioteca vazia;
- busca sem resultados;
- erro;
- vídeos em processamento.

Esses estados devem seguir o mesmo design da aplicação.

---

## Direção visual

A tela deve parecer uma ferramenta profissional de gestão de vídeos.

Priorizar:

- boa densidade de informação;
- hierarquia clara;
- alinhamento;
- consistência;
- interações discretas;
- aparência de produto SaaS.

Não adicionar gráficos, métricas gerais, banners ou cards decorativos nesta etapa.

Não redesenhar a página individual do vídeo.

---

## Critérios de aceite

- Biblioteca possui toolbar de busca, filtro e ordenação.
- Cards possuem melhor hierarquia e informações úteis.
- Plays exibidos no card são referentes ao próprio vídeo.
- Clique esquerdo mantém comportamento atual.
- Clique direito em um vídeo abre menu próprio.
- Menu possui Baixar, Editar e Excluir.
- Editar reutiliza fluxo existente.
- Excluir reutiliza confirmação existente.
- Menu funciona corretamente nos limites da viewport.
- Página individual do vídeo não foi redesenhada.
- Informações de plano não retornaram à Biblioteca.