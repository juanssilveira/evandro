# WatchMap — Infraestrutura, Ambientes e CDN

## 1. Repositório e fluxo Git

Repositório oficial:

```text
juanssilveira/watchmap
```

Branches permanentes:

```text
development → desenvolvimento local
stage       → homologação
main        → produção
```

Fluxo oficial:

```text
development → stage → main
```

Regras:

- `development` é a default branch do GitHub;
- desenvolvimento normal acontece em `development`;
- `stage` recebe código apenas por promoção explícita de `development`;
- `main` recebe código apenas por promoção explícita de `stage`;
- não promover `development` diretamente para `main`;
- não usar force push nas branches permanentes.

A branch `development` não deve gerar deployment remoto na Vercel.

---

## 2. Ambientes

### Development

```text
App: http://localhost:3000
Database: Neon development
Storage: watchmap-videos-development
```

### Stage

```text
App: https://stage.evandro.watch
Database: Neon stage
Storage: watchmap-videos-stage
```

### Production

```text
App: https://app.evandro.watch
Database: Neon production
Storage: watchmap-videos-production
```

Nenhum ambiente pode utilizar banco, storage ou secrets de outro ambiente como fallback.

---

## 3. Projetos Vercel

O mesmo repositório GitHub alimenta dois projetos Vercel.

### `watchmap`

Responsável pela aplicação principal:

```text
Next.js
Dashboard
Autenticação
APIs
Embed API
```

Production Branch:

```text
main
```

Domínio de Production:

```text
https://app.evandro.watch
```

### `watchmap-player-cdn`

Responsável somente pelos assets públicos do player.

Configuração:

```text
Framework Preset: Other
Root Directory: ./
Build Command: pnpm build:embed
Output Directory: public
Production Branch: main
```

Domínio:

```text
https://cdn.evandro.watch
```

Esse projeto não deve receber credenciais de banco, R2 ou autenticação.

---

## 4. Player CDN

O player continua no mesmo repositório da aplicação.

O build atual:

```text
scripts/build-embed.mjs
```

gera:

```text
public/embed/v1/watchmap-player.js
```

URL pública atual:

```text
https://cdn.evandro.watch/embed/v1/watchmap-player.js
```

Enquanto o build continuar usando `/embed/v1/`, essa é a rota oficial do bundle.

---

## 5. Separação entre aplicação e CDN

A aplicação e o CDN possuem responsabilidades diferentes:

```text
app.evandro.watch
→ aplicação e APIs

cdn.evandro.watch
→ bundle público do player
```

Fluxo do embed:

```text
Página externa
    ↓
cdn.evandro.watch/embed/v1/watchmap-player.js
    ↓
<watchmap-player>
    ↓
app.evandro.watch/api/embed/videos/{publicId}
    ↓
playbackUrl assinado
    ↓
R2
```

O CDN não hospeda a API do embed.

---

## 6. Variáveis de ambiente

Usar:

```env
BASE_URL=
CDN_URL=
```

Responsabilidades:

```text
BASE_URL
→ origem da aplicação/API

CDN_URL
→ origem pública do bundle do player
```

### Development

```env
BASE_URL=http://localhost:3000
CDN_URL=http://localhost:3000
```

### Production

```env
BASE_URL=https://app.evandro.watch
CDN_URL=https://cdn.evandro.watch
```

### Stage

Quando configurado:

```env
BASE_URL=https://stage.evandro.watch
CDN_URL=https://cdn-stage.evandro.watch
```

Não usar `NEXT_PUBLIC_CDN_URL`.

Preferir resolver `BASE_URL` e `CDN_URL` no servidor e passar os valores como props para Client Components.

---

## 7. Embed

O snippet deve usar o CDN para o script e a aplicação para a API:

```html
<script src="https://cdn.evandro.watch/embed/v1/watchmap-player.js" defer></script>

<watchmap-player
  video-id="PUBLIC_VIDEO_ID"
  api-base="https://app.evandro.watch">
</watchmap-player>
```

Regra:

```text
script src → CDN_URL
api-base   → BASE_URL
```

O `api-base` é necessário porque o Web Component usa a origem do próprio script como fallback. Como o script é servido por `cdn.evandro.watch`, sem `api-base` ele tentaria acessar a API no domínio do CDN.

---

## 8. Deploy

Alterações continuam sendo feitas no mesmo repositório.

Fluxo:

```text
development
→ implementação e testes locais

development → stage
→ homologação

stage → main
→ produção
```

Quando `main` recebe uma nova versão:

```text
watchmap
→ deploy da aplicação

watchmap-player-cdn
→ build e publicação do bundle do player
```

Não é necessário trocar de repositório para desenvolver o player.
