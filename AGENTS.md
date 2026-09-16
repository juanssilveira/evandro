# WatchMap — Agent Instructions

Este repositório contém o desenvolvimento do WatchMap.

## Regra principal

Antes de implementar ou alterar qualquer funcionalidade:

1. Leia os documentos relevantes em `/docs` (`00-PRODUCT.md`, `01-ARCHITECTURE.md`, `02-MODEL.md`, `03-DESIGN.md`).
2. Leia integralmente a spec da tarefa atual em `/specs`.
3. Respeite as decisões arquiteturais já existentes.
4. Implemente somente o que foi solicitado.
5. Leia `docs/03-DESIGN.md` antes de criar ou modificar interfaces.

## Princípios de desenvolvimento

* Preferir soluções simples e explícitas.
* Não criar abstrações prematuras.
* Não implementar funcionalidades futuras sem solicitação.
* Não duplicar código ou componentes existentes.
* Não adicionar dependências sem necessidade real.
* Utilizar TypeScript de forma estrita.
* Não utilizar `any` para contornar problemas de tipagem.
* Segurança e autorização devem ser validadas no servidor.
* Nunca confiar em IDs ou permissões enviados pelo frontend.
* Manter componentes pequenos e responsabilidades bem separadas.
* Nunca fazer referência a infraestruturas internas ou nomes de serviços e provedores (ex: Cloudflare R2, S3, AWS, PostgreSQL, Drizzle, etc.) em textos de interface, diálogos, alertas ou mensagens voltadas ao usuário final.
* Toda vez que alterar o banco ou schemas, gerar e aplicar as migrations no ambiente de desenvolvimento (`pnpm db:generate` e `pnpm db:migrate`).

## Qualidade

Antes de considerar uma tarefa concluída:

* se houver alterações de banco/schema, gerar e aplicar as migrations (`pnpm db:migrate`);
* executar typecheck;
* executar lint;
* executar build;
* corrigir todos os erros encontrados.

Uma feature só está concluída quando todos os critérios de aceite definidos em sua spec forem atendidos.

## Git e Milestones

Cada spec representa um milestone de desenvolvimento.

### Git Workflow e Ambientes

* Toda implementação de specs ocorre na branch `development`.
* Commits de milestone são criados na branch `development`.
* O agente pode fazer push apenas para `development` durante o desenvolvimento normal.
* A branch `stage` recebe código somente por promoção/merge de `development`.
* A branch `main` (production) recebe código somente por promoção/merge de `stage`.
* Nunca fazer push direto para `stage` ou `main` como parte da implementação de uma spec.
* Nunca realizar merge entre ambientes automaticamente sem instrução explícita.
* Production (`main`) deve receber exatamente o código previamente validado em `stage`.

### Finalização de Milestones

Ao concluir integralmente uma spec:

1. validar todos os critérios de aceite;
2. executar os checks de qualidade do projeto;
3. revisar os arquivos alterados;
4. criar um único commit na branch `development` representando a conclusão da spec;
5. enviar o commit para o repositório remoto (`development`).

Utilizar o padrão:

```text
spec(XXX): descrição curta
```

Exemplos:

```text
spec(001): project foundation
spec(002): authentication
spec(003): account domain
spec(004): video library
```

O commit de milestone só deve ser criado quando a spec estiver concluída e validada.

Não incluir alterações não relacionadas à spec no commit.

Se o push não puder ser realizado por falta de configuração, autenticação ou acesso ao remoto, informar claramente o bloqueio em vez de alterar a configuração Git sem autorização.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
