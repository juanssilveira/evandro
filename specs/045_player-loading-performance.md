# 045 — Player Loading Performance

## Objetivo

Reduzir agressivamente o tempo entre:

```text
página começa a carregar
→ player aparece
→ bootstrap é autorizado
→ mídia começa a ser preparada
→ primeiro frame aparece
```

e também:

```text
clique em Play
→ primeiro frame reproduzido
```

A otimização deve atacar o pipeline inteiro:

```text
Embed HTML
→ Loader
→ Bootstrap API
→ Player Core
→ HLS Engine
→ Provider CDN
→ Manifest
→ Segmento
→ First Frame
```

Não otimizar apenas uma etapa isolada.

---

# 1. Estado atual

Hoje o embed funciona aproximadamente assim:

```text
HTML
↓
watchmap-player.js
↓
React / Web Component
↓
EmbedPlayer mount
↓
GET /api/embed/videos/{publicId}
↓
entitlement
↓
playbackUrl
↓
HLS.js
↓
manifest
↓
segmento
↓
frame
```

Problemas principais:

1. bootstrap só começa depois do bundle principal executar;
2. bundle atual é monolítico;
3. HLS.js está dentro do bundle principal;
4. bundle atual `watchmap-player.js` possui aproximadamente 1.41 MB minificado antes de compressão HTTP;
5. bootstrap executa múltiplas queries sequenciais;
6. bootstrap ainda pode chamar provider externo ao tentar sincronizar vídeo;
7. conexões com WatchMap API/CDN/provider só começam quando descobertas tardiamente;
8. não existe instrumentação precisa do critical path.

A nova arquitetura deve reduzir esse waterfall.

---

# 2. Arquitetura alvo

Objetivo:

```text
                       ┌→ Bootstrap API
                       │
HTML → Tiny Loader ────┼→ Player Core
                       │
                       ├→ conexões críticas
                       │
                       └→ HLS Engine quando necessário
                               ↓
                         playbackUrl liberada
                               ↓
                         provider já aquecido
                               ↓
                            manifest
                               ↓
                         primeiro segmento
                               ↓
                           FIRST FRAME
```

Bootstrap e download do player devem acontecer em paralelo.

---

# 3. Regra principal

O player NÃO deve precisar baixar/executar todo o React Player antes de iniciar o bootstrap.

Hoje:

```text
Player JS
→ React
→ fetch bootstrap
```

Novo comportamento:

```text
Loader
├── fetch bootstrap
└── carregar Player Core

em paralelo
```

---

# 4. Não alterar segurança

Preservar integralmente:

```text
account ativa
owner
subscription ativa
quota mensal
video ready
```

Antes de liberar:

```text
playbackUrl
```

Não colocar URL HLS diretamente no HTML.

Não colocar:

```html
<link rel="preload" href="PLAYBACK_URL.m3u8">
```

antes do entitlement.

---

# 5. Não reintroduzir autorização no Play

Preservar:

```text
LOAD
→ autorização

PLAY
→ video.play()
```

Nunca:

```text
PLAY
→ backend
→ esperar
→ mídia
```

A otimização não pode alterar essa arquitetura.

---

# 6. Tiny Loader

Transformar:

```text
public/embed/v1/watchmap-player.js
```

em um loader pequeno.

Ele deixa de carregar toda a aplicação do player diretamente.

Responsabilidades do loader:

```text
encontrar <watchmap-player>
registrar timing inicial
iniciar bootstrap
iniciar carregamento do Player Core
preparar conexões críticas
coordenar recursos compartilhados
```

O loader NÃO deve conter:

- React inteiro;
- ReactDOM inteiro;
- HLS.js;
- UI completa;
- engine do player.

---

# 7. Player Core separado

Mover o código pesado para um asset separado.

Conceitualmente:

```text
/embed/v1/watchmap-player.js
/embed/v1/assets/player-core-[hash].js
```

O nome final pode variar conforme implementação do build.

Requisito:

```text
loader estável e pequeno
+
core pesado cacheável independentemente
```

---

# 8. Code splitting

O build do embed deve passar a suportar code splitting quando isso puder ser feito sem fragilizar o embed cross-origin.

Preferência:

```text
ESM
+
esbuild splitting
+
hashed assets
```

Se utilizar ESM:

garantir CORS correto para os assets do CDN.

Os chunks devem poder ser carregados em páginas de qualquer origem que utilizem o WatchMap.

---

# 9. Module preload

Se Player Core for ESM, utilizar:

```text
rel="modulepreload"
```

quando o asset específico for conhecido antecipadamente.

Não utilizar:

```text
preload as=script
```

para módulos se `modulepreload` for aplicável.

---

# 10. Bootstrap antecipado

Criar mecanismo global extremamente pequeno para compartilhar bootstrap iniciado antes do React.

Conceitualmente:

```ts
window.__WATCHMAP_BOOTSTRAP__
```

ou estrutura equivalente.

Chave deve considerar no mínimo:

```text
API base
+
publicId
```

Exemplo conceitual:

```text
bootstrapMap[apiBase + ":" + publicId]
→ Promise<EmbedBootstrap>
```

---

# 11. Sem bootstrap duplicado

Se o loader já iniciou:

```text
GET /api/embed/videos/{publicId}
```

`EmbedPlayer` deve consumir a mesma Promise/result.

Não executar outro request.

Garantia:

```text
1 player load
→ 1 bootstrap request
```

salvo retry explícito após erro.

---

# 12. Fallback

O player deve continuar funcionando caso o early bootstrap não exista.

Exemplo:

```text
loader antigo
ou
integração incomum
ou
preview interno
```

`EmbedPlayer` pode executar o bootstrap normalmente.

Early bootstrap é otimização, não dependência funcional.

---

# 13. Resource hints

Adicionar ao embed otimizado:

```html
<link rel="preconnect" href="WATCHMAP_CDN">
<link rel="preconnect" href="WATCHMAP_API" crossorigin>
```

Adicionar fallback:

```html
<link rel="dns-prefetch" href="WATCHMAP_CDN">
<link rel="dns-prefetch" href="WATCHMAP_API">
```

Não adicionar dezenas de origins.

Somente conexões realmente críticas.

---

# 14. Loader preload

Permitir:

```html
<link
  rel="preload"
  href="WATCHMAP_CDN/embed/v1/watchmap-player.js"
  as="script"
  fetchpriority="high"
>
```

quando o loader continuar sendo classic script.

Se migrado para module:

utilizar a estratégia adequada de module loading.

---

# 15. Script priority

O loader principal deve ser carregado sem bloquear parser.

Preferência para classic script:

```html
<script
  src="..."
  async
  fetchpriority="high"
></script>
```

Não depender de esperar todo o HTML ser parseado.

Validar que isso não quebra páginas em que o Custom Element aparece antes ou depois da tag script.

---

# 16. Placeholder instantâneo

Antes de qualquer JavaScript executar, o `<watchmap-player>` deve reservar corretamente seu espaço.

Gerar no embed:

```text
display: block
width: 100%
background: black
aspect-ratio
border-radius
overflow: hidden
```

utilizando a configuração atual do vídeo no momento em que o embed é copiado.

Exemplo conceitual:

```html
<watchmap-player
  video-id="..."
  style="
    display:block;
    width:100%;
    aspect-ratio:16/9;
    background:#000;
    border-radius:12px;
    overflow:hidden;
  "
></watchmap-player>
```

Isso deve:

- evitar layout shift;
- mostrar imediatamente o espaço do player;
- não depender do React.

---

# 17. Atualização após bootstrap

O bootstrap continua sendo fonte real da configuração.

Se configuração atual for diferente daquela existente no placeholder copiado anteriormente:

```text
bootstrap
→ atualiza aspect ratio
→ atualiza radius
```

O style inline é apenas estado inicial otimizado.

---

# 18. Poster / Background Preview warming

Quando early bootstrap terminar e retornar:

```text
posterUrl
backgroundPreviewUrl
config
```

o loader pode antecipar o asset visual prioritário.

Se:

```text
backgroundAutoplay = true
```

priorizar:

```text
backgroundPreviewUrl
```

Caso contrário:

```text
posterUrl
```

Adicionar preload apenas para o asset realmente relevante.

Não preload ambos indiscriminadamente.

---

# 19. Image priority

No próprio player, o preview/poster crítico deve utilizar prioridade alta quando representar o visual inicial.

Utilizar:

```text
fetchpriority="high"
```

quando apropriado.

Não aplicar prioridade alta em imagens secundárias.

---

# 20. Provider connection warming

Depois do bootstrap autorizado:

```text
playbackUrl
```

fica disponível.

Extrair:

```text
new URL(playbackUrl).origin
```

e criar dinamicamente:

```html
<link rel="preconnect" href="PROVIDER_ORIGIN" crossorigin>
```

Assim:

```text
Mux
ou
Bunny
```

é aquecido sem precisar hardcodar provider no embed.

---

# 21. Não expor provider antecipadamente

Não é necessário colocar:

```text
Mux playback ID
Bunny GUID
playback URL
```

no HTML.

Provider origin deve ser descoberto depois do bootstrap autorizado.

---

# 22. HLS.js fora do bundle principal

Remover o import estático atual:

```ts
import Hls from "hls.js"
```

do critical bundle do player.

HLS deve ser carregado separadamente.

---

# 23. HLS Light

Testar e preferencialmente utilizar:

```ts
hls.js/light
```

O WatchMap não utiliza atualmente:

- DRM;
- subtitles;
- alternate audio;
- interstitials;
- CMCD;
- iframe trick-play.

Se os streams reais Mux e Bunny utilizados pelo WatchMap funcionarem integralmente com o build light:

```text
usar light
```

Se algum formato real suportado pelo produto depender de feature removida do light:

```text
não forçar light
```

e documentar o motivo.

Funcionalidade tem prioridade sobre redução de bundle.

---

# 24. Native HLS

Hoje o player prioriza:

```text
Hls.isSupported()
```

antes de HLS nativo.

Alterar estratégia.

Para browsers modernos onde HLS nativo é claramente apropriado:

```text
native HLS
→ não baixar HLS.js
```

Estratégia equivalente:

```text
canPlayType(HLS)
+
ManagedMediaSource disponível
→ native
```

Caso contrário:

```text
Hls.js
```

E caso HLS.js não esteja disponível/suportado mas HLS nativo esteja:

```text
fallback native
```

Não usar user-agent sniffing frágil.

---

# 25. Safari

Objetivo específico:

```text
Safari com HLS nativo adequado
→ NÃO baixar HLS.js
```

Isso reduz:

- transferência;
- parsing JS;
- execução JS;
- tempo até mídia.

---

# 26. HLS Engine loading

Em browsers que precisam de HLS.js:

o loader pode iniciar o carregamento do HLS Engine em paralelo ao Player Core.

Conceitualmente:

```text
Loader
├── bootstrap
├── player core
└── hls light
```

Não esperar:

```text
core pronto
→ descobrir HLS
→ começar download
```

quando a necessidade puder ser detectada antecipadamente de forma confiável.

---

# 27. Worker

Preservar:

```ts
enableWorker: true
```

quando utilizando HLS.js.

Não desabilitar worker para reduzir arquivo.

---

# 28. Low latency

Preservar:

```ts
lowLatencyMode: false
```

WatchMap atualmente é VOD/VSL.

Não habilitar low latency como suposta otimização.

---

# 29. Não ativar flags experimentais aleatoriamente

Não alterar sem benchmark:

```text
progressive
startFragPrefetch
lowLatencyMode
liveSync*
```

Primeiro resolver:

```text
network waterfall
bundle
bootstrap
connections
```

Somente utilizar opções adicionais se houver melhoria mensurável e comportamento estável em Mux e Bunny.

---

# 30. Manifest warming

Após entitlement, avaliar antecipação do:

```text
.m3u8
```

enquanto Player Core/HLS Engine terminam de carregar.

Porém:

NÃO implementar se isso gerar request duplicado quando HLS.js assumir a reprodução.

Critério:

```text
Network
→ exatamente 1 request efetivo ao manifest inicial
```

Se navegador/HLS.js não reutilizar preload:

```text
não utilizar manifest preload
```

Não sacrificar tráfego por uma otimização teórica.

---

# 31. Bootstrap backend — remover provider sync

Hoje:

```text
embed bootstrap
↓
vídeo não ready
↓
syncVideoStatus()
↓
Mux/Bunny API possível
```

Remover isso completamente do critical path público.

Novo comportamento:

```text
DB status = ready
→ servir

DB status != ready
→ processing/unavailable
```

O endpoint público de embed nunca deve depender de request Mux/Bunny para responder.

---

# 32. Provider synchronization

Status do provider continua sendo atualizado pelos fluxos adequados:

```text
upload
sync pós-upload
library refresh
background/processo existente
```

Não utilizar a landing page do espectador como mecanismo de sync.

---

# 33. Bootstrap DB optimization

Hoje o caminho feliz envolve múltiplos round-trips ao PostgreSQL.

Criar resolver otimizado para embed, por exemplo:

```text
src/lib/embed/bootstrap.ts
```

ou equivalente.

Objetivo:

```text
1–2 round-trips DB no máximo
```

para resolver:

- video;
- account status;
- owner;
- subscription ativa;
- monthly usage;
- player config;
- provider IDs necessários.

Preferência:

```text
1 query agregada
```

quando razoavelmente legível/manutenível.

---

# 34. Query consolidada

Pode utilizar:

```text
JOIN
LEFT JOIN
LATERAL JOIN
CTE
```

ou Drizzle equivalente.

Não buscar:

```text
video
↓
account
↓
owner
↓
subscription
↓
usage
↓
video novamente
↓
player settings
```

sequencialmente.

---

# 35. Bootstrap resolver

Criar retorno interno equivalente a:

```ts
interface EmbedBootstrapResolution {
  authorized: boolean

  video?: {
    id
    publicId
    accountId
    title
    status
    duration
    provider
    providerVideoId
    providerPlaybackId
    providerThumbnailFileName
    backgroundPreviewStatus
    backgroundPreviewKey
  }

  ownerUserId?: string

  subscription?: {
    planCode
    expiresAt
  }

  playsThisMonth?: number

  config?: PlayerConfig

  error?: string
  statusCode?: number
}
```

Não precisa seguir exatamente esse shape.

Objetivo é eliminar round-trips.

---

# 36. Regras de autorização permanecem iguais

A nova query NÃO pode alterar semântica.

Continuar verificando:

```text
video existe
account active
owner existe
subscription active
subscription não expirada
plays < max
video ready
```

---

# 37. Quota

Continuar usando:

```text
monthly_usage
```

para entitlement mensal.

Não registrar Play durante bootstrap.

Não reservar quota.

Não criar sessão.

---

# 38. Tracking continua assíncrono

Preservar:

```text
play()
↓
POST /activate em background
```

Erro de tracking não bloqueia reprodução.

Não mover tracking para bootstrap.

---

# 39. Preview do editor

Continuar isento do consumo de Play conforme regra atual.

As otimizações não podem modificar isso.

---

# 40. Bootstrap response

Continuar retornando:

```text
videoId
title
duration
playbackUrl
posterUrl
backgroundPreviewUrl
config
```

Não exigir uma segunda chamada para obter configuração.

---

# 41. Cache do bootstrap

NÃO cachear entitlement público agressivamente.

Continuar tratando como resposta dinâmica porque depende de:

- subscription;
- account status;
- monthly quota.

Não utilizar CDN public cache para esse JSON.

---

# 42. Server-Timing

Adicionar métricas úteis ao endpoint:

```http
Server-Timing:
  wm-db;dur=...
  wm-bootstrap;dur=...
```

Não expor dados sensíveis.

Adicionar:

```http
Timing-Allow-Origin: *
```

quando necessário para permitir medição no site embedder.

---

# 43. Performance API

O loader/player deve utilizar:

```text
performance.mark()
performance.measure()
```

para marcar o pipeline.

Eventos mínimos:

```text
wm:loader:start

wm:bootstrap:start
wm:bootstrap:end

wm:core:start
wm:core:ready

wm:media:attach

wm:manifest:start
wm:manifest:parsed

wm:canplay

wm:first-frame

wm:user-play
wm:user-play-first-frame
```

Nomes exatos podem ser refinados.

---

# 44. First Frame

Utilizar quando disponível:

```ts
HTMLVideoElement.requestVideoFrameCallback()
```

para detectar o primeiro frame efetivamente apresentado.

Fallback:

```text
playing/canplay
```

em browsers sem suporte.

---

# 45. Click-to-frame

Quando usuário iniciar foreground playback:

registrar:

```text
timestamp do clique
↓
primeiro frame posterior
↓
delta
```

Essa é uma das métricas mais importantes.

Objetivo:

```text
click → visual playback
```

o menor possível.

---

# 46. Não criar analytics remoto ainda

Esta spec NÃO cria:

- nova tabela;
- pipeline de eventos;
- endpoint de analytics;
- telemetry SaaS.

As métricas ficam disponíveis via:

```text
Performance API
Debug mode
Custom Event opcional
```

Analytics de produto continua para outra fase.

---

# 47. Debug de performance

Quando:

```text
development.debug = true
```

mostrar no console um resumo equivalente:

```text
[WatchMap Performance]

Bootstrap: 82ms
Core ready: 113ms
Manifest: 64ms
CanPlay: 318ms
First Frame: 341ms
Click → Frame: 21ms
```

Não gerar logs em produção com debug desligado.

---

# 48. Custom performance event

Opcionalmente disparar:

```text
watchmap:performance
```

com objeto seguro de timings.

Isso permite medir durante desenvolvimento sem acoplar analytics.

---

# 49. Build performance report

Atualizar:

```text
scripts/build-embed.mjs
```

para gerar relatório de tamanho.

Mostrar pelo menos:

```text
Loader
Player Core
HLS chunk
Outros chunks
Total
```

Preferencialmente usar:

```text
esbuild metafile
```

---

# 50. Baseline

Registrar no output de build a referência atual:

```text
old monolith ≈ 1,410,269 bytes minified
```

e mostrar comparação quando possível.

Não precisa manter esse número hardcoded para sempre.

---

# 51. Loader budget

O novo:

```text
watchmap-player.js
```

deve ser realmente pequeno.

Target:

```text
<= 25 KB minified
```

Preferencialmente muito abaixo disso.

Se ultrapassar:

considerar arquitetura incorreta e revisar o que entrou no loader.

---

# 52. Core budget

Não definir um número arbitrário que comprometa funcionalidade.

Porém:

```text
Player Core
```

obrigatoriamente deve ficar menor que o bundle monolítico atual.

HLS.js não pode permanecer embutido estaticamente no core.

---

# 53. Safari budget

Safari usando HLS nativo:

```text
HLS.js transfer = 0 bytes
```

Esse é um critério de aceite explícito.

---

# 54. Cache strategy

Assets pesados content-hashed:

```text
player-core-[hash].js
chunk-[hash].js
hls-[hash].js
```

podem utilizar:

```http
Cache-Control:
public, max-age=31536000, immutable
```

---

# 55. Loader caching

O loader estável:

```text
/embed/v1/watchmap-player.js
```

NÃO pode ser immutable porque aponta para os assets atuais.

Usar revalidation/TTL curto apropriado.

Exemplo:

```text
max-age=0
must-revalidate
```

ou estratégia equivalente segura.

---

# 56. CORS de assets

Se utilizar ESM/chunks cross-origin:

garantir:

```http
Access-Control-Allow-Origin: *
```

nos assets públicos do player.

Também permitir Resource Timing quando apropriado:

```http
Timing-Allow-Origin: *
```

---

# 57. Versões antigas

Não quebrar embeds existentes:

```html
<script src="/embed/v1/watchmap-player.js"></script>
<watchmap-player video-id="..."></watchmap-player>
```

O URL público principal continua válido.

A arquitetura interna pode mudar completamente.

---

# 58. Código de Embed

Atualizar o card atual.

Mostrar:

```text
Código do Player
```

e adicionar:

```text
Otimização de carregamento
Recomendado
```

---

# 59. Código principal

Novo código principal deve seguir algo equivalente:

```html
<watchmap-player
  video-id="PUBLIC_ID"
  style="display:block;width:100%;aspect-ratio:16/9;background:#000;border-radius:12px;overflow:hidden;"
></watchmap-player>

<script
  src="WATCHMAP_CDN/embed/v1/watchmap-player.js"
  async
  fetchpriority="high">
</script>
```

Não precisa ser exatamente essa formatação.

---

# 60. Código de otimização

Gerar bloco separado destinado preferencialmente ao `<head>`.

Conceitualmente:

```html
<link rel="preconnect" href="WATCHMAP_CDN">
<link rel="preconnect" href="WATCHMAP_API" crossorigin>

<link rel="dns-prefetch" href="WATCHMAP_CDN">
<link rel="dns-prefetch" href="WATCHMAP_API">

<link
  rel="preload"
  href="WATCHMAP_CDN/embed/v1/watchmap-player.js"
  as="script"
  fetchpriority="high"
>
```

E incluir o tiny early-bootstrap necessário caso ele esteja separado do loader.

---

# 61. UX do Embed Card

Explicar de forma curta:

```text
Código do Player
Cole onde o vídeo deve aparecer.

Otimização de carregamento
Cole no <head> para iniciar recursos críticos mais cedo.
```

Botão:

```text
Copiar
```

em cada bloco.

Não complicar a interface.

---

# 62. Fast path sem snippet extra

Mesmo se o cliente NÃO utilizar o bloco de otimização:

```text
player continua funcionando
+
loader continua iniciando bootstrap cedo
```

O snippet adicional é aceleração complementar.

---

# 63. Multiple players

A arquitetura deve suportar mais de:

```text
1 <watchmap-player>
```

na mesma página.

Não:

- carregar React múltiplas vezes;
- carregar HLS engine múltiplas vezes;
- carregar Player Core múltiplas vezes.

Assets globais devem ser deduplicados.

Bootstrap continua individual por vídeo.

---

# 64. Multiple scripts

Se uma página inserir o script WatchMap duas vezes:

evitar inicialização duplicada sempre que possível.

O Custom Element continua sendo registrado uma única vez.

---

# 65. Retry

Se early bootstrap falhar:

o retry explícito do player deve poder executar nova chamada.

Não guardar Promise rejeitada para sempre.

---

# 66. Loading UI

Durante todo o pipeline:

preservar placeholder/preloader visual.

Não deixar área em branco enquanto:

```text
bootstrap
core
manifest
```

estão carregando.

---

# 67. Background Autoplay

Validar especificamente:

```text
loader
↓
bootstrap
↓
preview
↓
HLS
↓
background autoplay
```

Não prejudicar:

- muted;
- loop;
- CTA de som;
- transição para foreground;
- restart em 0.

---

# 68. Continue Assistindo

A otimização não pode alterar:

```text
pause
→ Continue assistindo
→ resume currentTime
```

---

# 69. Providers

Testar:

```text
Mux
Bunny
```

Não otimizar somente Mux.

Mesmo se um provider não estiver sendo usado operacionalmente no momento, a arquitetura multi-provider continua válida.

---

# 70. Browsers mínimos de validação

Testar pelo menos:

```text
Chrome desktop
Edge desktop
Firefox desktop
Safari macOS
Safari iOS
Chrome Android
```

Prioridade máxima:

```text
Chrome
Safari/iPhone
```

---

# 71. Network conditions

Testar com:

```text
Cold cache
Warm cache
```

e pelo menos uma simulação de conexão móvel.

Exemplo:

```text
Fast 4G
```

Não validar performance apenas em localhost com fibra.

---

# 72. Métricas antes/depois

Comparar:

```text
página → bootstrap end
página → core ready
página → first frame
click → first frame
```

Quando houver amostra suficiente:

```text
p50
p75
p95
```

Durante desenvolvimento inicial, ao menos medições repetidas cold/warm cache.

---

# 73. Network waterfall

Validar visualmente no DevTools que:

ANTES:

```text
player
    ↓
bootstrap
        ↓
manifest
```

DEPOIS:

```text
loader
├── bootstrap
└── core

bootstrap
↓
provider preconnect

core + bootstrap
↓
manifest
```

---

# 74. Zero duplicate requests

Validar:

```text
bootstrap
→ 1 request

Player Core
→ 1 request

HLS engine
→ 0 ou 1 request

manifest
→ 1 request inicial
```

Não introduzir preload que gere uma segunda transferência do mesmo recurso.

---

# 75. Fora de escopo

Não alterar:

- design do player;
- player settings;
- analytics de produto;
- plans;
- quota semantics;
- account status;
- provider selection;
- upload;
- Bunny/Mux architecture;
- signed playback;
- JWT;
- Bunny token auth;
- billing.

Esta spec é exclusivamente performance do carregamento/reprodução inicial.

---

# Critérios de aceite

- `watchmap-player.js` deixa de ser o monólito atual.
- Existe tiny loader.
- Loader <= 25 KB minificado.
- Bootstrap começa antes do Player Core montar.
- Player Core e bootstrap carregam em paralelo.
- Não existe bootstrap duplicado.
- Existe preconnect para WatchMap CDN/API.
- Existe código adicional de otimização para `<head>`.
- Loader possui prioridade alta.
- Embed possui placeholder instantâneo.
- Layout shift inicial é minimizado.
- Provider CDN é preconnected depois do entitlement.
- Playback URL nunca aparece antecipadamente no HTML.
- HLS.js não faz mais parte estaticamente do Player Core.
- HLS Light é usado se compatível com streams reais.
- Safari apropriado utiliza HLS nativo.
- Safari native path transfere 0 bytes de HLS.js.
- HLS worker continua habilitado.
- lowLatencyMode continua false.
- Bootstrap não chama Mux/Bunny.
- Bootstrap realiza no máximo 1–2 round-trips DB.
- Autorização mantém exatamente as regras atuais.
- Tracking continua assíncrono.
- Play não faz autorização.
- Server-Timing existe.
- Performance marks existem.
- First Frame é medido.
- Click → First Frame é medido.
- Debug pode mostrar timings.
- Assets pesados usam nomes content-hashed.
- Assets hashados podem usar cache immutable.
- Loader não usa cache immutable.
- Embed antigo continua funcionando.
- Multiple players não duplicam core/HLS.
- Mux funciona.
- Bunny funciona.
- Background Autoplay funciona.
- Continue Assistindo funciona.
- Não existe duplicate manifest request.
- `pnpm typecheck` passa.
- `pnpm lint` passa.
- `pnpm build:embed` passa.