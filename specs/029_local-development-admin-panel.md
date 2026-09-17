# 029 — Local Development Admin Panel

## Objetivo

Criar um painel administrativo interno para desenvolvimento, acessível somente em ambiente local, permitindo manipular usuários, planos, redeem codes e visualizar métricas gerais da plataforma.

Este painel NÃO possui login porque sua segurança depende do isolamento absoluto ao ambiente local.

A proteção contra exposição fora do localhost é o requisito mais crítico desta spec.

---

## 1. Regra crítica — Localhost Only

Criar o painel em:

```text
/dev
```

Ele deve ficar fora do layout autenticado normal da aplicação.

O painel só pode funcionar quando TODAS as condições abaixo forem verdadeiras:

```text
NODE_ENV === "development"
APP_ENV === "development"
DEV_PANEL_ENABLED === "true"
host === localhost
OU host === 127.0.0.1
OU host === [::1]
```

Também deve rejeitar execução quando:

```text
process.env.VERCEL
```

estiver presente.

Qualquer outra situação deve resultar em `404`.

Isso inclui:

- production;
- Vercel production;
- Vercel preview;
- `next start`;
- domínio público;
- IP da rede local;
- qualquer host diferente de loopback.

O painel não deve possuir link em nenhuma parte da aplicação normal.

---

## 2. Fail Closed

Criar uma função central, por exemplo:

```text
assertLocalDevPanelAccess()
```

Toda operação administrativa deve obrigatoriamente passar por essa função.

Não proteger apenas a página.

O guard deve existir também em:

- Server Actions;
- handlers;
- APIs internas, caso existam;
- qualquer função capaz de alterar dados através do painel.

Se a validação falhar:

```text
não executar nenhuma query ou mutation
```

Nunca confiar em validação client-side.

---

## 3. Estrutura do painel

Criar uma interface simples com três áreas:

```text
Overview
Usuários
Redeem Codes
```

Usar o design system existente, mas deixar visualmente claro que se trata de uma ferramenta interna.

Exibir permanentemente algo como:

```text
DEV ONLY · LOCALHOST
```

---

# Overview

## 4. Métricas gerais

Mostrar informações úteis da operação de desenvolvimento:

- total de usuários;
- total de contas;
- usuários com plano ativo;
- usuários sem plano;
- total de vídeos;
- vídeos ready;
- vídeos processing;
- total de Plays no mês atual;
- volume total de arquivos enviados;
- duração total dos vídeos hospedados.

Para volume de mídia, utilizar os dados já persistidos em `sizeBytes`.

Não apresentar esse número como custo ou storage faturável do Mux.

Pode ser exibido como:

```text
Mídia enviada
4.8 GB
```

---

## 5. Uso por conta

Exibir uma tabela com as contas.

Mostrar:

- usuário/email principal;
- nome da conta;
- plano;
- status;
- validade, quando existir;
- quantidade de vídeos;
- Plays no mês;
- volume total enviado;
- duração total dos vídeos.

Exemplo:

```text
Email            Plano    Vídeos    Plays    Mídia     Validade
user@email.com   Pro      3 / 10    420      1.2 GB    20/10/2026
```

Essa tela é somente uma visão administrativa dos dados existentes.

---

# Usuários

## 6. Listagem

Mostrar os usuários existentes com:

- nome;
- email;
- data de criação;
- conta;
- plano atual;
- expiração do plano;
- uso de vídeos;
- Plays no mês.

Permitir selecionar um usuário para ações administrativas.

---

## 7. Criar usuário

Permitir criação manual através do painel.

Campos:

- nome;
- email;
- senha inicial.

A criação deve usar o Better Auth existente.

Não inserir senha diretamente no banco.
Não implementar hashing manual.
Não criar sistema paralelo de autenticação.

O fluxo deve preservar os hooks já existentes de criação de usuário e provisionamento de conta.

---

## 8. Manipular plano

Para um usuário existente permitir:

```text
Sem plano
Pro sem vencimento
Pro com vencimento
```

Para acesso temporário permitir definir:

- quantidade de dias;
ou
- data de expiração.

Reutilizar a mesma lógica central de subscriptions utilizada pelo restante da aplicação.

Evitar criar regras de plano exclusivas para o painel.

Ao remover plano:

```text
subscription ativa → inactive
```

Ao conceder Pro:

```text
planCode = pro
status = active
```

E:

```text
expiresAt = null
```

para acesso permanente, ou a data correta para acesso temporário.

---

# Redeem Codes

## 9. Geração

Permitir gerar redeem codes pelo painel usando exatamente a mesma lógica criada na spec 028.

Campos:

- plano;
- duração em dias.

Como atualmente existe apenas Pro, ele pode vir selecionado por padrão.

Após gerar:

- mostrar o código original uma única vez;
- permitir copiar;
- informar duração.

O banco continua armazenando apenas o hash.

Não criar uma segunda implementação de redeem code específica para o painel.

---

## 10. Listagem de códigos

Mostrar códigos existentes sem revelar o valor original.

Exibir:

- criado em;
- plano;
- duração;
- status;
- utilizado em;
- utilizado por.

Status:

```text
Disponível
Utilizado
```

Como o código original não está persistido, não tentar reconstruí-lo ou exibi-lo novamente.

---

# Segurança

## 11. Sem autenticação

O painel não deve exigir login.

Isso é permitido SOMENTE porque ele deve ser impossível de acessar fora do ambiente local de desenvolvimento.

Não adicionar bypass de autenticação à aplicação normal.

Não transformar `/dev` em um painel administrativo de produção.

---

## 12. Isolamento dos endpoints

Nenhuma mutation administrativa deve ficar acessível através de uma rota pública sem o guard local.

Mesmo que alguém descubra o nome de uma Server Action ou endpoint, a operação deve falhar fora do ambiente permitido.

Toda mutation deve validar novamente o ambiente no servidor imediatamente antes de acessar o banco.

---

## 13. Ambiente explícito

Adicionar suporte a:

```env
APP_ENV=development
DEV_PANEL_ENABLED=true
```

No ambiente de produção:

```env
APP_ENV=production
```

`DEV_PANEL_ENABLED` não deve ser configurado na Vercel.

Nunca assumir que `NODE_ENV` sozinho é proteção suficiente.

---

## 14. Não misturar bancos

O painel deve operar utilizando o banco configurado no ambiente Development.

Não adicionar qualquer mecanismo para selecionar ou trocar para o banco Production através da interface.

Não permitir informar `DATABASE_URL` pelo painel.

O painel nunca deve possuir funcionalidade de conexão com produção.

---

## Critérios de aceite

- `/dev` funciona em `next dev` através de localhost.
- `/dev` funciona em `127.0.0.1`.
- `/dev` retorna 404 fora de Development.
- `/dev` retorna 404 em Vercel.
- `/dev` retorna 404 quando acessado por IP da rede local.
- Nenhuma mutation funciona sem passar pelo guard local.
- Painel não exige login.
- Não existe link para `/dev` na aplicação normal.
- É possível criar usuário manualmente.
- Criação de usuário reutiliza Better Auth.
- É possível conceder, remover e configurar expiração do Pro.
- É possível gerar redeem codes.
- Redeem code reutiliza a lógica da spec 028.
- Existe visão geral de usuários, contas, vídeos, Plays, volume e duração.
- Existe visão de uso por conta.
- Nenhuma funcionalidade permite acessar ou selecionar produção.