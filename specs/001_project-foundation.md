# Spec 001 — Project Foundation

## Objetivo

Criar a fundação técnica do WatchMap Beta seguindo as decisões definidas em:

* `AGENTS.md`
* `docs/PRODUCT.md`
* `docs/ARCHITECTURE.md`
* `docs/DATABASE.md`
- `docs/DESIGN.md`

Ao final desta spec, o projeto deve estar inicializado, configurado, conectado ao PostgreSQL e pronto para receber as próximas funcionalidades.

Esta spec não deve implementar funcionalidades de produto.

---

# Escopo

Implementar:

* aplicação Next.js;
* TypeScript strict;
* pnpm;
* Tailwind CSS;
* shadcn/ui;
* Lucide Icons;
* Drizzle ORM;
* Drizzle Kit;
* conexão com PostgreSQL hospedado na Neon;
* Better Auth instalado e estruturalmente preparado;
* Zod;
* estrutura inicial de diretórios;
* gerenciamento de variáveis de ambiente;
* scripts fundamentais de desenvolvimento e validação;
* página inicial mínima para validar que a aplicação está funcionando.

---

# Fora do escopo

Não implementar nesta spec:

* login;
* signup;
* logout;
* páginas autenticadas;
* criação de contas WatchMap;
* listagem de vídeos;
* upload;
* player;
* Evandro;
* analytics;
* billing;
* dashboard;
* navegação final da aplicação;
* design final.

A configuração de Better Auth pode ser preparada, mas os fluxos de autenticação pertencem à próxima spec.

---

# Stack obrigatória

Utilizar:

```text
Next.js 16
React 19
TypeScript
pnpm

Tailwind CSS 4
shadcn/ui
Lucide Icons

PostgreSQL
Neon
Drizzle ORM
Drizzle Kit

Better Auth
Zod
```

Não substituir nenhuma dessas tecnologias sem atualizar previamente `docs/ARCHITECTURE.md`.

---

# Inicialização

Criar o projeto Next.js utilizando:

* App Router;
* TypeScript;
* `src/`;
* Tailwind CSS;
* Turbopack;
* import alias `@/*`.

A aplicação deve funcionar com:

```bash
pnpm dev
```

---

# TypeScript

Habilitar modo estrito.

O projeto deve permanecer livre de:

```text
any
@ts-ignore
@ts-nocheck
```

salvo situação excepcional e documentada.

---

# Estrutura inicial

Criar inicialmente:

```text
src/
├── app/
├── components/
├── db/
├── lib/
└── types/
```

Dentro de `src/db`:

```text
src/db/
├── index.ts
└── schema/
```

Não criar diretórios adicionais sem necessidade concreta.

---

# Banco de dados

## Conexão

Configurar conexão com PostgreSQL utilizando Neon e Drizzle.

A conexão deve ficar centralizada em:

```text
src/db/index.ts
```

Nenhum componente ou módulo deve criar conexões independentes diretamente.

---

## Variável de ambiente

Utilizar:

```text
DATABASE_URL
```

A variável deve existir em:

```text
.env.example
```

sem valor secreto real.

Exemplo:

```text
DATABASE_URL=
```

---

# Drizzle

Configurar:

```text
drizzle.config.ts
```

O schema deve apontar para:

```text
src/db/schema/
```

Configurar scripts para:

```text
db:generate
db:migrate
db:studio
```

Não criar tabelas de domínio nesta etapa além das estritamente necessárias para preparar Better Auth, caso exigido pela configuração adotada.

As tabelas definitivas serão implementadas nas specs correspondentes.

---

# Better Auth

Instalar e preparar Better Auth para utilização com:

* Next.js;
* PostgreSQL;
* Drizzle Adapter.

Separar claramente:

```text
configuração server-side
cliente browser, quando necessário futuramente
```

Nenhuma interface de login deve ser criada nesta spec.

A integração deve ficar preparada para que a próxima spec implemente autenticação sem reestruturar a aplicação.

---

# Variáveis de ambiente

Criar:

```text
.env.example
```

Contendo todas as variáveis atualmente necessárias, sem valores reais.

No mínimo:

```text
DATABASE_URL=
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=
```

Segredos reais nunca devem ser versionados.

Garantir que arquivos locais de ambiente estejam protegidos pelo `.gitignore`.

---

# UI

Configurar Tailwind CSS e shadcn/ui corretamente.

Adicionar apenas os componentes shadcn necessários para validar a instalação.

Não instalar grande quantidade de componentes antecipadamente.

A identidade visual definitiva do WatchMap não faz parte desta spec.

---

# Página inicial

Criar uma página mínima em:

```text
/
```

Objetivo:

* confirmar que a aplicação renderiza;
* confirmar que Tailwind funciona;
* identificar visualmente que o projeto é WatchMap Beta.

Conteúdo suficiente:

```text
WatchMap Beta
Project foundation running.
```

Não construir landing page.

Não criar dashboard fictício.

---

# Health check

Criar um Route Handler:

```text
GET /api/health
```

Resposta esperada:

```json
{
  "status": "ok"
}
```

O objetivo é possuir um endpoint mínimo para validar que a aplicação está respondendo corretamente em desenvolvimento e produção.

Não incluir informações sensíveis.

---

# Scripts

O `package.json` deve possuir scripts equivalentes a:

```text
dev
build
start
lint
typecheck

db:generate
db:migrate
db:studio
```

Os comandos exatos podem seguir as ferramentas instaladas.

---

# Qualidade

A implementação deve passar por:

```bash
pnpm typecheck
pnpm lint
pnpm build
```

Todos devem finalizar sem erros.

Não ignorar erros apenas para permitir o build.

---

# Dependências

Adicionar somente dependências necessárias para esta spec.

Não adicionar antecipadamente:

* TanStack Query;
* Zustand;
* Redux;
* Redis;
* BullMQ;
* tRPC;
* upload SDKs;
* analytics SDKs;
* player libraries;
* bibliotecas de charts.

---

# Segurança

Garantir:

* nenhum segredo exposto no client;
* nenhuma variável sensível com `NEXT_PUBLIC_`;
* `.env` ignorado pelo Git;
* configuração do banco executada somente no servidor;
* módulos server-only não importados por Client Components.

---

# Critérios de aceite

A spec está concluída quando:

* [ ] projeto Next.js está criado com App Router;
* [ ] pnpm é utilizado como package manager;
* [ ] TypeScript strict está ativo;
* [ ] Tailwind funciona;
* [ ] shadcn/ui está configurado;
* [ ] Lucide Icons está instalado;
* [ ] Drizzle está configurado;
* [ ] conexão com Neon está preparada;
* [ ] `drizzle.config.ts` existe;
* [ ] estrutura `src/db/schema/` existe;
* [ ] Better Auth está instalado e preparado;
* [ ] Zod está instalado;
* [ ] `.env.example` existe;
* [ ] `/` renderiza corretamente;
* [ ] `/api/health` responde com `status: ok`;
* [ ] scripts de banco existem;
* [ ] `pnpm typecheck` passa;
* [ ] `pnpm lint` passa;
* [ ] `pnpm build` passa;
* [ ] nenhuma funcionalidade fora do escopo foi implementada.