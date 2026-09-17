# Workflow de Versionamento e Deploy

Este documento detalha o fluxo oficial de desenvolvimento, controle de versão, migrações de banco e deploy dos ambientes do **WatchMap**.

---

## 1. Visão Geral dos Ambientes

O WatchMap opera com **dois ambientes isolados**, cada um mapeado para uma branch Git permanente e recursos de infraestrutura dedicados:

```text
┌─────────────────────────┐          ┌─────────────────────────┐
│       DEVELOPMENT       │ ───────► │       PRODUCTION        │
│      (Trabalho Local)   │          │       (Produção)        │
├─────────────────────────┤          ├─────────────────────────┤
│ Branch: development     │          │ Branch: main            │
│ App: localhost:3000     │          │ App: app.evandro.watch  │
│ Player CDN: local       │          │ Player CDN: cdn.evandro │
│ DB: Neon development    │          │ DB: Neon production     │
│ Storage: dev bucket     │          │ Storage: prod bucket    │
└─────────────────────────┘          └─────────────────────────┘
```

> [!IMPORTANT]
> **Regra de Isolamento Absoluto:**
> Nenhum ambiente pode utilizar credenciais, banco de dados ou storage de outro ambiente como fallback. Se alguma variável de ambiente obrigatória estiver ausente, a aplicação deve falhar de forma explícita.

---

## 2. As Branches Oficiais

| Branch | Tipo | Finalidade | Deploy Automático |
| :--- | :--- | :--- | :--- |
| `development` | Padrão / Trabalho | Desenvolvimento ativo local, novas specs, correções e refactors | Local |
| `main` | Produção | Versão estável em uso pelos clientes finais | `https://app.evandro.watch` + CDN |

* **Default Branch do GitHub:** `development` (evita que PRs ou ferramentas apontem diretamente para produção por engano).

---

## 3. Ciclo de Vida de uma Tarefa / Spec

Todo desenvolvimento ocorre **exclusivamente** na branch `development`.

```text
[Verificar branch 'development']
               │
               ▼
[Implementar código & specs]
               │
               ▼
[Executar verificações locais] (typecheck, lint, build, migrations)
               │
               ▼
[Commit único da spec] ──► spec(XXX): descrição curta
               │
               ▼
[Push para o remote] ────► git push origin development
```

### Comandos do ciclo local:
```bash
# 1. Garantir que está na branch correta
git checkout development

# 2. Executar validações de qualidade
pnpm typecheck
pnpm lint
pnpm build

# 3. Gerar migrations caso tenha alterado schemas em src/db/schema/
pnpm db:generate
pnpm db:migrate

# 4. Commit padronizado e push
git add .
git commit -m "spec(XXX): description of feature"
git push origin development
```

---

## 4. Pipeline Automatizado de Build & Migrations

Ao disparar o build (seja localmente ou na Vercel), o comando configurado em `package.json` é:

```bash
pnpm build
# Executa em sequência:
# 1. pnpm build:embed -> Compila Tailwind e gera o bundle web component em /public/embed/v1/
# 2. pnpm db:migrate  -> Aplica automaticamente as migrations pendentes de ./drizzle no Neon do ambiente
# 3. next build       -> Compila a aplicação Next.js e otimiza páginas estáticas
```

Com isso, sempre que um deploy ocorre em `main`, o banco correspondente é atualizado antes da inicialização do servidor.

---

## 5. Promoção para Produção

A promoção de `development → main` é uma operação intencional:

```bash
# 1. Garantir que o código em development foi completamente testado e commitado
git checkout main
git merge development --ff-only
git push origin main
git checkout development
```

1. A Vercel detecta o push na branch `main`, executa as migrations no **Neon Production** e publica em `https://app.evandro.watch` e no CDN do player (`https://cdn.evandro.watch`).
2. Retornar à branch `development` para os próximos trabalhos.

---

## 6. O que o Agente de IA Pode e Não Pode Fazer

### Permitido:
* Criar commits e dar push diretamente em `origin/development`.
* Executar promoção de `development → main` **somente quando receber ordem explícita** do usuário (ex: *"promover para produção"* ou *"promover para main"*).
* Gerar e aplicar migrations locais via `pnpm db:generate` e `pnpm db:migrate`.

### Proibido:
* Trabalhar ou comitar código diretamente na branch `main`.
* Promover ambientes automaticamente após finalizar specs.
* Usar `--force` ou `--force-with-lease` nas branches permanentes.
* Versionar arquivos de ambiente (`.env`, `.env.local`, etc.) ou segredos de credenciais.

