# WatchMap — Database

## Objetivo

Este documento define as convenções e o modelo de dados fundamentais do WatchMap.

O banco principal é PostgreSQL, hospedado inicialmente na Neon e acessado pela aplicação através do Drizzle ORM.

O modelo deve permanecer simples, relacional e portável.

---

# Princípios

## PostgreSQL é a fonte de verdade

Dados persistentes do WatchMap devem possuir representação explícita no PostgreSQL.

Não depender de estado mantido exclusivamente no frontend ou em serviços externos.

---

## Dados pertencem a contas

Recursos do produto pertencem a uma `account`, não diretamente a um usuário.

```text
User
  ↓
Account Member
  ↓
Account
  ↓
Resources
```

Essa relação deve ser preservada em todo novo recurso que possua propriedade dentro da plataforma.

---

## Autenticação separada do domínio

As tabelas necessárias ao Better Auth são responsabilidade da camada de autenticação.

Exemplos:

```text
user
session
account
verification
```

O conceito `account` utilizado internamente pelo Better Auth para provedores de autenticação não deve ser confundido com a entidade de negócio `accounts` do WatchMap.

As tabelas de domínio do WatchMap devem permanecer explicitamente separadas das tabelas gerenciadas pelo Better Auth.

---

# Convenções

## Nomes

Banco:

```text
snake_case
```

TypeScript:

```text
camelCase
```

Exemplo:

```text
created_at  → createdAt
account_id  → accountId
```

O Drizzle deve realizar esse mapeamento de forma explícita no schema.

---

## IDs

Entidades de domínio do WatchMap devem utilizar UUID.

Gerar IDs na aplicação utilizando APIs criptograficamente seguras.

Não utilizar IDs numéricos sequenciais para recursos expostos pela aplicação.

Exemplo:

```text
550e8400-e29b-41d4-a716-446655440000
```

---

## Timestamps

Persistir timestamps em UTC.

Tabelas de domínio devem utilizar, quando aplicável:

```text
created_at
updated_at
```

A apresentação em timezone local pertence à interface.

---

## Valores monetários

Quando valores monetários forem adicionados futuramente, nunca utilizar ponto flutuante.

A representação será definida na spec correspondente.

---

# Modelo inicial

O domínio inicial possui três entidades:

```text
accounts
account_members
videos
```

Além das tabelas gerenciadas pelo Better Auth.

---

# accounts

Representa uma conta do WatchMap.

É a principal unidade de propriedade e isolamento dos dados.

## Campos

```text
id
name
created_at
updated_at
```

### id

UUID.

Primary key.

### name

Nome da conta.

Obrigatório.

### created_at

Data de criação.

Obrigatório.

### updated_at

Data da última atualização.

Obrigatório.

---

# account_members

Relaciona usuários autenticados às contas do WatchMap.

```text
USER
  ↓
ACCOUNT_MEMBER
  ↓
ACCOUNT
```

## Campos

```text
id
account_id
user_id
role
created_at
```

### id

UUID.

Primary key.

### account_id

Foreign key para:

```text
accounts.id
```

Obrigatório.

### user_id

Identificador do usuário gerenciado pelo Better Auth.

Obrigatório.

### role

Papel básico do usuário dentro da conta.

Valores inicialmente suportados:

```text
owner
member
```

Não implementar sistema avançado de permissões nesta camada.

### created_at

Data em que o usuário passou a integrar a conta.

---

## Restrições

Um usuário não pode possuir duas associações com a mesma conta.

Criar constraint única:

```text
UNIQUE(account_id, user_id)
```

---

## Exclusão

Se uma conta for excluída:

```text
account_members
→ ON DELETE CASCADE
```

Se um usuário for excluído:

```text
account_members
→ ON DELETE CASCADE
```

---

# videos

Representa um vídeo pertencente a uma conta WatchMap.

Upload, processamento e armazenamento físico não fazem parte deste modelo.

A entidade representa o vídeo dentro do domínio da aplicação independentemente de onde o arquivo estiver armazenado.

## Campos

```text
id
account_id
title
storage_key
original_filename
mime_type
size_bytes
debug_enabled
created_at
updated_at
```

### id

UUID.

Primary key.

### account_id

Conta proprietária do vídeo.

Foreign key para:

```text
accounts.id
```

Obrigatório.

### title

Nome apresentado ao usuário.

Obrigatório.

### storage_key

Caminho do objeto no storage (ex: accounts/{accountId}/videos/{videoId}/source.mp4).

Obrigatório e único.

### original_filename

Nome original do arquivo enviado pelo usuário.

Obrigatório.

### mime_type

Tipo MIME do arquivo (ex: video/mp4).

Obrigatório.

### size_bytes

Tamanho do arquivo em bytes.

Obrigatório.

### debug_enabled

Indica se os logs de debug do Player Runtime estão habilitados para o vídeo no console do navegador.

Booleano. Default: `false`.

Obrigatório.

### created_at

Data de criação.

Obrigatório.

### updated_at

Data da última atualização.

Obrigatório.

---

## Exclusão

Se uma conta for excluída:

```text
videos
→ ON DELETE CASCADE
```

---

# Relacionamentos

Modelo inicial:

```text
Better Auth User
       │
       ▼
account_members
       │
       ▼
    accounts
       │
       ▼
     videos
```

Relações:

```text
User 1 ─── N Account Members

Account 1 ─── N Account Members

Account 1 ─── N Videos
```

Um usuário pode futuramente pertencer a múltiplas contas.

Uma conta pode possuir múltiplos usuários.

---

# Índices

Criar índices apenas para padrões reais de consulta.

Modelo inicial:

```text
account_members.user_id
account_members.account_id

videos.account_id
videos.created_at
```

Para a listagem principal de vídeos, considerar índice composto:

```text
(account_id, created_at)
```

Novos índices devem surgir a partir de necessidades reais de consulta.

---

# Integridade

Foreign keys devem ser utilizadas para relacionamentos estruturais.

Não depender apenas da aplicação para manter integridade relacional.

Constraints devem ser utilizadas quando uma regra puder ser garantida diretamente pelo banco.

Exemplos:

```text
NOT NULL
UNIQUE
FOREIGN KEY
```

---

# Autorização

O fato de um recurso possuir um `account_id` não significa que o cliente possa determinar qual conta acessar.

Exemplo incorreto:

```text
GET /videos?account_id=abc
```

e confiar diretamente nesse identificador.

Fluxo correto:

```text
authenticated user
       ↓
account_members
       ↓
authorized account
       ↓
videos
```

Toda consulta privada deve respeitar essa relação.

---

# Drizzle

Schemas do banco devem ficar centralizados em:

```text
src/db/schema/
```

Estrutura inicial esperada:

```text
src/db/
├── index.ts
└── schema/
    ├── auth.ts
    ├── accounts.ts
    └── videos.ts
```

`auth.ts` contém a integração das tabelas exigidas pelo Better Auth.

`accounts.ts` contém:

```text
accounts
account_members
```

`videos.ts` contém:

```text
videos
```

Não criar um arquivo por tabela quando entidades fizerem parte clara do mesmo domínio.

---

# Migrations

Toda mudança estrutural deve ser versionada através do Drizzle Kit.

Fluxo:

```text
schema
  ↓
migration
  ↓
database
```

Nunca alterar manualmente o banco de produção sem refletir a alteração no schema e nas migrations do projeto.

---

# Seed

Dados de desenvolvimento podem ser criados através de um processo explícito de seed.

O seed pode inicialmente criar:

```text
1 usuário de desenvolvimento
1 conta
membership owner
alguns vídeos de teste
```

Nunca executar seeds automaticamente em produção.

---

# Evolução

Novas tabelas devem ser adicionadas somente quando a funcionalidade correspondente for especificada.

Não criar antecipadamente tabelas para:

* player;
* tracking;
* sessões;
* eventos;
* analytics;
* conversões;
* billing;
* uploads;
* storage.

Esses modelos serão definidos quando suas respectivas funcionalidades forem implementadas.