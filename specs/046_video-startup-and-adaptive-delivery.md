# 046 — Video Startup and Adaptive Delivery

## Objetivo

Reduzir agressivamente:

```text
bootstrap autorizado
→ primeiro frame
```

e:

```text
clique em Play
→ primeiro frame
```

com foco especial em:

```text
cold cache
conexões móveis/lentas
Slow 4G
```

A otimização deve atuar em quatro áreas:

```text
1. HLS Engine disponível mais cedo
2. qualidade inicial conservadora + ABR rápido
3. prebuffer antes do clique
4. loading UX sem spinner duplo
```

Não alterar:

- entitlement;
- quota;
- tracking;
- providers;
- arquitetura de embed criada na spec 045.

---

# 1. Problema atual

Depois da spec 045 o pipeline melhorou para:

```text
Tiny Loader
├── Bootstrap
└── Player Core
```

Porém o HLS Engine ainda começa tarde.

Hoje aproximadamente:

```text
Tiny Loader
↓
Player Core ~795 KB
↓
React monta
↓
WatchMapPlayer monta
↓
loadHlsEngine()
↓
HLS Light ~358 KB
↓
manifest
↓
playlist
↓
segmento
↓
frame
```

Em cold cache/rede lenta:

```text
Player Core
→ HLS Engine
```

ainda estão parcialmente serializados.

Isso deve ser removido.

---

# 2. Arquitetura alvo

Em browsers que precisam de HLS.js:

```text
                    ┌→ Bootstrap
                    │
Tiny Loader ────────┼→ Player Core
                    │
                    └→ HLS Light
```

Os três devem começar o mais cedo possível e em paralelo.

Depois:

```text
bootstrap autorizado
+
core pronto
+
HLS já disponível
↓
manifest
↓
rendition inicial leve
↓
primeiro segmento
↓
FIRST FRAME
```

---

# 3. Safari / HLS nativo

Preservar:

```text
Safari / Apple WebKit adequado
→ HLS nativo
→ HLS.js = 0 bytes
```

NÃO antecipar HLS Light nesses browsers.

---

# 4. Capability helper compartilhado

Extrair a detecção atual de HLS nativo para módulo pequeno e independente, por exemplo:

```text
src/components/player/embed/hls-capabilities.ts
```

Esse módulo NÃO pode importar:

```text
React
hls.js
player core
```

Ele deve poder ser utilizado por:

```text
Tiny Loader
HLS Engine
```

para ambos tomarem exatamente a mesma decisão.

---

# 5. HLS chunk conhecido pelo Loader

Hoje o build descobre:

```text
player-core-[hash].js
```

Fazer o build descobrir também o chunk real do:

```text
hls.js/light
```

Exemplo:

```text
chunk-hls.light-[hash].js
```

Injetar no Tiny Loader algo equivalente a:

```ts
__WATCHMAP_HLS_FILENAME__
```

Assim o Loader conhece o asset sem hardcode.

---

# 6. Preload antecipado do HLS Engine

Se o browser NÃO usar HLS nativo:

o Tiny Loader deve começar imediatamente o download do HLS Light.

Preferir:

```html
<link
  rel="modulepreload"
  href="/embed/v1/assets/chunk-hls.light-[hash].js"
  crossorigin
>
```

ou mecanismo equivalente que seja reutilizado pelo:

```ts
import("hls.js/light")
```

posterior.

O mesmo arquivo NÃO pode ser transferido duas vezes.

---

# 7. Não carregar HLS duas vezes

Fluxo esperado:

```text
Tiny Loader
→ modulepreload HLS chunk

depois

Player Core
→ import HLS
→ reutiliza module cache
```

Não:

```text
modulepreload
+
segunda transferência completa
```

---

# 8. Build validation

`scripts/build-embed.mjs` deve identificar explicitamente:

```text
Tiny Loader
Player Core
HLS Light
```

e imprimir:

```text
HLS Early Warm: ENABLED
```

quando o chunk tiver sido corretamente conectado ao Loader.

Se o HLS chunk não puder ser localizado no metafile:

```text
build deve falhar
```

em vez de silenciosamente perder a otimização.

---

# 9. HLS config centralizada

Criar helper puro para configuração de startup, por exemplo:

```text
src/components/player/embed/startup-abr.ts
```

Responsável por gerar a configuração inicial do HLS.

Não deixar parâmetros de startup espalhados dentro de:

```text
watchmap-player.tsx
```

---

# 10. Estratégia de qualidade inicial

Prioridade:

```text
COMEÇAR RÁPIDO
↓
depois aumentar qualidade
```

Não:

```text
esperar mais
→ começar já em alta qualidade
```

---

# 11. Automatic Start Level

Configurar HLS.js com:

```ts
startLevel: -1
```

Isso mantém escolha automática.

Não fixar:

```text
level 0
360p
480p
720p
```

porque a ordem do manifest não é garantida.

---

# 12. Remover bandwidth test inicial

Configurar:

```ts
testBandwidth: false
```

Assim o startup utiliza uma estimativa inicial de banda em vez do mecanismo padrão de baixar primeiro um fragmento de teste.

---

# 13. Estimativa inicial

Quando não houver histórico da sessão:

```ts
abrEwmaDefaultEstimate = 500_000
```

aproximadamente:

```text
500 kbps
```

Objetivo:

começar conservador.

Não significa limitar o vídeo permanentemente a 500 kbps.

---

# 14. ABR continua automático

Depois dos primeiros fragments:

```text
HLS.js mede throughput real
↓
ABR atualiza
↓
qualidade sobe/desce normalmente
```

Nunca fixar:

```text
currentLevel
nextLevel
autoLevelCapping
```

permanentemente.

---

# 15. Bandwidth Memory

Depois que o HLS.js obtiver uma estimativa real:

```ts
hls.bandwidthEstimate
```

armazenar em:

```text
sessionStorage
```

por origin do provider.

Exemplo conceitual:

```text
watchmap:hls-bandwidth:v1:https://stream.mux.com
```

Bunny possui chave separada.

---

# 16. Session only

Utilizar:

```text
sessionStorage
```

e não:

```text
localStorage
cookie
DB
backend
```

A estimativa deve desaparecer naturalmente quando a sessão do browser terminar.

---

# 17. Estimativa conservadora reutilizada

Ao reutilizar banda previamente medida:

não usar 100% do valor observado.

Aplicar fator conservador.

Exemplo:

```ts
initialEstimate = savedEstimate * 0.7
```

Com limites equivalentes a:

```text
mínimo: 500 kbps
máximo de seed: 5 Mbps
```

Valores podem ser centralizados em constantes.

---

# 18. Exemplo

Primeiro vídeo:

```text
seed = 500 kbps
↓
começa leve
↓
HLS mede 8 Mbps
```

Segundo vídeo da mesma sessão/provider:

```text
seed ≈ 5 Mbps após clamp conservador
↓
começa em qualidade melhor
```

Se conexão piorar:

ABR continua livre para descer.

---

# 19. Não usar Network Information API como dependência

Não depender de:

```text
navigator.connection
effectiveType
downlink
```

para funcionamento.

Pode ser investigado futuramente, mas não faz parte desta spec.

---

# 20. Não manipular Mux manifest para alta qualidade

NÃO adicionar:

```text
min_resolution=720p
rendition_order=desc
```

como otimização.

Isso trabalha contra nosso objetivo em conexões ruins.

---

# 21. Não limitar qualidade final

Não adicionar nesta spec:

```text
max_resolution=480p
max_resolution=720p
```

apenas para melhorar startup.

Depois do startup o usuário deve poder receber a melhor qualidade permitida pelas condições normais do stream.

---

# 22. Não habilitar progressive

Preservar:

```ts
progressive: false
```

Não habilitar comportamento experimental nesta rodada.

---

# 23. Preservar

Continuar usando:

```ts
enableWorker: true
lowLatencyMode: false
```

---

# 24. Prebuffer

Continuar anexando a mídia assim que:

```text
playbackUrl
+
Player Core
+
HLS Engine
```

estiverem disponíveis.

Não esperar o usuário clicar Play para começar:

```text
manifest
playlist
segmentos iniciais
```

---

# 25. `<video preload>`

Preservar:

```html
preload="auto"
```

O WatchMap é um player de VSL onde o vídeo é conteúdo principal.

Queremos utilizar o período antes do clique para preparar mídia.

---

# 26. Player normal

Com Background Autoplay desligado:

```text
página carrega
↓
poster aparece
↓
HLS prepara mídia silenciosamente
↓
Play fica disponível
```

Ideal:

```text
usuário clica
↓
segmento inicial já buffered
↓
frame praticamente imediato
```

---

# 27. Background Autoplay

Com Background Autoplay:

```text
preview/poster
↓
HLS prepara mídia por trás
↓
background playback inicia
↓
primeiro frame real
↓
preview pode desaparecer
```

Nunca mostrar spinner simplesmente porque:

```text
manifest
playlist
segment
```

estão sendo preparados.

---

# 28. Problema atual do loading duplo

Hoje existem múltiplos triggers independentes:

```text
EmbedPlayer loading
WatchMapPlayer setIsLoading(true)
loadstart
waiting
manifest parsed
canplay
playing
```

Isso pode produzir:

```text
spinner
↓
spinner some
↓
spinner volta
↓
vídeo
```

Remover esse comportamento.

---

# 29. Loading não pode representar estado técnico

Não usar diretamente:

```text
MANIFEST_PARSED
LOAD_START
LOADED_METADATA
CAN_PLAY
WAITING
```

como:

```text
mostrar/esconder spinner
```

Cada evento possui significado técnico diferente.

---

# 30. Media state machine

Criar estado explícito equivalente a:

```ts
type MediaStartupState =
  | "warming"
  | "ready"
  | "play_requested"
  | "playing"
  | "rebuffering"
  | "ended"
  | "error"
```

Pode ser implementado com reducer/helper equivalente.

---

# 31. Warming

```text
warming
```

significa:

```text
manifest / playlist / primeiros fragments
estão sendo preparados
```

Nesse estado:

```text
NÃO mostrar spinner
```

---

# 32. Ready

Quando player já possui condições suficientes para iniciar rapidamente:

```text
ready
```

Também:

```text
NÃO mostrar spinner
```

---

# 33. Play requested

Quando usuário clica Play:

```text
play_requested
```

chamar:

```ts
video.play()
```

imediatamente.

Não esperar:

```text
canplay
buffer cheio
backend
```

---

# 34. Spinner atrasado no primeiro Play

Depois do clique:

não mostrar spinner imediatamente.

Adicionar delay:

```text
~180–250ms
```

Exemplo:

```text
click
↓
play começa em 90ms
→ nenhum spinner
```

versus:

```text
click
↓
250ms passam
↓
ainda sem frame
→ mostrar spinner
```

Centralizar o valor em constante.

---

# 35. Objetivo do delay

Eliminar flashes como:

```text
spinner por 40ms
spinner por 80ms
spinner por 120ms
```

que visualmente fazem o produto parecer mais lento.

---

# 36. First Frame encerra startup

O estado inicial só deve ser considerado realmente concluído quando houver:

```text
primeiro frame apresentado
```

Preferir:

```ts
requestVideoFrameCallback()
```

quando disponível.

---

# 37. Preview permanece até First Frame

Hoje o preview é removido baseado em:

```text
playing
```

Alterar.

Preview/poster deve permanecer visível até:

```text
FIRST FRAME real
```

Só então fazer fade.

Fluxo:

```text
poster/preview
↓
frame já existe por baixo
↓
fade 150–200ms
↓
vídeo
```

Nunca:

```text
poster
↓
fundo preto
↓
spinner
↓
vídeo
```

---

# 38. Rebuffering

Depois que pelo menos um frame real já foi apresentado:

```text
waiting
```

pode significar buffering real.

Transicionar para:

```text
rebuffering
```

---

# 39. Spinner atrasado no rebuffer

Mesmo em rebuffer:

não mostrar spinner imediatamente.

Aplicar delay equivalente a:

```text
~200–300ms
```

Se playback voltar antes:

```text
não mostrar nada
```

Se continuar esperando:

```text
mostrar spinner
```

---

# 40. Spinner passa a significar espera real

Após esta spec, spinner só aparece quando:

```text
usuário pediu reprodução
+
está realmente esperando
```

ou:

```text
vídeo já tocava
+
rebuffer real persiste
```

---

# 41. Embed bootstrap loading

Remover o spinner visual do estado inicial:

```text
EmbedPlayer status = loading
```

Antes do Core/bootstrap estar pronto:

usar apenas:

```text
placeholder existente
fundo preto
poster/preview quando disponível
```

Não mostrar Loader2 nessa fase.

---

# 42. Bootstrap registry resolved cache

Hoje o registry guarda principalmente:

```text
Promise
```

Estender para também guardar resultados já resolvidos.

Conceitualmente:

```ts
resolved: Record<string, BootstrapVideoData>
```

Quando early bootstrap terminar:

```text
registry.resolved[key] = data
```

---

# 43. EmbedPlayer synchronous hydration

Ao montar:

`EmbedPlayer` deve verificar imediatamente:

```text
registry.resolved[key]
```

Se existir:

inicializar state como:

```text
ready
```

já no primeiro render.

Evitar:

```text
render loading
↓
useEffect
↓
ready
```

quando o Loader já resolveu bootstrap antes do Core.

---

# 44. Retry

Ao retry:

limpar:

```text
Promise cache
resolved cache
error cache se existir
```

e executar bootstrap novamente.

---

# 45. Loader visual shell

Enquanto Player Core ainda está baixando:

se early bootstrap já tiver retornado:

```text
posterUrl
ou
backgroundPreviewUrl
```

o Tiny Loader pode renderizar um shell visual extremamente simples diretamente no Shadow DOM.

Sem React.

---

# 46. Visual shell priority

Se:

```text
backgroundAutoplay = true
```

usar:

```text
backgroundPreviewUrl
```

senão:

```text
posterUrl
```

Fallback:

```text
background preto
```

---

# 47. Shell leve

O shell pode conter somente:

```text
img
background
object-fit
```

Não duplicar:

```text
player UI
controls
CTA
React
```

---

# 48. Core takeover

Quando Player Core montar:

transição deve ser sem flash.

Shell só deve ser removido depois que o Core tiver conteúdo visual disponível.

Não deixar:

```text
shell
↓
black flash
↓
poster
```

---

# 49. Startup HLS instrumentation

Adicionar marks/medidas para:

```text
wm:hls-engine:start
wm:hls-engine:ready

wm:manifest:start
wm:manifest:parsed

wm:first-frag:start
wm:first-frag:loaded
wm:first-frag:buffered

wm:first-frame
```

---

# 50. Startup quality instrumentation

Registrar em debug:

```text
initial bandwidth seed
first HLS level
first fragment bitrate
first fragment resolution se disponível
bandwidthEstimate depois do fragmento
```

---

# 51. Level switches

Durante os primeiros segundos:

registrar em Debug:

```text
LEVEL_SWITCHED
```

de forma resumida.

Exemplo:

```text
Startup: 360p · 480 kbps
Measured: 4.2 Mbps
Switch: 360p → 720p
```

Não criar analytics remoto.

---

# 52. Performance summary

Expandir:

```text
[WatchMap Performance]
```

para algo equivalente:

```text
Bootstrap: 90ms
HLS Engine Ready: 210ms
Manifest: 84ms
First Fragment: 190ms
First Frame: 410ms
Click → Frame: 62ms

Startup Level: 360p
Startup Bitrate: 480kbps
Bandwidth Estimate: 3.8Mbps
```

Somente quando debug estiver ativo.

---

# 53. Performance event

Atualizar:

```text
watchmap:performance
```

com esses dados adicionais quando disponíveis.

Não enviar para backend.

---

# 54. HLS event dedupe

Marks como:

```text
first fragment
first frame
```

devem acontecer uma única vez por startup.

Não registrar vários:

```text
wm:first-frag:loaded
```

para fragments seguintes.

---

# 55. First Frame e Background Autoplay

Se Background Autoplay tocar primeiro:

esse é o:

```text
first media frame
```

do startup.

Registrar normalmente.

---

# 56. Foreground click

Ao clicar no CTA de ativar áudio:

continuar medindo:

```text
click
→ primeiro frame foreground
```

sem introduzir backend.

Se o vídeo estava rodando em background, a transição deve continuar rápida.

---

# 57. Não recriar HLS

Background → foreground:

NÃO:

```text
destroy HLS
load manifest novamente
recriar source
```

Continuar usando a mesma sessão de mídia.

---

# 58. Não mudar tracking

Preservar:

```text
play
↓
tracking async
```

Nenhuma otimização desta spec pode colocar:

```text
POST /activate
```

antes do vídeo tocar.

---

# 59. Não mudar entitlement

Preservar toda a spec 045:

```text
early bootstrap
entitlement
1 DB resolver
provider preconnect
```

---

# 60. Mux

Mux continua retornando:

```text
https://stream.mux.com/{playbackId}.m3u8
```

Não alterar provider adapter nesta spec exceto se estritamente necessário.

---

# 61. Bunny

Bunny deve continuar compatível com a mesma estratégia ABR/HLS.

A lógica não pode verificar:

```text
if provider === mux
```

para decidir startup ABR.

Utilizar HLS genericamente.

---

# 62. Native HLS

A otimização de:

```text
testBandwidth
abrEwmaDefaultEstimate
session bandwidth memory
```

se aplica ao caminho HLS.js.

Native HLS continua sob responsabilidade do browser.

Não substituir Safari nativo por HLS.js apenas para obter controle de ABR.

---

# 63. Não usar Mux-specific hacks

Não utilizar nesta spec:

```text
signed URLs
custom Mux player
Mux Player SDK
rendition_order=desc
min_resolution
```

Nosso player continua provider-neutral.

---

# 64. Não reduzir qualidade permanentemente

Resultado esperado em rede rápida:

```text
startup conservador
↓
ABR mede banda
↓
720p / 1080p conforme apropriado
```

Não manter o usuário artificialmente em baixa resolução.

---

# 65. Código organizado

Evitar colocar toda a lógica nova em:

```text
watchmap-player.tsx
```

Preferir módulos:

```text
hls-capabilities.ts
startup-abr.ts
media-loading-state.ts
performance-timing.ts
```

ou equivalentes.

---

# 66. Testes — regra importante

NÃO exigir testes manuais em browser.

NÃO exigir:

```text
abrir Chrome
abrir DevTools
usar Network tab
usar Slow 4G manualmente
testar Safari manualmente
```

Toda validação desta spec deve ser executável via:

```text
CLI
scripts
build
static/runtime assertions sem navegador
```

---

# 67. Script temporário de verificação

Criar durante implementação um script temporário equivalente a:

```text
scripts/verify-046-player-startup.mjs
```

Esse script NÃO deve permanecer no projeto ao final.

---

# 68. Validar build architecture via script

O script deve verificar:

```text
Tiny Loader existe
Player Core existe
HLS Light chunk existe
Loader conhece o HLS chunk
HLS não está estaticamente dentro do Tiny Loader
```

---

# 69. Validar early HLS warming

Usar build metafile/output para confirmar que:

```text
non-native path
→ loader possui mecanismo de modulepreload do HLS chunk
```

Não depender de inspeção visual do Network.

---

# 70. Testar startup ABR como função pura

O helper de startup ABR deve permitir testes via script.

Validar:

```text
sem saved estimate
→ seed = 500k

saved = 4 Mbps
→ seed conservador

saved muito baixo
→ clamp mínimo

saved absurdo
→ clamp máximo
```

---

# 71. Testar provider-specific storage key

Via script:

```text
Mux origin
→ key A

Bunny origin
→ key B
```

Sem colisão.

---

# 72. Testar state machine

Via script, validar transições:

```text
warming
→ spinner false

manifest parsed
→ spinner false

play_requested
→ spinner inicialmente false

delay expirado sem frame
→ spinner true

first_frame
→ spinner false
→ playing

waiting curto
→ spinner false

waiting persistente
→ spinner true

playing novamente
→ spinner false
```

---

# 73. Background state test

Validar via reducer/helper:

```text
background warming
→ spinner false

first frame
→ preview fade permitido
```

---

# 74. Bootstrap resolved test

Validar estruturalmente que:

```text
loader resolved registry
```

existe e:

```text
EmbedPlayer
```

possui fast path para utilizar resultado já resolvido.

---

# 75. Static regression checks

Validar que `watchmap-player.tsx` NÃO volte a conter import estático:

```ts
import Hls from "hls.js"
```

de runtime.

`import type` é permitido.

---

# 76. Build commands

Executar:

```text
pnpm typecheck
pnpm lint
pnpm build:embed
```

Todos devem passar.

---

# 77. Scripts temporários

Qualquer script criado exclusivamente para testar esta spec deve ser excluído antes de concluir.

Validar no final que não permaneceram arquivos como:

```text
verify-046*
test-046*
tmp-046*
```

---

# 78. Não exigir benchmark de browser do agente

O agente NÃO precisa provar:

```text
X ms em Slow 4G real
```

porque isso depende de browser/network throttle.

Ele deve provar via código/build que:

```text
HLS começou mais cedo
ABR startup está conservador
double spinner foi removido
state machine funciona
bundle continua separado
```

Benchmark humano poderá ser feito posteriormente pelo usuário.

---

# Critérios de aceite

- HLS Light começa a ser aquecido pelo Tiny Loader.
- HLS Light e Player Core podem baixar em paralelo.
- Safari/native path não aquece HLS.js desnecessariamente.
- HLS Light continua separado do Player Core.
- `startLevel = -1`.
- `testBandwidth = false`.
- Seed inicial conservador existe.
- Bandwidth estimate da sessão é reutilizado.
- Estimativa é separada por provider origin.
- ABR continua totalmente automático depois do startup.
- Não há quality lock permanente.
- `preload="auto"` continua.
- Mídia continua sendo preparada antes do clique.
- EmbedPlayer não mostra spinner técnico inicial.
- Bootstrap resolvido antes do Core não causa render loading intermediário.
- Preview/poster permanece até First Frame real.
- `MANIFEST_PARSED` não controla spinner visual.
- `loadstart` não controla spinner visual.
- `canplay` não causa flash de spinner.
- Primeiro Play só mostra spinner após atraso real.
- Rebuffer só mostra spinner após atraso real.
- First Frame remove spinner.
- Background Autoplay não mostra spinner durante warming.
- Background → foreground não recria HLS.
- Tracking continua assíncrono.
- Entitlement não muda.
- Mux continua funcionando.
- Bunny continua funcionando.
- Instrumentação registra first fragment.
- Instrumentação registra startup bitrate/level.
- Debug mostra bandwidth estimate.
- Tiny Loader continua dentro do budget da spec 045.
- `pnpm typecheck` passa.
- `pnpm lint` passa.
- `pnpm build:embed` passa.
- Todos os testes adicionais são executáveis por script.
- Scripts temporários de validação são removidos ao final.