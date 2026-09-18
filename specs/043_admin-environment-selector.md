# 043 — Admin Environment Selector

## Objetivo

Adicionar ao painel `/dev` um seletor entre:

```text
Development
Production
```

A seleção define quais recursos reais o painel administrativo consulta e modifica.

Mapeamento:

```text
Development
→ .env.local

Production
→ .env.production
```

Os dois arquivos utilizam os MESMOS nomes de variáveis.

Não criar prefixos `PROD_*`.

---

# 1. Entrada do painel

Ao acessar:

```text
/dev
```

sem `env`, mostrar somente:

```text
Selecione o ambiente

[ Development ]
[ Production ]
```

Não carregar dashboard antes da escolha.

Depois:

```text
/dev?env=development&tab=overview

/dev?env=production&tab=overview
```

---

# 2. Fonte das configurações

Development utiliza normalmente:

```text
process.env
```

que no desenvolvimento já contém `.env.local`.

Production deve ler server-side:

```text
.env.production
```

explicitamente.

NÃO utilizar:

```ts
dotenv.config(...)
```

para Production se isso modificar globalmente `process.env`.

Preferir leitura isolada:

```text
fs.readFileSync(".env.production")
↓
dotenv.parse(...)
↓
objeto de configuração isolado
```

Assim trocar de ambiente não contamina o processo inteiro.

---

# 3. Mesmos nomes de env

Exemplo:

`.env.local`

```env
DATABASE_URL="DEV_DB"

MUX_TOKEN_ID="DEV"
MUX_TOKEN_SECRET="DEV"

BUNNY_STREAM_LIBRARY_ID="DEV"
BUNNY_STREAM_API_KEY="DEV"
BUNNY_STREAM_CDN_HOSTNAME="DEV"
```

`.env.production`

```env
DATABASE_URL="PROD_DB"

MUX_TOKEN_ID="PROD"
MUX_TOKEN_SECRET="PROD"

BUNNY_STREAM_LIBRARY_ID="PROD"
BUNNY_STREAM_API_KEY="PROD"
BUNNY_STREAM_CDN_HOSTNAME="PROD"
```

Nenhum código precisa conhecer nomes como:

```text
PROD_DATABASE_URL
PROD_MUX_TOKEN_ID
```

---

# 4. Allowlist

O environment selector NÃO troca todas as variáveis da aplicação.

Carregar do ambiente selecionado somente infraestrutura que realmente muda.

Inicialmente:

```text
DATABASE_URL

MUX_TOKEN_ID
MUX_TOKEN_SECRET

BUNNY_STREAM_LIBRARY_ID
BUNNY_STREAM_API_KEY
BUNNY_STREAM_CDN_HOSTNAME
BUNNY_ACCOUNT_API_KEY
```

Como o admin da spec 042 também pode excluir previews R2 de contas, incluir também:

```text
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_ASSETS_BUCKET
```

Somente essas variáveis devem variar entre Dev e Prod no contexto administrativo.

---

# 5. NÃO trocar URLs

Estas variáveis continuam SEMPRE pertencendo ao runtime local:

```text
BASE_URL
BETTER_AUTH_URL
APP_PUBLIC_URL
CDN_URL
ASSETS_BASE_URL
```

Mesmo quando:

```text
env=production
```

o painel continua executando localmente.

Nunca carregar as versões dessas URLs vindas de `.env.production`.

---

# 6. Também não trocar configuração do painel

Continuam sempre locais:

```text
APP_ENV
DEV_PANEL_ENABLED
```

O painel continua:

```text
development only
localhost only
```

Selecionar Production significa apenas:

```text
painel local
→ recursos de produção
```

Não significa rodar o painel em Production.

---

# 7. Contexto simples

Criar algo equivalente a:

```ts
type AdminEnvironment = "development" | "production"

type AdminInfraConfig = {
  DATABASE_URL: string

  MUX_TOKEN_ID?: string
  MUX_TOKEN_SECRET?: string

  BUNNY_STREAM_LIBRARY_ID?: string
  BUNNY_STREAM_API_KEY?: string
  BUNNY_STREAM_CDN_HOSTNAME?: string
  BUNNY_ACCOUNT_API_KEY?: string

  R2_ACCOUNT_ID?: string
  R2_ACCESS_KEY_ID?: string
  R2_SECRET_ACCESS_KEY?: string
  R2_ASSETS_BUCKET?: string
}
```

E:

```ts
getAdminEnvironmentConfig(environment)
```

Development:

```text
ler allowlist de process.env
```

Production:

```text
ler allowlist de .env.production
```

---

# 8. Database

Criar DB client correspondente ao:

```text
config.DATABASE_URL
```

Não alterar:

```text
process.env.DATABASE_URL
```

Não alterar o `db` normal utilizado pela aplicação.

Somente os serviços de:

```text
src/lib/dev/*
```

passam a utilizar o DB selecionado.

---

# 9. Fluxos existentes

NÃO recriar a lógica da spec 042.

Apenas fazer os serviços existentes receberem o contexto selecionado.

Exemplo:

```ts
getDevPlatformOverviewAnalytics(ctx, range)
getDevUsersList(ctx)
getDevUserDetails(ctx, userId)
deleteDevAccount(ctx, accountId)
getVideoInfraFullReport(ctx)
```

O comportamento dessas funções permanece igual.

---

# 10. Mux e Bunny

Quando:

```text
env=development
```

usar credentials vindas de `.env.local`.

Quando:

```text
env=production
```

usar credentials vindas de `.env.production`.

Isso vale para:

- métricas externas;
- delete de asset;
- health checks;
- informações da Infra de Vídeo;
- qualquer operação administrativa do provider.

Não modificar `process.env` para reutilizar os clients atuais.

Permitir passar config explicitamente ou criar client factory.

---

# 11. R2

Mesma regra para operações administrativas que realmente precisam manipular assets.

Development:

```text
R2 do .env.local
```

Production:

```text
R2 do .env.production
```

Não trocar:

```text
ASSETS_BASE_URL
```

porque URL/base do painel continua local.

---

# 12. Navegação

Preservar environment em todos os links:

```text
/dev?env=production&tab=overview
/dev?env=production&tab=users
/dev?env=production&tab=redeem-codes
/dev?env=production&tab=video-infra
```

User detail:

```text
/dev/users/{id}?env=production
```

Range:

```text
/dev?env=production&tab=overview&range=30d
```

---

# 13. Header

Mostrar permanentemente:

```text
DEVELOPMENT
```

ou:

```text
PRODUCTION
```

Permitir trocar pelo header.

Ao trocar:

```text
→ voltar para Overview
```

Não preservar user detail do ambiente anterior.

---

# 14. Production

Quando estiver em Production, deixar explícito:

```text
PRODUCTION · DADOS REAIS
```

Sem transformar todo painel em vermelho.

Apenas garantir que o ambiente seja impossível de esquecer.

Ações destrutivas continuam mostrando aviso de Production.

---

# 15. Default provider

A configuração:

```text
default_video_provider
```

já pertence ao banco.

Portanto funciona naturalmente:

```text
DB Development → default próprio
DB Production  → default próprio
```

Nenhuma lógica adicional é necessária.

---

# 16. Sem fallback

Nunca:

```text
.env.production ausente
→ usar .env.local
```

Nunca:

```text
DATABASE_URL prod inválida
→ usar development
```

Nunca:

```text
Mux prod sem credential
→ usar Mux dev
```

Falhar explicitamente.

---

# 17. Configuração mínima

Para entrar em Development:

```text
DATABASE_URL
```

precisa existir.

Para entrar em Production:

```text
.env.production
+
DATABASE_URL dentro dele
```

precisam existir.

Mux/Bunny/R2 podem aparecer como:

```text
não configurado
```

sem impedir acesso ao dashboard.

---

# 18. Cache

Todo cache administrativo dependente de infraestrutura precisa ser separado por:

```text
development
production
```

Nunca compartilhar:

```text
Mux stats
Bunny stats
Infra report
```

entre ambientes.

---

# 19. Segurança dos arquivos

Adicionar ao `.gitignore`:

```text
.env.production
```

O arquivo contém credentials reais e NÃO pode ser versionado.

Preservar `.env.example`.

---

# 20. Fora de escopo

Não alterar:

- dashboard;
- gráficos;
- páginas de usuário;
- ações da spec 042;
- player;
- upload;
- planos;
- analytics do produto;
- Base URLs;
- comportamento normal da aplicação.

Esta spec apenas adiciona seleção da infraestrutura utilizada pelo painel admin.

---

# Critérios de aceite

- `/dev` sem environment mostra seletor.
- Development usa `.env.local`.
- Production usa `.env.production`.
- Ambos utilizam os mesmos nomes de env.
- Não existem variáveis `PROD_*`.
- Production é lido isoladamente.
- `process.env` não é sobrescrito ao trocar ambiente.
- Somente envs de infraestrutura necessárias são trocadas.
- BASE_URL não muda.
- BETTER_AUTH_URL não muda.
- APP_PUBLIC_URL não muda.
- CDN_URL não muda.
- Painel continua rodando em development/localhost.
- Dashboard consulta o DB correto.
- Usuários consultam o DB correto.
- Redeems consultam o DB correto.
- Infra consulta Mux/Bunny corretos.
- Delete de conta utiliza providers/R2 corretos.
- Default provider é independente entre os bancos.
- Links preservam `env`.
- Header sempre mostra o ambiente.
- Não existe fallback Prod → Dev.
- `.env.production` está no `.gitignore`.