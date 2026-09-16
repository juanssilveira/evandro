# Spec 004 — Video Upload & Library

## Objetivo

Implementar a primeira biblioteca real de vídeos do WatchMap, permitindo que o usuário:

* envie um vídeo MP4 diretamente para Cloudflare R2;
* registre o vídeo na Account atual;
* visualize os vídeos da Account em `/videos`.

---

## Decisões

O upload deve seguir:

```text
Browser
   ↓
Presigned PUT URL
   ↓
Cloudflare R2
```

O arquivo não deve passar pelo servidor Next.js.

O servidor é responsável por:

* autenticar o usuário;
* resolver a Account atual;
* gerar o `videoId`;
* gerar a object key;
* gerar a presigned URL;
* validar o objeto após o upload;
* criar o registro no banco.

Nesta versão utilizar upload PUT simples.

Não implementar multipart/resumable upload ainda.

Aceitar inicialmente apenas:

```text
video/mp4
```

---

## Storage

Utilizar bucket privado no Cloudflare R2.

Object key:

```text
accounts/{accountId}/videos/{videoId}/source.mp4
```

Não utilizar filename como object key.

Não armazenar URL temporária/presigned URL no banco.

Centralizar integração R2 em:

```text
src/lib/r2.ts
```

Variáveis server-side:

```text
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
```

Adicionar em `.env.example`.

Credenciais R2 nunca devem chegar ao browser.

O bucket deve possuir CORS permitindo `PUT` a partir dos ambientes utilizados pelo WatchMap e o header `Content-Type`.

---

## Banco

Criar tabela:

```text
videos
```

Campos:

```text
id
account_id
title
storage_key
original_filename
mime_type
size_bytes
created_at
updated_at
```

Regras:

```text
id              UUID
account_id      FK → accounts.id
title           NOT NULL
storage_key     NOT NULL + UNIQUE
original_filename NOT NULL
mime_type       NOT NULL
size_bytes      NOT NULL
```

`account_id` deve usar `ON DELETE CASCADE`.

Criar índice para a listagem:

```text
(account_id, created_at)
```

Atualizar `docs/DATABASE.md` para refletir o modelo implementado.

---

## Fluxo de upload

### 1. Preparação

Usuário seleciona um arquivo MP4.

A interface permite definir:

```text
title
file
```

O título deve iniciar preenchido com o nome do arquivo sem `.mp4`.

### 2. Criar upload

O browser solicita ao servidor uma URL de upload enviando apenas os metadados necessários do arquivo.

O servidor:

```text
session
  ↓
current Account
  ↓
validate file metadata
  ↓
generate videoId
  ↓
derive storage key
  ↓
generate presigned PUT URL
```

A presigned URL deve possuir validade curta e restringir o `Content-Type` esperado.

Retornar ao client:

```text
videoId
uploadUrl
```

Não criar ainda o registro em `videos`.

### 3. Upload

O browser envia o arquivo diretamente para a presigned URL.

Exibir progresso percentual do upload.

O request deve enviar exatamente o `Content-Type` utilizado ao gerar a assinatura.

### 4. Finalização

Após sucesso no R2, o browser solicita a finalização do upload informando:

```text
videoId
title
originalFilename
sizeBytes
```

O servidor deve:

```text
authenticate
↓
resolve current Account
↓
derive storage key novamente
↓
HEAD object no R2
↓
confirmar que o objeto existe
↓
criar registro em videos
```

Nunca aceitar `storage_key` ou `account_id` fornecidos pelo client.

A finalização deve ser segura para retry: chamadas repetidas para o mesmo `videoId` não podem criar registros duplicados.

---

## Biblioteca

Atualizar:

```text
/videos
```

para listar exclusivamente os vídeos da Account atual.

Ordenação:

```text
created_at DESC
```

A página deve possuir:

```text
Vídeos                         [Enviar vídeo]
```

Cada vídeo deve mostrar inicialmente:

* título;
* tamanho do arquivo;
* data de criação.

Ainda não existe thumbnail nem player nesta spec.

---

## Upload UI

O botão:

```text
Enviar vídeo
```

abre a interface de upload.

Ela deve permitir:

* selecionar ou arrastar um único MP4;
* visualizar nome e tamanho do arquivo;
* editar o título;
* iniciar upload;
* visualizar progresso;
* visualizar erro;
* visualizar conclusão.

Durante o upload, impedir submissão duplicada.

Após sucesso:

```text
upload concluído
↓
fechar/resetar interface
↓
atualizar biblioteca
```

Seguir `docs/DESIGN.md`.

---

## Estado vazio

Quando a Account não possuir vídeos:

```text
Nenhum vídeo ainda

Envie seu primeiro vídeo para começar.

[Enviar vídeo]
```

---

## Critérios de aceite

* [ ] tabela `videos` e migration criadas;
* [ ] `docs/DATABASE.md` atualizado;
* [ ] integração R2 centralizada e server-only;
* [ ] usuário consegue selecionar um MP4;
* [ ] presigned URL é gerada somente para usuário autenticado;
* [ ] Account é determinada no servidor;
* [ ] upload acontece diretamente Browser → R2;
* [ ] arquivo não passa pelo servidor Next.js;
* [ ] progresso do upload é exibido;
* [ ] finalização verifica o objeto no R2 antes de criar `videos`;
* [ ] upload mal sucedido não cria registro de vídeo;
* [ ] retry da finalização não duplica registros;
* [ ] `/videos` lista somente vídeos da Account atual;
* [ ] estado vazio funciona;
* [ ] todos os checks obrigatórios passam;
* [ ] milestone é finalizado conforme `AGENTS.md`.

Não implemente funcionalidades além das especificadas.