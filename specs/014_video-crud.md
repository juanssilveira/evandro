# Spec 014 — Video CRUD

## Objetivo

Completar o CRUD básico de vídeos do WatchMap adicionando:

- edição do título;
- visualização de informações básicas;
- exclusão definitiva do vídeo.

Upload, listagem e visualização já existentes devem permanecer inalterados.

## Edição

Permitir editar somente:

```text
title
```

Regras:

- obrigatório;
- aplicar trim;
- não aceitar título vazio;
- máximo de 120 caracteres.

Não permitir substituir o arquivo de vídeo neste milestone.

## Informações do vídeo

Na interface de edição, exibir também informações somente leitura:

- nome original do arquivo;
- tamanho;
- tipo do arquivo;
- data de envio.

Essas informações servem apenas como contexto e não podem ser editadas.

Estrutura conceitual:

```text
Editar vídeo

Título
[ Minha VSL                         ]

Informações
Nome original     video.mp4
Tamanho           35.15 MB
Tipo              video/mp4
Enviado em        16/09/2026 13:47

[Cancelar] [Salvar alterações]
```

`Salvar alterações` é a ação Primary do dialog.

## Persistência da edição

A alteração deve:

```text
authenticated user
      ↓
current Account
      ↓
videoId + accountId
      ↓
update title
```

Nunca atualizar um vídeo apenas pelo `videoId` sem validar a Account atual.

Após salvar:

- fechar o dialog;
- atualizar título na interface;
- refletir alteração na biblioteca e página individual;
- não exigir reload manual.

## Exclusão

Adicionar ação:

```text
Excluir vídeo
```

A exclusão é definitiva.

Antes de executar, abrir confirmação:

```text
Excluir "{video.title}"?

O vídeo e suas configurações serão removidos permanentemente.
Esta ação não pode ser desfeita.

[Cancelar] [Excluir vídeo]
```

`Excluir vídeo` deve utilizar a variante `Destructive`.

## Fluxo de exclusão

O servidor deve resolver o vídeo através de:

```text
session
  ↓
current Account
  ↓
videoId + accountId
```

O `storage_key` utilizado para remover o arquivo do R2 deve vir do registro encontrado no servidor.

Nunca aceitar `storage_key` enviado pelo frontend.

Fluxo:

```text
validar autorização
      ↓
obter video + storage_key
      ↓
deletar registro de videos
      ↓
cascade das relações dependentes
      ↓
remover objeto correspondente do R2
```

Se a remoção do objeto no R2 falhar depois da exclusão do banco:

- não recriar o vídeo;
- não manter o vídeo visível na aplicação;
- registrar o erro para diagnóstico;
- não expor detalhes internos ao usuário.

Arquivos órfãos poderão ser tratados futuramente por um mecanismo próprio de cleanup.

## Cascades

As relações existentes que pertencem exclusivamente ao vídeo devem utilizar o comportamento já definido no banco.

Atualmente isso inclui pelo menos:

```text
video_player_settings
```

Não implementar manualmente deleções redundantes quando a foreign key com cascade já resolver.

## Interface

Disponibilizar ações de vídeo através de um menu contextual:

```text
⋯
├── Editar
└── Excluir
```

O menu deve existir na biblioteca de vídeos.

As mesmas ações podem também estar disponíveis na página individual do vídeo quando fizer sentido, reutilizando a mesma lógica.

Não utilizar botões Primary repetidos em cada card da biblioteca.

## Após exclusão

Se o vídeo for excluído a partir da biblioteca:

```text
permanecer em /videos
↓
remover item da listagem
```

Se for excluído a partir de:

```text
/videos/[videoId]
```

redirecionar para:

```text
/videos
```

## Estados

Edição e exclusão devem possuir:

- loading;
- prevenção de submissão duplicada;
- feedback de erro;
- feedback visual de conclusão quando necessário.

Durante uma exclusão em andamento, o usuário não deve conseguir disparar a mesma operação novamente.

## Critérios de aceite

- título do vídeo pode ser editado;
- informações básicas aparecem como somente leitura;
- título vazio não pode ser salvo;
- alteração aparece sem reload manual;
- usuário pode excluir um vídeo;
- existe confirmação antes da exclusão;
- exclusão utiliza variante Destructive;
- vídeos de outra Account não podem ser editados;
- vídeos de outra Account não podem ser excluídos;
- `storage_key` é resolvido exclusivamente no servidor;
- exclusão remove o registro do banco;
- `video_player_settings` é removido via cascade;
- arquivo correspondente é removido do R2;
- falha de cleanup no R2 não recria o vídeo;
- excluir pela página individual redireciona para `/videos`;
- funcionalidades existentes continuam funcionando;
- checks obrigatórios passam.

Não implemente funcionalidades além das especificadas.