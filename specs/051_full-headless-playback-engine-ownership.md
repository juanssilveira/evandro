# Spec 051 — Full Headless Playback Engine Ownership

## Status
Em andamento / Corrective Pass (Não aceita manualmente)

## Objetivo
Consolidar a propriedade exclusiva de playback, inicialização de mídia, ciclo de vida de HLS/mídia nativa e superfície de startup visual dentro do `PlayerEngine` headless, garantindo startup visual instantâneo e eliminando race conditions, flickering, fallbacks indevidos e remoção prematura de thumbnails.

---

## Problemas Identificados no Teste Manual

### 1. Startup visual deixou de ser instantâneo (Gate artificial de load/decode)
- **Sintoma:** Background Preview e thumbnails passaram a apresentar um atraso perceptível de tela preta (`black → espera → imagem`).
- **Causa:** O Engine aguardava eventos assíncronos de `load` e `decode()` da imagem offscreen antes de exibir o elemento na superfície.
- **Correção:** STARTUP VISUAL PRIME EARLY. Assim que a URL for conhecida, ela é aplicada imediatamente à superfície CSS (`background-image`). O browser renderiza os pixels assim que disponíveis. O objeto `Image` auxiliar atua unicamente como observer/fallback monitor, nunca como presentation gate.

### 2. Custom thumbnail caindo indevidamente para provider poster
- **Sintoma:** Player com custom thumbnail selecionada acabava exibindo o poster automático do provedor.
- **Causa:** Resoluções inconsistentes de URL, races entre Loader e Engine, ou poster automático agindo como placeholder antes do carregamento da custom.
- **Correção:** Prioridade absoluta para a custom thumbnail (`BG OFF + Thumbnail ON + source custom + customUrl válida → Custom Thumbnail`). O provider poster somente é exibido se houver confirmação real de erro (`onerror`) da imagem custom.

### 3. Thumbnail automática e custom piscando e desaparecendo antes do Play
- **Sintoma:** Thumbnail surge rapidamente, o primeiro frame do vídeo é decodificado por baixo, a thumbnail desaparece e expõe o vídeo pausado antes de qualquer clique do usuário.
- **Causa:** `PlayerEngine.loadSource()` inicializava players BG OFF com `playbackInitiator = "user"` mesmo sem qualquer interação do usuário. No callback de first-frame, a regra `isBg || !thumbEnabled || userForegroundRequested || playbackInitiator === "user"` disparava a liberação imediata da thumbnail.
- **Correção:** Apenas carregar/preparar mídia em BG OFF define `playbackInitiator = "system"` (não `"user"`). A autoridade para liberação por intenção do usuário passa a ser exclusivamente `userForegroundRequested === true`.

---

## Semântica Canônica de Playback Initiator

1. **Carga e preparação inicial (BG OFF):**
   - `playbackInitiator = "system"`
   - `userForegroundRequested = false`
   - Carregar ou pré-bufferizar mídia não constitui intenção do usuário.

2. **Background Autoplay inicial (BG ON):**
   - `playbackInitiator = "autoplay"`
   - `userForegroundRequested = false`

3. **Ação explícita do usuário:**
   - `startForeground()` ou `play("user")` ou clique explícito
   - `playbackInitiator = "user"`
   - `userForegroundRequested = true`

---

## Regra Canônica de First-Frame Release

O primeiro frame decodificado do vídeo libera a startup visual surface **apenas** quando uma destas condições for verdadeira:

```text
isBg || !thumbEnabled || userForegroundRequested
```

Onde:
- `isBg`: Background Autoplay está ativo (`experience === "background_autoplay"`).
- `!thumbEnabled`: Thumbnail de inicialização está desativada na configuração.
- `userForegroundRequested`: O usuário solicitou explicitamente a reprodução em primeiro plano.

**Nunca** utilizar genericamente `playbackInitiator === "user"` como critério de liberação do primeiro frame.

### Comportamento BG OFF + Thumbnail ON antes do Play
- `userForegroundRequested === false`
- O primeiro frame pode ser decodificado e bufferizado por baixo com `opacity: 1` no elemento `<video>`.
- A startup surface permanece com `z-index: 1`, opaca e visível sobre o vídeo.
- **Resultado:** A thumbnail permanece perfeitamente visível até a interação do usuário.

### Play após first frame já preparado
- Usuário clica em Play / Big Play Button / container.
- `userForegroundRequested = true`.
- Como `hasFirstFrame === true`, `releaseStartupVisual()` é executado imediatamente.
- O vídeo em primeiro plano é revelado sem latência e sem flash preto.

### Play antes do first frame ser preparado
- Usuário clica em Play enquanto a mídia ainda está conectando/bufferizando.
- `userForegroundRequested = true`.
- `startupVisualState` passa para `"pending_release"`.
- A thumbnail permanece visível cobrindo o aquecimento do vídeo.
- Assim que o first frame chega, a startup surface é liberada suavemente (`70ms`).
- **Resultado:** USER PLAYBACK WINS preservado sem flash preto.

### Safety Guard do evento `playing`
- O listener de `playing` no elemento de vídeo deve verificar `userForegroundRequested === true` antes de liberar a startup surface em `experience === "foreground"`.
- Um evento `playing` espúrio ou disparado por preparação em background não pode remover a thumbnail antes da interação do usuário.

---

## Startup Visual Instantâneo (STARTUP VISUAL PRIME EARLY)

### Princípio
Assim que a URL correta do startup visual for conhecida (seja no Tiny Loader após bootstrap ou no Engine Standalone), ela deve ser aplicada imediatamente à startup visual surface.

**Não esperar:**
- `img.onload`
- `img.decode()`
- Carregamento do Player Core
- Download de manifesto HLS ou primeiro segmento
- First frame do vídeo

### Surface Segura (CSS Background Surface)
A apresentação visual é realizada diretamente via propriedades CSS no container:
- `background-color: #000;`
- `background-image: url("...");`
- `background-size: cover;`
- `background-position: center;`
- `background-repeat: no-repeat;`

**Vantagens:**
- Sem broken-image glyph nativo do browser em caso de lentidão ou falha transitória.
- Browser pinta os pixels progressivamente sem barreira de execução de JS.
- Nenhum elemento `<img>` visível obrigatório no caminho crítico.
- Suporte nativo a WebP animado.

### Image Auxiliar (Observer / Fallback Monitor)
Um objeto `new Image()` offscreen é utilizado exclusivamente para:
1. Registrar performance marks (`ep:visual:*:ready`).
2. Detectar erro real (`onerror`) e acionar o fallback para provider poster quando cabível.
3. Este objeto é um observador assíncrono e **não** atua como presentation gate.

---

## Resolver Canônico de Startup Visual

Uma única política de resolução pura compartilhada entre Tiny Loader e Player Engine (`resolveStartupVisual`):

```text
1. Background Autoplay ON:
   - Se backgroundPreviewUrl existir:
     → { type: "preview", url: backgroundPreviewUrl, fallbackUrl: null }
   - Se não existir:
     → { type: "none", url: null, fallbackUrl: null } (Superfície preta)
   * Startup thumbnail nunca participa no modo BG ON.

2. Background Autoplay OFF + Thumbnail OFF:
   → { type: "none", url: null, fallbackUrl: null } (Superfície preta → first frame)

3. Background Autoplay OFF + Thumbnail ON + source "custom":
   - Se customUrl existir e for válida:
     → { type: "custom", url: customUrl, fallbackUrl: posterUrl } (Prioridade Absoluta)
   - Se customUrl estiver vazia mas posterUrl existir:
     → { type: "provider", url: posterUrl, fallbackUrl: null }
   - Se nenhuma existir:
     → { type: "none", url: null, fallbackUrl: null }

4. Background Autoplay OFF + Thumbnail ON + source "provider":
   - Se posterUrl existir:
     → { type: "provider", url: posterUrl, fallbackUrl: null }
   - Se não existir:
     → { type: "none", url: null, fallbackUrl: null }
```

### Política de Fallback Custom → Provider
- A custom thumbnail é aplicada imediatamente na superfície.
- O observer `Image` monitora o carregamento da custom URL.
- Se a custom carregar com sucesso: permanece a custom.
- Se a custom disparar erro real (`onerror`) confirmado: a superfície é atualizada para `fallbackUrl` (provider poster).
- O provider poster **nunca** é exibido antes da confirmação do erro.

---

## Integração com Tiny Loader e Handoff para o Engine

### Ciclo no Embed
1. Tiny Loader inicializa synchronously o Persistent Stage, Video Element e Startup Visual Container.
2. Bootstrap retorna config, `posterUrl`, `backgroundPreviewUrl` e custom thumbnail.
3. Loader executa `resolveStartupVisual()`.
4. Loader executa `preloadVisualAsset(visual.url)` (Link preload high-priority).
5. Loader aplica `applyStartupVisualSurface(el, visual)` imediatamente.
6. Player Engine é carregado e inicializado.
7. `PlayerEngine.loadSource()` executa o mesmo resolver canônico.
8. **Adoção Transparente:** Ao detectar que a startup surface já possui o mesmo asset aplicado (`data-startup-url === visual.url`), o Engine adota a superfície sem limpar, sem flash preto e sem novo request.
9. Player Core monta posteriormente no `uiRoot`.

### Standalone / Editor
- No Editor (onde o Tiny Loader não atua), `PlayerEngine.loadSource()` resolve e aplica o asset imediatamente à superfície ao iniciar.
- Paridade total de comportamento visual entre editor e embed.

### Normalização de URLs Custom
- URLs relativas de custom thumbnails e assets no bootstrap/config são normalizadas contra o `apiBase` / `CDN_URL` oficial do Evandro, garantindo que embeds em domínios de terceiros resolvam os assets corretamente.

---

## Lifecycle, Idempotência e Generation Guard

1. **Idempotência de `releaseStartupVisual()`:**
   - Marca `startupVisualState = "released"`.
   - Aborta controllers visuais pendentes.
   - Aplica fade-out CSS de 70ms e remove `background-image` e atributos após a transição.
   - Chamadas subsequentes no mesmo ciclo não produzem efeitos colaterais.

2. **Generation Guard:**
   - Cada chamada a `loadSource()` incrementa `_generation`.
   - Callbacks atrasados de imagens, manifests HLS ou first frame de gerações anteriores são ignorados imediatamente.
   - Callbacks tardios não podem reexibir startup visual após a transição para playback foreground.

3. **Pause Thumbnail Preservada:**
   - O ciclo da Pause Thumbnail permanece independente (`pauseThumbnail.showPlayButton`, imagem de pausa personalizada, fallback "Continue assistindo", clique para retomar e remoção imediata no evento `play`/`playing`).

---

## Matriz de Cenários de Teste Manual

### Cenário A — Provider thumbnail antes do Play
- **Config:** BG OFF, Thumbnail ON, Source Automática (provider).
- **Ação:** F5 na página.
- **Resultado Esperado:** Provider thumbnail permanece visível continuamente. Mesmo que o first frame seja decodificado por baixo, a thumbnail permanece. Somente após o usuário clicar em Play o vídeo assume.

### Cenário B — Custom thumbnail antes do Play
- **Config:** BG OFF, Thumbnail ON, Source Personalizada (custom válida).
- **Ação:** F5 na página.
- **Resultado Esperado:** Custom thumbnail visível imediatamente e permanece contínua. Provider poster nunca aparece. First frame decodifica por baixo sem substituir a imagem custom.

### Cenário C — Custom + Play Button OFF
- **Config:** BG OFF, Thumbnail ON, Source Personalizada, Play Button desativado.
- **Ação:** F5 na página.
- **Resultado Esperado:** Imagem custom cobre o player sem botão central. Clique em qualquer área inicia o playback e libera a imagem.

### Cenário D — Play com first frame já pronto
- **Config:** BG OFF, Thumbnail ON.
- **Ação:** Aguardar 2s (mídia bufferizada por baixo) e clicar em Play.
- **Resultado Esperado:** Liberação instantânea da thumbnail (`70ms` fade) e início imediato do vídeo foreground com áudio.

### Cenário E — Play antes do first frame
- **Config:** BG OFF, Thumbnail ON.
- **Ação:** Clicar em Play imediatamente após o carregamento inicial da página (Fast Click).
- **Resultado Esperado:** Thumbnail permanece visível durante a conexão da mídia (`pending_release`). Assim que o first frame chega, a thumbnail é liberada suavemente sem flash preto.

### Cenário F — Thumbnail OFF
- **Config:** BG OFF, Thumbnail OFF.
- **Ação:** F5 na página.
- **Resultado Esperado:** Fundo preto até o first real frame, que é exibido imediatamente assim que decodificado. Nenhuma thumbnail exibida.

### Cenário G — Background Autoplay
- **Config:** BG ON, Thumbnail OFF ou ON.
- **Ação:** F5 na página.
- **Resultado Esperado:** Background Preview exibido o mais cedo possível, seguido imediatamente pela transição suave para o vídeo mudo em loop. Configuração de thumbnail não participa.

### Cenário H — Custom inválida (Fallback confirmado)
- **Config:** BG OFF, Thumbnail ON, Source Custom com URL que retorna 404/erro de rede.
- **Ação:** F5 na página.
- **Resultado Esperado:** Superfície preta durante a tentativa da custom. Ao confirmar o erro no observer `Image`, o fallback exibe o provider poster. O provider nunca aparece antes da confirmação de erro da custom.

### Cenário I — Cache quente
- **Config:** Qualquer modo com assets em cache do navegador.
- **Ação:** F5 na página.
- **Resultado Esperado:** Apresentação visual praticamente instantânea após a disponibilidade da URL no bootstrap, sem delays artificiais de JavaScript.

### Cenário J — Cache frio
- **Config:** Navegador com cache limpo / conexão móvel.
- **Ação:** F5 na página.
- **Resultado Esperado:** Superfície preta apenas durante o download do bootstrap e bytes iniciais. Nenhum gate adicional de decode/load após a chegada da URL.

---

## Critérios de Aceite Técnicos

- [x] Semântica de `playbackInitiator`: BG OFF inicia com `"system"`, somente ações explícitas definem `"user"`.
- [x] Regra de first-frame release: `isBg || !thumbEnabled || userForegroundRequested`.
- [x] Startup visual não bloqueado por `img.onload` ou `img.decode()`.
- [x] Tiny Loader prima a startup visual surface imediatamente no bootstrap.
- [x] Player Engine adota a superfície já primada sem flicker ou requisições redundantes.
- [x] Fallback custom → provider poster ocorre unicamente após erro real confirmado.
- [x] Broken-image glyph nativo impossibilitado pelo uso de CSS background surface.
- [x] USER PLAYBACK WINS preservado sem flash preto em cliques imediatos ou tardios.
- [x] Bundles dentro dos limites arquiteturais: Tiny Loader <= 25 KB minified.
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm build:embed` e `pnpm build` executam com 0 erros.