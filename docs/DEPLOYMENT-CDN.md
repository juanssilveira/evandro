# Evandro Watch — Infraestrutura, Ambientes e CDN

## 1. Repositório e fluxo Git

Repositório oficial:

```text
juanssilveira/evandro
```

Branches permanentes:

```text
development → desenvolvimento local
main        → produção
```

Fluxo oficial:

```text
development → main
```

Regras:

- `development` é a default branch do GitHub;
- desenvolvimento normal acontece em `development` (ambiente local);
- `main` recebe código apenas por promoção explícita de `development`;
- não usar force push nas branches permanentes.

A branch `development` não deve gerar deployment remoto na Vercel.

---

## 2. Ambientes

### Development

```text
App: http://localhost:3000
Database: Neon development
Video Infra: Mux Development environment
```

### Production

```text
App: https://app.evandro.watch
Player CDN: https://cdn.evandro.watch
Database: Neon production
Video Infra: Mux Production environment
```

Nenhum ambiente pode utilizar banco, credenciais Mux ou secrets de outro ambiente como fallback.

---

## 3. Projetos Vercel

O mesmo repositório GitHub alimenta dois projetos Vercel na produção.

### Aplicação Principal (`watchmap` / `evandro-watch`)

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

### Player CDN (`watchmap-player-cdn` / `evandro-player-cdn`)

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

Esse projeto não deve receber credenciais de banco, Mux ou autenticação.

---

## 4. Player CDN

O player continua no mesmo repositório da aplicação.

O build:

```text
scripts/build-embed.mjs
```

gera:

```text
public/embed/v1/evandro-player.js
```

URL pública de produção:

```text
https://cdn.evandro.watch/embed/v1/evandro-player.js
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
cdn.evandro.watch/embed/v1/evandro-player.js
    ↓
<evandro-player>
    ↓
app.evandro.watch/api/embed/videos/{publicId}
    ↓
HLS Playback URL
    ↓
Mux Video (stream.mux.com)
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

Não usar `NEXT_PUBLIC_CDN_URL`.

Preferir resolver `BASE_URL` e `CDN_URL` no servidor e passar os valores como props para Client Components.

---

## 7. Embed

O snippet deve usar o CDN para o script e a aplicação para a API:

```html
<script src="https://cdn.evandro.watch/embed/v1/evandro-player.js" defer></script>

<evandro-player
  video-id="PUBLIC_VIDEO_ID">
</evandro-player>
```

Regra:

```text
script src → CDN_URL
API base   → incorporada no bundle via BASE_URL durante build:embed
```

---

## 8. Deploy

Alterações continuam sendo feitas no mesmo repositório.

Fluxo:

```text
development
→ implementação e testes locais

development → main
→ produção
```

Quando `main` recebe uma nova versão:

```text
evandro-watch (App)
→ deploy da aplicação

evandro-player-cdn (CDN)
→ build e publicação do bundle do player
```

Não é necessário trocar de repositório para desenvolver o player.
