# Spec 003 — Account Domain

## Objetivo

Implementar o domínio de contas do WatchMap.

Ao final desta spec:

* todo usuário do WatchMap deve possuir uma Account;
* o usuário deve estar associado à Account através de `account_members`;
* o primeiro usuário da Account deve possuir role `owner`;
* páginas autenticadas devem conseguir resolver a Account atual do usuário no servidor.

Esta spec não implementa gerenciamento de contas ou equipes.

---

## Modelo

Implementar as entidades já definidas em `docs/DATABASE.md`:

```text
Better Auth User
       │
       ▼
account_members
       │
       ▼
    accounts
```

---

# accounts

Implementar:

```text
accounts
```

Campos:

```text
id
name
created_at
updated_at
```

Regras:

* `id`: UUID;
* `name`: obrigatório;
* timestamps em UTC.

---

# account_members

Implementar:

```text
account_members
```

Campos:

```text
id
account_id
user_id
role
created_at
```

Roles inicialmente permitidas:

```text
owner
member
```

Criar constraint:

```text
UNIQUE(account_id, user_id)
```

Relacionamentos:

```text
account_id → accounts.id
user_id    → Better Auth user.id
```

Utilizar cascade conforme definido em `docs/DATABASE.md`.

---

# Schema

Criar:

```text
src/db/schema/accounts.ts
```

Exportar o novo schema através da estrutura já existente em:

```text
src/db/schema/index.ts
```

Não modificar desnecessariamente os schemas do Better Auth.

---

# Migration

Gerar migration Drizzle correspondente.

A migration deve criar:

```text
accounts
account_members
```

com:

* primary keys;
* foreign keys;
* constraints;
* índices necessários.

Aplicar a migration no ambiente de desenvolvimento Neon antes de concluir o milestone.

---

# Provisionamento inicial

Quando um usuário ainda não possuir nenhuma Account, criar automaticamente:

```text
Account
+
Account Member
```

em uma única transaction.

Fluxo:

```text
User
 ↓
nenhuma membership?
 ↓
create Account
 ↓
create Account Member
    role = owner
```

A criação de `account` e `account_member` deve ser atômica.

Se qualquer uma das operações falhar:

```text
rollback
```

---

## Nome inicial

Utilizar inicialmente o nome do usuário como nome da Account.

Exemplo:

```text
User:
Juan Silveira

Account:
Juan Silveira
```

Não criar fluxo de escolha ou edição do nome nesta spec.

---

# Novos usuários

Integrar o provisionamento com a criação de novos usuários do Better Auth.

Pode utilizar o lifecycle apropriado do Better Auth para iniciar:

```text
provisionInitialAccount(user)
```

A lógica de domínio não deve ficar escrita diretamente dentro da configuração de autenticação.

A configuração do Better Auth apenas chama a função responsável pelo provisionamento.

---

# Atomicidade

Não assumir que:

```text
Better Auth User
+
WatchMap Account
```

fazem parte da mesma transaction.

O usuário pode já ter sido criado quando o provisionamento da Account ocorrer.

Portanto, o provisionamento deve ser seguro para ser executado novamente quando necessário.

---

# Usuários existentes

Usuários criados antes deste milestone também precisam receber uma Account.

Ao entrar na área autenticada, se o usuário não possuir membership:

```text
authenticated user
      ↓
no account membership
      ↓
provisionInitialAccount()
      ↓
continue
```

Isso funciona também como mecanismo de recuperação caso o provisionamento inicial tenha falhado.

Se uma membership já existir:

```text
no-op
```

Nunca criar uma nova Account para um usuário que já possui membership apenas porque a função foi chamada novamente.

---

# Serviço de domínio

Centralizar a lógica de Account fora da UI e fora da configuração do Better Auth.

Estrutura sugerida:

```text
src/lib/accounts.ts
```

Responsabilidades:

```text
provisionInitialAccount()
getCurrentAccount()
```

Evitar espalhar queries de resolução de Account por componentes diferentes.

---

# Account atual

No estágio atual do WatchMap, um usuário criado pela plataforma possuirá apenas uma Account.

Criar uma forma server-side de resolver:

```text
authenticated user
       ↓
account_members
       ↓
current account
```

Exemplo conceitual:

```text
getCurrentAccount(userId)
```

Não receber `account_id` do frontend para resolver a Account atual.

---

## Múltiplas Accounts

A estrutura do banco deve continuar permitindo que um usuário pertença futuramente a múltiplas Accounts.

Entretanto, seleção/troca de Account não faz parte desta spec.

Não implementar:

```text
active_account_id
workspace switcher
account selector
cookies de account
```

Enquanto múltiplas Accounts não puderem ser criadas pela aplicação, a Account existente é considerada a Account atual.

---

# Área autenticada

Integrar a resolução/provisionamento da Account à área autenticada existente.

O fluxo deve ser:

```text
request
 ↓
session
 ↓
user
 ↓
account membership
 ↓
Account
 ↓
private application
```

Usuário sem sessão continua sendo enviado para:

```text
/login
```

Usuário autenticado sem Account deve ser provisionado automaticamente.

---

# /videos

Atualizar temporariamente `/videos` apenas o suficiente para validar o domínio.

Exibir:

```text
Vídeos

Conta: {account.name}
```

Não implementar a biblioteca real ainda.

---

# Segurança

A Account atual deve sempre ser determinada através da relação:

```text
session.user.id
      ↓
account_members.user_id
      ↓
accounts.id
```

Nunca confiar em:

```text
account_id
```

enviado diretamente pelo navegador para determinar acesso.

---

# Fora do escopo

Não implementar:

* criação manual de Accounts;
* edição da Account;
* exclusão;
* múltiplas Accounts pela interface;
* troca de Account;
* convite de membros;
* gerenciamento de membros;
* alteração de roles;
* permissões avançadas;
* vídeos reais;
* upload;
* player;
* Evandro;
* billing.

---

# Validação manual

## Novo usuário

```text
/signup
→ criar usuário
→ Account criada
→ membership criada
→ role owner
→ /videos
→ nome da Account visível
```

---

## Usuário existente

Utilizar usuário criado antes da Spec 003:

```text
login
→ nenhuma membership existente
→ Account criada automaticamente
→ membership owner
→ /videos
```

---

## Usuário já provisionado

```text
login
→ Account já existe
→ nenhuma nova Account criada
```

Recarregar `/videos` repetidamente não pode criar novas Accounts ou memberships.

---

## Banco

Confirmar:

```text
1 user
1 account
1 account_member
```

para o fluxo inicial.

Confirmar também:

```text
account_members.role = owner
```

---

# Critérios de aceite

* [ ] `accounts` existe;
* [ ] `account_members` existe;
* [ ] foreign keys estão corretas;
* [ ] constraint de membership única existe;
* [ ] migration foi gerada;
* [ ] migration foi aplicada no Neon development;
* [ ] novo usuário recebe Account automaticamente;
* [ ] primeiro membro recebe role `owner`;
* [ ] usuário existente sem Account é provisionado;
* [ ] provisionamento é seguro para execução repetida;
* [ ] Account + membership são criadas na mesma transaction;
* [ ] usuário já provisionado não recebe outra Account;
* [ ] Account atual é resolvida server-side;
* [ ] `/videos` mostra o nome da Account;
* [ ] nenhuma funcionalidade fora do escopo foi implementada;
* [ ] todos os checks do projeto passam.

---

## Milestone

Commit esperado:

```text
spec(003): account domain
```

Após validação, enviar o commit para o repositório remoto conforme `AGENTS.md`.
