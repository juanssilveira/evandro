# 048 — Instant Startup Surface & Early Media Engine

## Objetivo

Reconstruir o caminho crítico de inicialização do Evandro Player para que a mídia principal comece a ser preparada antes do React Player Core e para que o usuário sempre receba a melhor superfície visual possível sem flashes, layout shift ou uso indevido de thumbnail.

Esta milestone deve melhorar a experiência atual, nunca degradá-la.

Princípio central:

```text
PERCEPÇÃO IMEDIATA
+
MAIN VIDEO PREPARADO O MAIS CEDO POSSÍVEL
```

A nova arquitetura deve preservar o preview animado atual como acelerador visual, mas remover sua responsabilidade sobre playback.

---

# 1. Comportamento obrigatório

Existem três estados iniciais oficiais.

## Background Autoplay ON

```text
player aparece
        ↓
preview animado pode aparecer imediatamente
        +
main video começa a preparar/tocar muted por baixo
        ↓
main entrega primeiro frame real
        ↓
preview desaparece
        ↓
main video continua
```

Thumbnail estática NÃO participa deste fluxo.

Nunca:

```text
thumbnail
→ preview
→ main
```

---

## Background Autoplay OFF + Thumbnail ON

```text
player aparece
        ↓
thumbnail
        +
main video é preparado por baixo
        ↓
usuário clica Play
        ↓
main video já preparado
        ↓
thumbnail → main
```

---

## Background Autoplay OFF + Thumbnail OFF

```text
player aparece
        ↓
surface preta estável
        +
main video começa imediatamente a preparar
        ↓
primeiro frame real disponível
        ↓
frame 0 fica visível e pausado
        ↓
usuário clica Play
        ↓
play imediato
```

Neste modo:

```text
thumbnail nunca aparece
preview nunca aparece
```

---

# 2. Invariável de UX

A ordem de prioridade deve ser:

```text
conteúdo real disponível
→ mostrar conteúdo real

senão

visual permitido disponível
→ mostrar visual permitido

senão

surface preta estável
```

Nunca mostrar um asset proibido apenas para preencher um intervalo de carregamento.

---

# 3. Zero Layout Shift

O player deve reservar seu espaço antes de:

```text
bootstrap
engine
React
HLS
preview
video
```

O embed atual já incorpora:

```css
display: block;
width: 100%;
aspect-ratio: ...;
background: #000;
border-radius: ...;
overflow: hidden;
```

Preservar esse comportamento.

A inicialização do JavaScript não pode modificar a geometria externa do `<evandro-player>`.

Mesmo se JavaScript, bootstrap ou mídia falharem:

```text
player mantém exatamente o espaço reservado
```

Nenhum conteúdo da página hospedeira deve se deslocar.

---

# 4. Problema arquitetural atual

Hoje o main media depende aproximadamente de:

```text
Tiny Loader
→ bootstrap
→ Player Core
→ React
→ <video>
→ useEffect
→ HLS attach
→ manifest
→ fragment
→ frame
```

Isso coloca React no caminho crítico da mídia.

A nova arquitetura deve ser:

```text
Tiny Loader
        ↓
bootstrap
        ↓
┌────────────────────────────┐
│ Early Media Engine         │
│                            │
│ cria/reutiliza <video>     │
│ attach HLS                 │
│ inicia mídia               │
└────────────────────────────┘

EM PARALELO:

Player Core
→ React UI
```

React deixa de ser pré-requisito para iniciar o download e decode do vídeo.

---

# 5. Estrutura DOM do embed

O Tiny Loader deve criar o stage persistente.

Estrutura conceitual:

```html
<evandro-player>
  #shadow-root

  <div data-evandro-player-stage>

    <div data-evandro-player-media-layer>
      <video data-evandro-player-media></video>
    </div>

    <div data-evandro-player-startup-visual></div>

    <div data-evandro-player-ui-root></div>

  </div>
</evandro-player>
```

Essa estrutura nasce antes do Player Core.

O Player Core monta React apenas no:

```text
data-evandro-player-ui-root
```

O elemento `<video>` não deve ser destruído/recriado quando React chegar.

---

# 6. Um único main video

Regra absoluta:

```text
1 Evandro Player
=
1 main HTMLVideoElement
```

Não criar:

```text
loader video
+
React video
```

Não fazer prewarm em um vídeo temporário para depois jogar o elemento fora.

O mesmo elemento criado antecipadamente deve continuar sendo utilizado pela experiência completa do embed.

---

# 7. Uma única sessão HLS

No caminho Hls.js:

```text
1 main video
=
no máximo 1 main Hls instance
```

A Hls instance criada pela Early Media Engine deve continuar existindo quando React montar.

React não pode criar uma segunda Hls instance sobre a mesma source.

---

# 8. Early Media Engine

Criar fundação em:

```text
src/components/player/engine/
```

Estrutura preferida:

```text
src/components/player/engine/
├── player-engine.ts
├── types.ts
└── player-engine-entry.ts
```

A implementação pode ajustar nomes caso o código real justifique, mas não criar abstrações desnecessárias.

A engine desta milestone deve ser independente de React.

Ela será expandida na próxima milestone para se tornar autoridade completa de playback.

Nesta spec ela deve possuir pelo menos:

```text
media element
source lifecycle
native HLS
Hls.js lifecycle
startup mode
first-frame detection
background autoplay startup
startup quality cap
startup visual coordination
cleanup
```

---

# 9. Bundle independente da engine

Adicionar um bundle separado:

```text
player-engine-[hash].js
```

Arquitetura:

```text
evandro-player.js
→ Tiny Loader

player-engine-[hash].js
→ Headless Media Engine

player-core-[hash].js
→ React/UI

hls-[hash].js
→ HLS.js
```

Tiny Loader continua:

```text
<= 25 KB
```

React não entra no Engine bundle.

Hls.js continua separado.

---

# 10. Build

Modificar:

```text
scripts/build-embed.mjs
```

para produzir e detectar:

```text
player-engine-[hash].js
player-core-[hash].js
HLS chunk
```

Adicionar compile-time reference equivalente a:

```text
__EVANDRO_PLAYER_ENGINE_FILENAME__
```

O relatório deve mostrar:

```text
Tiny Loader
Player Engine
Player Core
HLS Engine
```

separadamente.

---

# 11. Carregamento paralelo

Assim que `<evandro-player>` for conectado:

```text
bootstrap
Player Engine
Player Core
HLS warm
```

devem começar o mais paralelamente possível.

Não fazer:

```text
bootstrap
await
engine
await
Core
```

quando não existir dependência real.

O bootstrap continua sendo necessário para obter:

```text
playback URL
config
preview URL
poster URL
```

Assim que ele resolver, a Engine deve receber os dados imediatamente.

Não esperar React.

---

# 12. Stage instantâneo

No `connectedCallback()`:

1. Shadow Root;
2. stage;
3. media element;
4. startup visual container;
5. UI root;

devem ser criados sincronamente.

O usuário deve receber imediatamente:

```text
surface preta estável
```

antes de qualquer operação assíncrona.

---

# 13. Startup Visual Policy

Criar uma política explícita.

Não utilizar mais fallbacks implícitos do tipo:

```ts
backgroundPreviewUrl || posterUrl
```

ou:

```ts
posterUrl || backgroundPreviewUrl
```

Decidir visual pelo modo.

---

# 14. Background Autoplay

Quando:

```text
backgroundAutoplay = true
```

a Startup Visual Policy é:

```text
backgroundPreviewUrl
OU
none
```

Nunca:

```text
posterUrl
```

Portanto:

```text
preview disponível
→ pode aparecer

preview indisponível
→ surface preta até main frame
```

A thumbnail nunca funciona como fallback do Background Autoplay.

---

# 15. Normal Playback + Thumbnail ON

Quando:

```text
backgroundAutoplay = false
thumbnail.enabled = true
```

Startup Visual:

```text
posterUrl
OU
none
```

Nunca utilizar `backgroundPreviewUrl`.

---

# 16. Normal Playback + Thumbnail OFF

Quando:

```text
backgroundAutoplay = false
thumbnail.enabled = false
```

Startup Visual:

```text
none
```

Não requisitar:

```text
posterUrl
backgroundPreviewUrl
```

para apresentação inicial.

O primeiro conteúdo visual deve ser o próprio frame do main video.

---

# 17. Configuração explícita de thumbnail

Hoje o PlayerConfig não possui política explícita de thumbnail.

Adicionar em:

```text
src/types/player-config.ts
```

conceitualmente:

```ts
appearance: {
  ...
  thumbnail: {
    enabled: boolean;
  };
}
```

Default:

```text
true
```

para preservar o comportamento existente.

Essa alteração é aditiva ao JSON de configuração.

Não criar migration SQL apenas por isso.

---

# 18. UI da thumbnail

Adicionar na seção:

```text
Aparência
```

das configurações do player uma opção clara:

```text
Exibir thumbnail
```

Descrição simples equivalente a:

```text
Mostra a imagem de capa enquanto o vídeo aguarda o play.
```

Quando desligada:

```text
thumbnail.enabled = false
```

A mudança deve ser refletida imediatamente no preview do editor.

Não implementar upload/customização manual de thumbnail nesta spec.

Continuamos usando o poster fornecido pelo provider.

---

# 19. Não usar `<video poster>`

Remover o `poster={posterUrl}` do elemento de vídeo.

Toda thumbnail deve ser controlada pela Startup Visual Layer.

Motivo arquitetural:

```text
thumbnail OFF
```

precisa garantir:

```text
browser também não mostra thumbnail
```

A engine controla explicitamente quando uma imagem pode ser apresentada.

O `<video>` deve permanecer sem `poster`.

---

# 20. Preview WebP continua existindo

Não remover o preview animado atual.

Ele passa a ter apenas esta responsabilidade:

```text
dar feedback visual rapidamente
enquanto o main video ainda não entregou frame
```

Ele NÃO é:

```text
source de playback
timeline
fonte de tracking
fonte de progresso
media context
```

---

# 21. Reduzir peso do preview Mux

Hoje o preview Mux utiliza aproximadamente:

```text
até 10 segundos
640px
12 fps
```

Alterar para um asset mais apropriado para startup:

```text
até 6 segundos
480px
8 fps
```

Aplicar consistentemente em:

```text
src/lib/video-providers/mux-provider.ts
src/lib/background-preview.ts
```

incluindo fallback WebP/GIF.

Objetivo:

```text
movimento suficiente para percepção de autoplay
+
significativamente menos bytes
```

Não aumentar esses parâmetros sem medição futura.

---

# 22. Bunny Preview

O Bunny atualmente fornece:

```text
preview.webp
```

como asset do provider.

Preservar esse caminho nesta milestone.

Não introduzir processamento pesado apenas para igualar exatamente os parâmetros do Mux.

A arquitetura deve continuar provider-neutral.

---

# 23. Preview só é requisitado quando necessário

No client:

```text
backgroundAutoplay = false
```

significa:

```text
backgroundPreviewUrl não deve ser preloaded
não deve ser inserido como <img>
não deve competir por rede
```

Mesmo que o bootstrap contenha a URL.

Somente Background Autoplay ativa o download visual do preview.

---

# 24. Thumbnail só é requisitada quando necessário

Quando:

```text
thumbnail.enabled = false
```

o `posterUrl` pode continuar vindo no bootstrap por compatibilidade de payload, porém:

```text
não preload
não <img>
não <video poster>
```

Nenhum byte da thumbnail deve ser requisitado pelo Player apenas para preencher startup.

---

# 25. Main media sempre começa cedo

Independentemente da política visual:

```text
main HLS deve começar a preparação assim que playbackUrl estiver disponível
```

Isso vale para:

```text
Background Autoplay ON
Thumbnail ON
Thumbnail OFF
```

A diferença é somente o que fica visível.

---

# 26. Main video em Normal Playback

Quando Background Autoplay estiver OFF:

```text
video não deve tocar automaticamente
```

Mas deve:

```text
manifest load
primeiro fragmento load
buffer inicial
decode inicial
```

o mais cedo possível.

Objetivo:

```text
Play click
→ não iniciar pipeline
→ apenas continuar pipeline já preparado
```

---

# 27. Primeiro frame com Thumbnail OFF

No modo:

```text
BG OFF
THUMB OFF
```

assim que o primeiro frame real estiver disponível:

```text
video torna-se visível
```

e permanece pausado no início.

Usar `requestVideoFrameCallback()` quando possível para confirmar apresentação de frame.

Fallback apropriado deve existir para browsers sem suporte.

Não depender exclusivamente de:

```text
loadedmetadata
```

como prova visual de frame.

---

# 28. First-frame arbitration

Startup Visual e Main Video devem funcionar como uma corrida.

Para Background Autoplay:

```text
preview pronto primeiro
→ preview pode ser revelado

main frame pronto primeiro
→ main é revelado
→ preview atrasado nunca aparece
```

Regra:

```text
depois que main venceu,
nenhum startup visual pode aparecer por cima posteriormente
```

Isso evita:

```text
main
→ preview atrasado
→ main novamente
```

---

# 29. Preview takeover

Quando preview estiver visível e o main entregar frame real:

```text
preview
→ crossfade curto
→ main
```

Manter transição curta:

```text
~100–150ms
```

Não utilizar transições longas.

O objetivo é mascarar diferença de frame, não criar efeito visual.

---

# 30. Nada deve desaparecer por timeout arbitrário

O Loader atual remove seu shell após aproximadamente:

```text
100ms depois de React montar
```

Remover essa lógica como autoridade de visual readiness.

Não utilizar:

```text
React mounted
+
setTimeout(...)
```

para decidir que a mídia está pronta.

Usar fatos:

```text
preview decoded
thumbnail decoded
main first frame
error
```

---

# 31. Startup Visual permanece através do React mount

Quando React montar:

```text
não remover startup visual automaticamente
```

React mount e media readiness são eventos diferentes.

Exemplo:

```text
preview está visível
↓
React monta
↓
preview continua
↓
main first frame
↓
preview sai
```

Isso elimina flash preto entre Loader Shell e Player Core.

---

# 32. Preview load

Quando Preview WebP for necessário:

```text
criar/preload com prioridade alta
```

mas somente depois do bootstrap informar que:

```text
backgroundAutoplay = true
```

Não preload antecipadamente sem saber que será utilizado.

Se o preview falhar:

```text
não usar thumbnail como fallback
```

No Background Autoplay:

```text
preview error
→ main continua preparando
→ surface preta até main frame
```

---

# 33. Thumbnail load

Quando thumbnail estiver habilitada:

```text
posterUrl
→ prioridade visual alta
```

Se falhar:

```text
não usar background preview como fallback
```

Resultado:

```text
main video preparado por baixo
```

---

# 34. Main Background Autoplay

Quando Background Autoplay estiver ativo, o main video real deve:

```text
muted = true
playsInline = true
```

e tentar:

```text
play()
```

o mais cedo possível depois da preparação mínima necessária.

Muted autoplay rejection não é fatal.

Se browser bloquear:

```text
main continua preparado
preview pode continuar
usuário ainda pode ativar foreground
```

---

# 35. Janela de Background Autoplay

Background Autoplay não precisa consumir o vídeo inteiro indefinidamente.

Enquanto o usuário ainda não ativou foreground:

```text
reproduzir aproximadamente os primeiros 8 segundos
```

e retornar ao início.

Conceitualmente:

```text
0s
→ 8s
→ 0s
```

Não utilizar `video.loop = true` sobre a duração completa como comportamento principal.

Objetivos:

```text
reduzir consumo
manter primeiros fragments quentes
manter conteúdo inicial pronto
produzir amostra útil para ABR
```

Para vídeos menores que a janela, usar naturalmente a duração disponível.

---

# 36. Background autoplay em página oculta

Enquanto o player ainda estiver apenas em Background Autoplay:

```text
document.hidden = true
→ pausar background playback
```

Ao retornar:

```text
document.visible
→ retomar se ainda estiver em background_autoplay
```

Não continuar gastando banda reproduzindo indefinidamente em aba invisível.

Não aplicar essa regra ao foreground iniciado explicitamente pelo usuário.

---

# 37. Hls.js startup quality

No caminho Hls.js:

```text
ABR continua habilitado
```

Não fixar um level permanentemente.

Depois que a ladder estiver disponível, determinar dinamicamente o maior nível cuja resolução fique aproximadamente em:

```text
<= 480p
```

durante Background Autoplay.

Aplicar via mecanismo de capping da instância HLS.

Não presumir:

```text
level 0 = resolução X
```

Usar metadata real de:

```text
hls.levels
```

---

# 38. Foreground libera qualidade

Quando o usuário ativar foreground:

```text
remover cap
```

e permitir que o ABR volte a utilizar toda a ladder.

Preservar:

```text
mesma Hls instance
mesmo bandwidth estimator
mesmo buffer
mesma source
```

Não recriar HLS.

---

# 39. Native HLS

Safari/WebKit continua utilizando HLS nativo.

Não baixar Hls.js nesses browsers apenas para obter quality cap.

Native HLS pode controlar sua própria qualidade.

A Engine deve aceitar essa diferença.

---

# 40. Startup ABR existente

Preservar:

```text
session bandwidth memory
conservative seed
testBandwidth behavior
enableWorker
HLS dynamic loading
```

Não reescrever o algoritmo de Startup ABR nesta spec além do cap de Background Autoplay.

---

# 41. React Player Core

React deixa de ser responsável por criar a mídia no caminho embed.

O Core deve receber/reutilizar:

```text
stage
main video
engine
```

existentes.

O Player Core continua responsável por:

```text
controles
CTA
menus
progress visual
fullscreen UI
loading UI
error UI
```

---

# 42. Integração transitória com EvandroPlayer

O componente:

```text
src/components/player/evandro-player.tsx
```

precisa suportar o elemento de mídia externo do embed sem criar um segundo `<video>`.

Pode existir uma API interna equivalente a:

```ts
mediaElement?: HTMLVideoElement;
engine?: PlayerEngine;
embeddedStage?: boolean;
```

Os nomes podem variar.

Quando mídia externa for fornecida:

```text
não renderizar outro <video>
não attach HLS novamente
não renderizar startup preview duplicado
```

---

# 43. Editor

O player interno do editor deve continuar funcional.

A prioridade desta spec é o caminho do embed, porém mudanças compartilhadas não podem quebrar o editor.

No editor:

```text
Thumbnail ON/OFF
Background Autoplay
preview
play
volume
rate
fullscreen
```

devem continuar funcionais.

É aceitável que o editor ainda crie sua própria mídia através do React temporariamente, desde que isso não resulte em duplicação no embed.

A próxima milestone consolidará ownership completamente.

---

# 44. PlaybackController

Não remover obrigatoriamente nesta milestone.

Pode continuar operando sobre o mesmo main video depois que React montar.

Mas:

```text
PlaybackController NÃO cria HLS
PlaybackController NÃO cria outro vídeo
```

---

# 45. PlayerRuntime

Também pode permanecer temporariamente.

Deve observar o mesmo main `HTMLVideoElement` criado antecipadamente.

Não criar runtime duplicado.

---

# 46. MediaLoadingStateManager

Pode permanecer para UX de spinner nesta milestone.

Não deve controlar Startup Visual Layer.

Startup Visual é responsabilidade da Early Media Engine/Startup coordinator.

---

# 47. Tracking

Não alterar:

```text
/api/embed/videos/[publicId]/activate
play_sessions
monthly_usage
```

Background Autoplay continua:

```text
não contabilizado
```

Foreground real continua ativando sessão assincronamente.

Não esperar tracking antes de `play()`.

---

# 48. Access Gate

Não alterar nesta spec.

O bootstrap atual continua validando entitlement antes de entregar playback URL.

A futura separação:

```text
media descriptor
+
access check
```

permanece fora deste escopo.

---

# 49. Bootstrap

Pode continuar retornando:

```text
posterUrl
backgroundPreviewUrl
playbackUrl
config
```

Adicionar somente o necessário para a nova thumbnail policy via `config`.

Não criar endpoint adicional nesta milestone.

---

# 50. Performance instrumentation

Preservar todos os marks atuais.

Adicionar quando útil:

```text
ep:engine:start
ep:engine:ready

ep:visual:preview:start
ep:visual:preview:ready

ep:visual:thumbnail:start
ep:visual:thumbnail:ready

ep:main:first-frame

ep:startup-visual:release
```

Não enviar telemetry remota.

Esses marks serão utilizados na futura observabilidade.

---

# 51. Main first frame

A Engine deve ser a autoridade do primeiro frame no embed.

Evitar dois listeners independentes disparando conceitos diferentes de first frame.

A informação deve poder ser consumida pelo Core.

---

# 52. Cleanup

Quando `<evandro-player>` for desconectado:

```text
HLS destroy
media pause
src cleanup quando apropriado
video frame callback cancel
image handlers cleanup
visibility listeners cleanup
event listeners cleanup
engine destroy
React unmount
```

`destroy()` deve ser idempotente.

---

# 53. Source change

Mudança de:

```text
video-id
```

não pode permitir que callbacks da source antiga alterem a nova sessão.

Usar:

```text
generation token
AbortController
ou mecanismo equivalente
```

para ignorar async stale.

---

# 54. Não fazer setState durante render

Não ampliar o padrão existente de sincronização por:

```tsx
if (prop !== previous) {
  setState(...)
}
```

Novos lifecycles devem ser explícitos.

A remoção completa desse padrão pode continuar na próxima engine milestone, mas nenhum código novo deve reproduzi-lo.

---

# 55. Não antecipar a Engine completa

NÃO migrar ainda, salvo quando indispensável para evitar duplicação:

```text
todos os controles
seek completo
rate architecture
volume architecture
fullscreen architecture
telemetry
resume
watched ranges
analytics
```

A próxima spec fará ownership completo.

Esta spec é:

```text
STARTUP
+
EARLY MEDIA
+
VISUAL CORRECTNESS
```

---

# 56. Arquivos principais

Inspecionar e trabalhar assertivamente em:

```text
src/components/player/evandro-player.tsx

src/components/player/engine/              [novo]

src/components/player/embed/loader-entry.ts
src/components/player/embed/player-core-entry.tsx
src/components/player/embed/embed-player.tsx
src/components/player/embed/hls-engine.ts
src/components/player/embed/hls-capabilities.ts
src/components/player/embed/startup-abr.ts
src/components/player/embed/performance-timing.ts
src/components/player/embed/embed.css

src/components/player/controllers/playback-controller.ts
src/components/player/runtime/

src/types/player-config.ts

src/components/videos/video-settings.tsx
src/components/videos/video-player-view.tsx
src/components/videos/video-embed-card.tsx

src/lib/video-providers/mux-provider.ts
src/lib/video-providers/bunny-provider.ts
src/lib/background-preview.ts
src/lib/embed/bootstrap.ts

scripts/build-embed.mjs
```

Trabalhar em arquivos adicionais apenas se usos reais exigirem.

---

# 57. Bundle budgets

Manter:

```text
Tiny Loader <= 25 KB
```

Criar relatório separado para:

```text
Player Engine
Player Core
HLS
```

Não estabelecer um budget arbitrário para Player Engine nesta primeira implementação, mas ele deve permanecer claramente menor e mais simples que Player Core.

Se Player Engine importar React acidentalmente:

```text
milestone falhou
```

---

# 58. Preview page-weight policy

A página só paga o custo do preview quando:

```text
Background Autoplay = ON
```

Quando OFF:

```text
0 request de background preview pelo player
```

A alteração dos parâmetros Mux:

```text
10s / 640 / 12fps
→
6s / 480 / 8fps
```

deve reduzir significativamente o payload potencial em comparação ao comportamento atual.

Não adicionar outro preview paralelo.

---

# 59. Critério arquitetural principal

Ao final:

```text
Tiny Loader
↓
stage existe
↓
main video existe
↓
bootstrap resolve
↓
engine recebe source
↓
HLS começa

EM PARALELO:

React Core baixa/monta
```

Não:

```text
React precisa montar
↓
para só então criar vídeo
↓
para só então começar HLS
```

---

# O QUE O USUÁRIO DEVE PERCEBER

## Background Autoplay ON

Hoje já funciona relativamente bem.

Depois desta spec deve parecer:

```text
igual ou mais rápido
```

Você deve abrir a página e receber:

```text
preview animado
OU
main video
```

o mais cedo possível.

Não deve enxergar:

```text
thumbnail estática
→ preview
```

O preview pode aparecer por uma fração de tempo e depois ser substituído suavemente pelo vídeo real.

Em conexão boa, é desejável que o main video assuma muito rapidamente.

---

## Background Autoplay OFF + Thumbnail ON

Você deve continuar vendo a thumbnail.

A principal diferença esperada é:

```text
clicar Play
→ vídeo responde mais rapidamente
```

porque o main já começou a preparar por baixo.

---

## Background Autoplay OFF + Thumbnail OFF

Essa é uma diferença nova e clara.

Você NÃO verá:

```text
thumbnail
preview animado
```

Você verá:

```text
primeiro frame real do vídeo
```

assim que ele ficar disponível.

Esse frame permanece parado e pronto para Play.

---

# O QUE NÃO DEVE MUDAR

Visualmente não devem mudar:

```text
CTA de ativar som
controles
barra de progresso
fake progress
volume
rate
fullscreen
cores
border radius
aspect ratio
menus
error UI
```

Não redesenhar o player.

---

# SEU CRITÉRIO DE TESTE

## Cenário A — Background Autoplay

Configurar:

```text
Background Autoplay = ON
```

Atualizar a página.

Esperado:

```text
1. espaço do player aparece imediatamente;
2. nenhum conteúdo da página se move;
3. thumbnail estática nunca aparece;
4. preview animado ou main video aparece rapidamente;
5. não existe flash preto entre preview e main;
6. CTA "Clique para ativar o som" aparece normalmente;
7. main continua em movimento muted;
8. ao clicar, vídeo volta ao início e toca com áudio;
9. não aparece spinner perceptível nessa transição em condição normal.
```

---

## Cenário B — Thumbnail ON

Configurar:

```text
Background Autoplay = OFF
Thumbnail = ON
```

Esperado:

```text
thumbnail aparece;
não aparece preview animado;
layout não move;
clicar Play inicia vídeo normalmente;
nenhum flash entre thumbnail e vídeo.
```

---

## Cenário C — Thumbnail OFF

Configurar:

```text
Background Autoplay = OFF
Thumbnail = OFF
```

Atualizar a página.

Esperado:

```text
nenhuma thumbnail aparece;
nenhum preview animado aparece;
player permanece geometricamente estável;
primeiro frame REAL do vídeo aparece;
frame fica parado;
clicar Play continua daquele início sem novo carregamento perceptível.
```

Este é um dos testes mais importantes.

---

## Cenário D — Alternância no editor

Alternar:

```text
Thumbnail ON
→ OFF
→ ON
```

O preview do editor deve refletir a configuração sem precisar alterar outras configurações.

Depois testar:

```text
Background Autoplay ON
```

A thumbnail deve deixar de participar do startup e o preview animado passa a ser o visual transitório permitido.

---

## Cenário E — Navegação

Abrir uma página onde o player esteja entre outros elementos.

Dar reload algumas vezes.

Esperado:

```text
texto acima não move
texto abaixo não move
player não muda de altura durante bootstrap
```

---

# FALHOU SE

A milestone falhou se você perceber qualquer um destes comportamentos:

```text
thumbnail → preview → main

thumbnail aparecendo com Thumbnail OFF

thumbnail aparecendo em Background Autoplay

preview aparecendo com Background Autoplay OFF

main aparece e depois um preview atrasado cobre o vídeo

flash preto durante handoff preview → main

player muda de altura

conteúdo da página pula

React cria segundo vídeo no embed

duas Hls instances para a mesma mídia

vídeo só começa a carregar depois de React montar

Play fica mais lento que antes

Background Autoplay trava mais que antes

preview ficou claramente mais pesado/lento que o atual
```

---

# Validação do agente

Não exigir teste manual com navegador.

Não adicionar Playwright.

Executar:

```text
pnpm typecheck
pnpm lint
pnpm build:embed
pnpm build
```

Validar estaticamente:

```text
um <video> por embed
uma Hls instance principal
Player Engine sem React
Tiny Loader <= 25 KB
novo engine bundle presente
Core separado
HLS separado
```

Verificar também que:

```text
backgroundAutoplay OFF
```

não dispara código de preload/download do background preview.

E que:

```text
thumbnail.enabled = false
```

não injeta poster visual nem `<video poster>`.

---

# Resultado esperado

Antes:

```text
Tiny Loader
  ↓
visual shell

React Core
  ↓
<video>
  ↓
HLS
```

Depois:

```text
                 Tiny Loader
                     │
          ┌──────────┴───────────┐
          │                      │
          ▼                      ▼
    Startup Visual          Player Engine
          │                      │
 Preview / Thumb             Main Video
   quando permitido              │
          │                    HLS
          │                      │
          └──────────┬───────────┘
                     │
               first main frame
                     │
                     ▼
                 Main Video

                 EM PARALELO

               Player Core
                    ↓
                 React UI
```

A experiência deve ser perceptivelmente tão rápida quanto ou mais rápida que a Spec 047, com regras visuais muito mais rígidas e sem colocar React no caminho crítico da mídia.
