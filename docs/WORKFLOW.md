# Workflow de Versionamento, Homologação e Deploy

Este documento detalha o fluxo oficial de desenvolvimento, controle de versão, migrações de banco e deploy dos ambientes do **WatchMap**.

---

## 1. Visão Geral dos Ambientes

O WatchMap opera estritamente com **três ambientes isolados**, cada um mapeado para uma branch Git permanente e recursos de infraestrutura dedicados:

```text
┌─────────────────────────┐     ┌─────────────────────────┐     ┌─────────────────────────┐
│       DEVELOPMENT       │ ──► │          STAGE          │ ──► │       PRODUCTION        │
│                         │     │      (Homologação)      │     │       (Produção)        │
├─────────────────────────┤     ├─────────────────────────┤     ├─────────────────────────┤
│ Branch: development     │     │ Branch: stage           │     │ Branch: main            │
│ App: localhost:3000     │     │ App: stage.evandro.watch│     │ App: evandro.watch      │
│ DB: Neon development    │     │ DB: Neon stage          │     │ DB: Neon production     │
│ Storage: dev bucket     │     │ Storage: stage bucket   │     │ Storage: prod bucket    │
└─────────────────────────┘     └─────────────────────────┘     └─────────────────────────┘
```

> [!IMPORTANT]
> **Regra de Isolamento Absoluto:**
> Nenhum ambiente pode utilizar credenciais, banco de dados ou storage de outro ambiente como fallback. Se alguma variável de ambiente obrigatória estiver ausente, a aplicação deve falhar de forma explícita.

---

## 2. As Branches Oficiais

| Branch | Tipo | Finalidade | Deploy Automático |
| :--- | :--- | :--- | :--- |
| `development` | Padrão / Trabalho | Desenvolvimento ativo, novas specs, correções e refactors | Local / Preview Vercel |
| `stage` | Homologação | Testes internos em ambiente espelho de produção | `https://stage.evandro.watch` |
| `main` | Produção | Versão estável em uso pelos clientes finais | `https://evandro.watch` |

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
git commit -m "spec(016): description of feature"
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

Com isso, sempre que um deploy ocorre em `stage` ou `main`, o banco correspondente é atualizado antes da inicialização do servidor.

---

## 5. Promoção de Ambientes (Passo a Passo)

As promoções entre ambientes são operações intencionais e ocorrem em duas etapas estritas:

### Etapa 1: Promoção de Development para Stage (Homologação)

Quando uma funcionalidade está finalizada e pronta para testes internos:

1. Garantir que a branch `development` está commitada e sincronizada com `origin/development`.
2. Atualizar a branch `stage`:
   ```bash
   git checkout stage
   git merge development --ff-only
   git push origin stage
   git checkout development
   ```
3. A Vercel detecta o push na branch `stage`, executa as migrations no **Neon Stage** e publica em `https://stage.evandro.watch`.
4. Testar a funcionalidade em homologação.

---

### Etapa 2: Promoção de Stage para Main (Produção)

Somente após a validação completa em Stage:

1. Garantir que o código em `stage` foi testado e aprovado.
2. Atualizar a branch `main`:
   ```bash
   git checkout main
   git merge stage --ff-only
   git push origin main
   git checkout development
   ```
3. A Vercel detecta o push na branch `main`, executa as migrations no **Neon Production** e publica em `https://evandro.watch`.
4. Retornar à branch `development` para os próximos trabalhos.

> [!WARNING]
> **Nunca promova diretamente `development → main`.** Todo código em produção deve obrigatoriamente ter passado antes por `stage`.

---

## 6. O que o Agente de IA Pode e Não Pode Fazer

### Permitido:
* Criar commits e dar push diretamente em `origin/development`.
* Executar promoções para `stage` ou `main` **somente quando receber ordem explícita** do usuário (ex: *"promover para stage"* ou *"promover para main"*).
* Gerar e aplicar migrations locais via `pnpm db:generate` e `pnpm db:migrate`.

### Proibido:
* Trabalhar ou comitar código diretamente nas branches `stage` ou `main`.
* Promover ambientes automaticamente após finalizar specs.
* Usar `--force` ou `--force-with-lease` nas branches permanentes.
* Fazer merge direto de `development` para `main`.
* Versionar arquivos de ambiente (`.env`, `.env.local`, etc.) ou segredos de credenciais.
