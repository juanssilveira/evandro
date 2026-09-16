# WatchMap — Agent Instructions

Este repositório contém o desenvolvimento do WatchMap.

## Regra principal

Antes de implementar ou alterar qualquer funcionalidade:

1. Leia os documentos relevantes em `/docs` (`00-PRODUCT.md`, `01-ARCHITECTURE.md`, `02-MODEL.md`, `03-DESIGN.md`, `ENVIRONMENTS.md`, `WORKFLOW.md`, `DEPLOYMENT-CDN.md`).
2. Leia integralmente a spec da tarefa atual em `/specs`.
3. Respeite as decisões arquiteturais já existentes.
4. Implemente somente o que foi solicitado.
5. Leia `docs/03-DESIGN.md` antes de criar ou modificar interfaces.
6. Leia `docs/DEPLOYMENT-CDN.md` ao trabalhar com infraestrutura, deploy, CDN ou embed.

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

## Git Workflow and Environments

### Branches oficiais

Existem apenas três branches permanentes do produto:

* `development`
* `stage`
* `main`

#### development

É a branch padrão de trabalho do projeto. Todo desenvolvimento normal deve acontecer nela.

Inclui:
* implementação de specs;
* correções;
* refactors;
* ajustes visuais;
* manutenção;
* novas funcionalidades.

O agente deve assumir `development` como branch padrão para qualquer trabalho de implementação. O repositório no GitHub também deve utilizar `development` como default branch.

Ambiente associado:
* Aplicação: `http://localhost:3000`
* Banco de dados: Neon development
* Storage: `watchmap-videos-development`

#### stage

É exclusivamente a branch de homologação.

Ambiente associado:
* Aplicação: `https://stage.evandro.watch`
* Banco de dados: Neon stage
* Storage: `watchmap-videos-stage`

`stage` recebe código somente através de promoção explícita de `development`. Nunca implementar funcionalidades ou criar commits normais de desenvolvimento diretamente em `stage`.

#### main

É exclusivamente a branch de produção.

Ambiente associado:
* Aplicação: `https://evandro.watch`
* Banco de dados: Neon production
* Storage: `watchmap-videos-production`

`main` recebe código somente através de promoção explícita de `stage`. Nunca implementar funcionalidades ou criar commits normais de desenvolvimento diretamente em `main`.

---

### Fluxo oficial

O único fluxo de promoção permitido é:

```text
development → stage → main
```

* Nunca promover diretamente `development → main`.
* Production (`main`) deve receber exatamente uma versão que tenha sido previamente validada em `stage`.

---

### Regra antes de iniciar qualquer implementação

Antes de modificar código, o agente deve verificar a branch atual. O estado esperado para desenvolvimento normal é `development`.

* Se estiver em `stage` ou `main`, não iniciar implementação diretamente nessa branch.
* Se o working tree estiver limpo, mudar para `development`.
* Se existirem alterações não commitadas que tornem a troca de branch insegura ou ambígua, não descartar, sobrescrever ou fazer stash automaticamente: parar e informar o estado encontrado.

---

### Specs e milestones

Toda spec deve ser implementada na branch `development`.

Ciclo de vida de milestone:
1. Ler `AGENTS.md`;
2. Ler documentação relevante em `/docs` (`00-PRODUCT.md`, `01-ARCHITECTURE.md`, `02-MODEL.md`, `03-DESIGN.md`, `ENVIRONMENTS.md`);
3. Ler a spec atual em `/specs`;
4. Implementar somente o escopo solicitado;
5. Validar completamente todos os critérios de aceite;
6. Executar os checks exigidos pelo projeto (migrations, typecheck, lint, build);
7. Criar um único commit da milestone;
8. Fazer push somente para `development`.

Formato do commit:

```text
spec(XXX): short description
```

Durante a implementação normal de uma spec:
* nunca fazer merge para `stage`;
* nunca fazer merge para `main`;
* nunca fazer push para `stage`;
* nunca fazer push para `main`.

A conclusão de uma spec significa apenas que ela está validada e publicada em `development`.

---

### Promoções

Promoções entre ambientes são operações estritamente separadas da implementação.

O agente só pode realizar:
* `development → stage`
* `stage → main`

quando receber instrução explícita do usuário para realizar aquela promoção específica.

* Nunca promover automaticamente após finalizar uma spec.
* Nunca interpretar frases genéricas como "terminou", "está funcionando" ou "pode finalizar" como autorização para promover ambiente. A autorização deve mencionar claramente a promoção ou o ambiente de destino.

#### Promoção para Stage

Quando solicitado explicitamente a promover para Stage:
1. Confirmar que a origem é `development`;
2. Confirmar que o working tree está limpo;
3. Confirmar que as alterações relevantes estão commitadas;
4. Atualizar referências remotas quando necessário;
5. Promover `development` para `stage`;
6. Não alterar `main`;
7. Publicar `stage` no remote (`origin/stage`);
8. Deixar claro qual commit/revisão foi promovido.

Não adicionar alterações funcionais durante a promoção. Se houver conflito, não resolver de forma especulativa: parar e reportar o conflito.

#### Promoção para Production

Quando solicitado explicitamente a promover para Production:
1. Confirmar que a origem da promoção é `stage`;
2. Confirmar que o working tree está limpo;
3. Confirmar que a revisão foi previamente validada em Stage;
4. Promover `stage` para `main`;
5. Publicar `main` no remote (`origin/main`);
6. Não introduzir alterações novas durante a promoção;
7. Deixar claro qual commit/revisão entrou em produção.

Nunca promover `development` diretamente para `main`. Se `main` possuir alterações que não existem em `stage`, parar e informar antes de continuar.

---

### Remote e Git Config

O remote oficial é denominado: `origin`.

Tracking esperado:
* `development` → `origin/development`
* `stage` → `origin/stage`
* `main` → `origin/main`

Durante o desenvolvimento normal, o push padrão é exclusivamente: `origin development`.

* Nunca utilizar `--force` ou `--force-with-lease` nas branches permanentes sem instrução explícita do usuário.
* Nunca reescrever histórico compartilhado automaticamente.

---

### GitHub Default Branch

A default branch do repositório no GitHub deve ser `development`.

Isso não altera a função da `main` (que continua sendo exclusivamente Production). A escolha de `development` como default branch existe para mitigar riscos de desenvolvimento ou Pull Requests serem direcionados acidentalmente para Production.

---

### Segurança de Secrets

Antes de qualquer primeiro push para um novo remote ou durante auditorias, confirmar que secrets não estão rastreados.

Nunca versionar:
* `.env`
* `.env.local`
* `.env.*.local`
* Credenciais Neon
* Credenciais Cloudflare R2
* `BETTER_AUTH_SECRET`
* Tokens ou chaves privadas
* Arquivos locais da Vercel (`.vercel/`)

O arquivo `.env.example` pode ser versionado desde que contenha somente nomes das variáveis e valores fictícios/seguros.

Se um secret for encontrado no histórico Git:
* não imprimir seu valor;
* não fazer push;
* não executar rewrite do histórico automaticamente;
* informar o arquivo e o tipo de credencial afetada.

---

### Isolamento de Ambientes

Nenhum ambiente pode utilizar recursos de outro ambiente como fallback.

* **Development:** Neon development + R2 development (`watchmap-videos-development`)
* **Stage:** Neon stage + R2 stage (`watchmap-videos-stage`)
* **Production:** Neon production + R2 production (`watchmap-videos-production`)

Se uma variável obrigatória estiver ausente, a aplicação deve falhar claramente. Nunca utilizar silenciosamente credenciais ou recursos de outro ambiente.

---

### Conduta do Agente

O agente não deve:
* criar branches adicionais sem necessidade explícita;
* trabalhar diretamente em `stage`;
* trabalhar diretamente em `main`;
* promover ambientes automaticamente;
* alterar configuração Git global;
* usar force push nas branches permanentes;
* descartar alterações locais do usuário;
* fazer reset destrutivo sem autorização;
* reescrever histórico compartilhado sem autorização.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
