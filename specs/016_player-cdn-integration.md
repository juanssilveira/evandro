# Spec 016 — Player CDN Integration

## Objetivo

Tornar o Player CDN a origem oficial do bundle público do WatchMap Player e remover `api-base` da API pública do embed.

O embed final deve ser simples:

```html
<script src="https://cdn.evandro.watch/embed/v1/watchmap-player.js" defer></script>
<watchmap-player video-id="PUBLIC_VIDEO_ID"></watchmap-player>
```

A aplicação continua responsável pela API pública do vídeo.

---

## Variáveis

Manter duas responsabilidades distintas:

```text
BASE_URL
→ origem da aplicação e APIs

CDN_URL
→ origem pública do bundle do player
```

Valores:

```env
# Development
BASE_URL=http://localhost:3000
CDN_URL=http://localhost:3000

# Stage
BASE_URL=https://stage.evandro.watch
CDN_URL=https://cdn-stage.evandro.watch

# Production
BASE_URL=https://app.evandro.watch
CDN_URL=https://cdn.evandro.watch
```

Não criar `NEXT_PUBLIC_CDN_URL`.

---

## Bundle do Player

O build do embed deve incorporar `BASE_URL` ao bundle em build time.

Fluxo:

```text
Vercel Player CDN
      ↓
BASE_URL do ambiente
      ↓
pnpm build:embed
      ↓
watchmap-player.js
      ↓
API base incorporada ao bundle
```

O bundle não deve descobrir a API através:

```text
document.currentScript
origem do CDN
window.location
api-base
```

A URL da API deve ser determinada pelo ambiente utilizado durante o build.

Em Stage e Production, ausência de `BASE_URL` deve causar falha explícita do build.

Development pode utilizar:

```text
http://localhost:3000
```

como fallback local.

---

## Custom Element

Remover `api-base` da interface pública de:

```html
<watchmap-player>
```

O elemento deve observar somente os atributos públicos necessários, incluindo:

```text
video-id
```

Remover a lógica responsável por descobrir a origem através do `<script>`.

O Player deve receber internamente a API base incorporada no bundle.

---

## Embed API

O Player continua consultando:

```text
${BASE_URL}/api/embed/videos/{publicId}
```

O endpoint permanece público.

Nenhuma chamada de API deve ser enviada para:

```text
cdn.evandro.watch
cdn-stage.evandro.watch
```

O CDN serve somente arquivos estáticos.

---

## Geração do Embed

A aplicação deve utilizar:

```text
CDN_URL
```

exclusivamente para gerar o `src` do script.

Resultado:

```html
<script src="${CDN_URL}/embed/v1/watchmap-player.js" defer></script>
<watchmap-player video-id="${publicId}"></watchmap-player>
```

O snippet visual exibido na interface e o snippet copiado devem ser idênticos.

`BASE_URL` não deve aparecer no código entregue ao cliente.

---

## Projetos Vercel

### WatchMap App

Utiliza:

```text
BASE_URL
CDN_URL
```

### WatchMap Player CDN

Utiliza:

```text
BASE_URL
```

O projeto CDN precisa conhecer `BASE_URL` apenas durante o build para incorporar a origem correta da API ao bundle.

Não adicionar credenciais de banco, R2 ou autenticação ao projeto CDN.

---

## Caminho do Bundle

Manter nesta spec:

```text
/embed/v1/watchmap-player.js
```

Não alterar ainda para `/player/v1/`.

---

## Critérios de aceite

- CDN é a origem do script do embed;
- `CDN_URL` é usada para gerar o `src`;
- `BASE_URL` continua representando aplicação/API;
- `BASE_URL` é incorporada ao bundle durante `build:embed`;
- `<watchmap-player>` não possui mais `api-base`;
- lógica de descoberta da API pela origem do script é removida;
- API continua sendo chamada em `BASE_URL`;
- nenhum request de API é feito ao domínio CDN;
- embed funciona em página externa;
- Development funciona com API local;
- Stage aponta para `stage.evandro.watch`;
- Production aponta para `app.evandro.watch`;
- snippet exibido e copiado não contém `api-base`;
- `pnpm typecheck`, `pnpm lint` e `pnpm build` passam.

Não implemente funcionalidades além das especificadas.