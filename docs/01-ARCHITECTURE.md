# WatchMap — Architecture

## Objetivo

Este documento define as decisões técnicas fundamentais do WatchMap.

Decisões específicas de funcionalidades pertencem às respectivas specs.

A arquitetura deve priorizar:

* simplicidade;
* baixo vendor lock-in;
* segurança;
* performance;
* boa experiência de desenvolvimento;
* facilidade de manutenção;
* compatibilidade com desenvolvimento assistido por agentes;
* evolução incremental.

---

# Stack principal

## Aplicação

* Next.js 16
* React 19
* TypeScript
* App Router
* Turbopack

## Interface

* Tailwind CSS 4
* shadcn/ui
* Lucide Icons

## Banco de dados

* PostgreSQL
* Neon como infraestrutura PostgreSQL
* Drizzle ORM
* Drizzle Kit para migrations

## Autenticação

* Better Auth
* Drizzle Adapter
* sessões persistidas no PostgreSQL

## Validação

* Zod

## Package manager

* pnpm

---

# Princípio de portabilidade

Sempre que possível, o WatchMap deve depender de padrões e tecnologias portáveis em vez de recursos proprietários de fornecedores.

Exemplo:

```text
Application
    ↓
Drizzle
    ↓
PostgreSQL
    ↓
Neon
```

Neon é o provedor atual do PostgreSQL, não parte do domínio da aplicação.

A substituição futura do provedor de banco não deve exigir alterações significativas na lógica do produto.

O mesmo princípio deve ser considerado ao escolher novos serviços de infraestrutura.

---

# Server-first

Utilizar Server Components por padrão.

Um componente só deve utilizar `"use client"` quando realmente depender de comportamento exclusivo do navegador, como:

* estado interativo;
* eventos do usuário;
* APIs do browser;
* hooks client-side;
* WatchMap Player.

Não transformar páginas ou grandes árvores de componentes em Client Components sem necessidade.

---

# Banco acessado pelo servidor

Operações sobre dados privados devem acontecer no servidor.

Fluxo padrão:

```text
Browser
   ↓
Next.js Server
   ↓
Authentication
   ↓
Authorization
   ↓
Drizzle
   ↓
PostgreSQL
```

O frontend nunca deve ser considerado uma barreira de segurança.

---

# Autenticação e autorização

Better Auth é responsável por autenticação:

```text
Quem é este usuário?
```

WatchMap é responsável por autorização:

```text
A quais contas este usuário pertence?

Quais recursos ele pode acessar?
```

Autenticação não substitui autorização.

Toda operação privada deve validar no servidor a associação do usuário com a conta correspondente.

---

# Multi-tenancy

A unidade principal de propriedade dos dados é `account`.

```text
User
  ↓
Account Member
  ↓
Account
  ↓
Resources
```

Recursos da plataforma pertencem a uma conta.

Exemplo:

```text
Account
├── Videos
├── Players
├── Sessions
├── Analytics
└── futuras configurações
```

Nunca determinar acesso somente a partir de um `account_id` recebido do cliente.

O servidor deve validar a associação entre usuário e conta.

---

# Estrutura base

```text
src/
├── app/
├── components/
├── db/
├── lib/
└── types/
```

Novas pastas devem ser adicionadas apenas quando existir necessidade concreta.

---

# Route Groups

Utilizar Route Groups para separar contextos da aplicação sem alterar URLs.

Estrutura esperada:

```text
src/app/
├── (auth)/
│   └── login/
│
└── (app)/
    ├── videos/
    └── settings/
```

---

# Server Components

São o padrão.

Utilizar para:

* leitura de dados;
* autenticação;
* autorização;
* composição de páginas;
* renderização inicial.

---

# Client Components

Devem permanecer pequenos e próximos da funcionalidade interativa.

Exemplos:

* dropdown;
* modal;
* formulário interativo;
* WatchMap Player;
* APIs específicas do navegador.

Evitar `"use client"` em páginas ou layouts inteiros quando apenas uma pequena parte precisa dele.

---

# Leitura de dados

Para páginas privadas, preferir acesso direto no servidor:

```text
Server Component
      ↓
Query / Service
      ↓
Drizzle
      ↓
PostgreSQL
```

Não criar endpoints HTTP internos apenas para que o próprio servidor consulte seus dados.

---

# Mutações

Para mutações originadas pela interface da aplicação, utilizar Server Actions quando adequado.

Toda mutação deve:

1. validar autenticação;
2. validar autorização;
3. validar entrada;
4. executar a operação;
5. retornar um resultado previsível.

---

# Route Handlers

Utilizar Route Handlers quando existir uma interface HTTP real.

Exemplos futuros:

```text
/api/auth/...
/api/events/...
/api/player/...
/api/webhooks/...
```

Não criar APIs internas sem necessidade.

---

# Validação

Toda entrada externa deve ser considerada não confiável.

Utilizar Zod nas fronteiras do sistema.

Exemplos:

* formulários;
* parâmetros;
* Server Actions;
* Route Handlers;
* webhooks;
* eventos do Evandro.

Nunca depender apenas de validação do frontend.

---

# Banco de dados

## ORM

Drizzle é a camada padrão de acesso ao PostgreSQL.

SQL direto pode ser utilizado quando existir justificativa técnica clara, especialmente futuramente em processamento analítico.

Não criar abstrações adicionais sobre Drizzle sem necessidade.

---

## Conexão

Utilizar o driver oficial da Neon adequado ao ambiente de execução.

A conexão deve ser centralizada em:

```text
src/db/
```

A aplicação não deve espalhar criação de conexões pelo código.

---

## Migrations

Toda alteração estrutural do banco deve possuir migration versionada.

Utilizar Drizzle Kit.

Não modificar manualmente o schema de produção sem refletir a alteração no repositório.

---

## IDs

Entidades da aplicação devem utilizar identificadores não sequenciais adequados para exposição pública.

A estratégia exata será definida em `DATABASE.md`.

Não assumir IDs numéricos incrementais nas interfaces públicas.

---

## Datas

Persistir timestamps em UTC.

Conversão para timezone pertence à camada de apresentação.

---

# Autenticação

Better Auth será a camada de autenticação do WatchMap.

Dados de autenticação e sessões devem permanecer no PostgreSQL utilizado pela aplicação.

A integração com o banco deve utilizar o adapter oficial do Drizzle.

A autenticação deve permanecer separada das regras de domínio e autorização do WatchMap.

---

# UI

## Tailwind

Tailwind CSS será o sistema principal de estilização.

Evitar:

* CSS inline desnecessário;
* duplicação de estilos;
* sistemas paralelos de styling;
* valores arbitrários repetidos.

---

## shadcn/ui

shadcn/ui será a fundação para componentes comuns.

Exemplos:

* Button
* Input
* Dialog
* Dropdown
* Tooltip
* Skeleton
* Table

Os componentes pertencem ao projeto e podem ser adaptados ao design do WatchMap.

Não instalar componentes que ainda não estão sendo utilizados.

---

# Estado

Não adicionar biblioteca global de estado inicialmente.

Preferir:

```text
Server State → Server Components
URL State    → search params
Local State  → React
```

Adicionar Zustand, Redux ou alternativa somente quando surgir uma necessidade concreta.

---

# Data fetching client-side

Não adicionar TanStack Query por padrão.

Preferir Server Components.

Adicionar sincronização client-side apenas quando alguma funcionalidade realmente exigir:

* polling;
* cache client-side;
* atualizações frequentes;
* optimistic updates;
* sincronização em background.

---

# Estrutura de domínio

Não concentrar regras de negócio dentro de componentes React.

Quando necessário:

```text
UI
 ↓
Action / Service
 ↓
Domain logic
 ↓
Database
```

Não criar camadas vazias apenas para seguir padrões arquiteturais.

---

# Tipagem

TypeScript deve operar em modo estrito.

Evitar:

* `any`;
* type assertions desnecessárias;
* duplicação manual de tipos;
* tipos excessivamente genéricos.

Sempre que possível, derivar tipos das fontes reais.

---

# Variáveis de ambiente

Todas as variáveis necessárias devem ser documentadas em:

```text
.env.example
```

Segredos nunca devem possuir prefixo `NEXT_PUBLIC_`.

Somente valores realmente necessários no navegador podem ser públicos.

---

# Segurança

Princípios obrigatórios:

* autenticação no servidor;
* autorização no servidor;
* validação de entradas;
* isolamento entre contas;
* mínimo privilégio;
* segredos somente no servidor;
* nenhuma confiança em dados enviados pelo frontend.

Ocultar elementos da interface nunca deve ser considerado mecanismo de autorização.

---

# Dependências

Antes de adicionar uma dependência:

1. verificar se a plataforma já resolve o problema;
2. verificar se uma dependência existente resolve;
3. avaliar se a complexidade adicionada é justificável.

Evitar dependências para funcionalidades triviais.

---

# Infraestrutura

Priorizar serviços que:

* possuam free tier adequado ao estágio atual;
* utilizem padrões portáveis;
* permitam migração futura;
* não introduzam lock-in desnecessário.

Cada nova dependência de infraestrutura deve ser adicionada somente quando existir necessidade concreta.

---

# Performance

Priorizar:

* Server Components;
* JavaScript mínimo no cliente;
* consultas específicas;
* carregamento progressivo;
* lazy loading quando apropriado;
* evitar waterfalls desnecessários.

Não introduzir complexidade antecipadamente apenas por possíveis necessidades futuras.

---

# Regra de evolução

Este documento contém decisões arquiteturais globais.

Uma spec pode detalhar a implementação de uma funcionalidade, mas não deve contradizer silenciosamente este documento.

Quando uma necessidade real exigir mudança arquitetural:

1. avaliar a mudança;
2. atualizar este documento;
3. implementar a nova abordagem.