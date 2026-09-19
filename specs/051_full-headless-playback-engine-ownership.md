# Spec 051 — Full Headless Playback Engine Ownership

## Status
Em andamento / Corrective Pass (Não aceita manualmente)

## Objetivo
Consolidar a propriedade exclusiva de playback, inicialização de mídia, ciclo de vida de HLS/mídia nativa e superfície de startup visual dentro do `PlayerEngine` headless, garantindo startup visual instantâneo e eliminando race conditions, flickering, fallbacks indevidos, remoção prematura de thumbnails, e polindo a experiência de controle de Play buttons e Pause Thumbnail.

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

### 4. Piscada de Black + Play Button antes da thumbnail inicial carregar
- **Sintoma:** F5 na página mostrava fundo preto com o botão de Play central renderizado por cima por alguns milissegundos antes da thumbnail aparecer atrás do botão.
- **Causa:** No Standalone/Editor, a surface inicial era renderizada sem estilo `background-image` enquanto o `useEffect` criava o Engine e executava `loadSource()`. No Embed, o Core React podia pintar o overlay de Big Play antes do bootstrap resolver a URL da thumbnail.
- **Correção:** No Standalone/Editor, a startup surface recebe `initialVisual` de forma síncrona/pura já no primeiro render. No Embed e Core, o overlay de Big Play possui a condição `showStartupPlayButton && isStartupReady`, impedindo que o Play seja exibido sobre uma tela preta quando há thumbnail configurada e esperada.

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
- A startup surface permanece com `z-index: 5` (standalone) / `z-index: 1` (embed stage), opaca e visível sobre o vídeo.
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

## Corrective UI Polish — Thumbnail Controls & Pause Experience

### 1. Fake Progress Bar sobre a Custom Pause Thumbnail
- **Camada:** A Fake Progress Bar agora possui `z-index: 15`, posicionando-se visualmente acima da Custom Pause Thumbnail (`z-index: 12`) e abaixo dos controles flutuantes de reprodução (`z-index: 20`).
- **Comportamento no Pause:** A Fake Progress Bar mantém o percentual alcançado no momento da pausa, congela sem resetar e sem continuar avançando enquanto o vídeo estiver pausado. Retoma o avanço normalmente quando a reprodução recomeça.
- **Pass-through de cliques:** A barra permanece `pointer-events: none`, permitindo que cliques em qualquer região continuem acionando o resume da Pause Thumbnail.

### 2. Play Button Animado da Custom Pause Thumbnail
- Quando `pauseThumbnail.showPlayButton === true`:
  - Botão central circular renderizado com `var(--player-accent)` e `var(--player-accent-foreground)`.
  - **Ondas Concêntricas:** 3 anéis/ondas concêntricos animados (`ep-pause-wave-1`, `ep-pause-wave-2`, `ep-pause-wave-3`) expandem-se a partir do botão com duração de `2.4s` e delays escalonados (`0s`, `0.8s`, `1.6s`), desvanecendo a opacidade progressivamente (`0.55 → 0.22 → 0`).
  - **Breathing Pulse:** O botão central respira sutilmente com escala de `1` a `1.045` (`ep-pause-pulse`).
  - **Acessibilidade:** `prefers-reduced-motion: reduce` desativa integralmente as ondas e o pulse contínuo, mantendo o botão estático e 100% funcional.
  - **Pointer Events:** As ondas e o botão possuem `pointer-events: none`; o clique em qualquer parte da thumbnail retoma o playback.
  - Quando `pauseThumbnail.showPlayButton === false`, nenhum elemento visual de Play é renderizado.

### 3. Play Button da Thumbnail Inicial: Suporte Universal (Automática e Personalizada)
- **Supersessão da Spec 050:** A regra anterior da Spec 050 que limitava `showPlayButton` exclusivamente a thumbnails personalizadas e forçava `true` para automáticas é **SUPERADA**.
- `appearance.thumbnail.showPlayButton` passa a controlar o botão central de Play da THUMBNAIL INICIAL independentemente da source (`provider` ou `custom`).
- O switch *"Mostrar botão de reprodução"* fica disponível no editor tanto para o modo *Automática* quanto *Personalizada* sempre que `thumbnail.enabled = true`.
- **Preservação de Escolha:** Alternar entre *Automática* e *Personalizada* preserva o valor de `showPlayButton`. Remover uma thumbnail personalizada (`kind: "startup"`) restaura a source para `provider` mantendo o valor configurado de `showPlayButton` (não reseta para `true`).
- **Fallback Custom → Provider:** Em caso de erro na custom thumbnail, o fallback para o provider poster preserva integralmente o estado de `showPlayButton`.

### 4. Eliminação da Piscada Black + Play Button
- **Editor / Standalone:** `EvandroPlayer` resolve `initialVisual` de maneira síncrona a partir das props iniciais e insere o estilo inline `background-image` diretamente no JSX da surface. O browser recebe e renderiza a imagem no primeiro commit, sem aguardar o ciclo de `useEffect` do Engine.
- **Embed:** O Tiny Loader já cria a surface e prima o asset imediatamente após a resposta do bootstrap. O componente Core monta com a checagem `isStartupReady`, garantindo que o Big Play inicial só seja exibido quando a startup visual estiver primada ou o first frame chegar, evitando o flash preto com botão de Play isolado.
- **Limite Arquitetural do Cold-Start Embed:** Em uma primeira visita sem cache, o player permanece preto apenas durante o intervalo estritamente necessário para o fetch do bootstrap `/api/embed/videos/:id`. Não são criados caches inseguros de localStorage ou bypasses de quota/access para ocultar esse tempo de rede.

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
- No Editor (onde o Tiny Loader não atua), `EvandroPlayer` prima a startup surface no primeiro frame síncrono e `PlayerEngine.loadSource()` adota o elemento ao iniciar.
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

## Matriz de Cenários de Teste Manual (Aguardando Validação)

### Cenário A — Automática + Play ON
- **Config:** BG OFF, Thumbnail ON, Source Automática (provider), Play Button ON.
- **Ação:** F5 na página.
- **Resultado Esperado:** Provider Thumbnail + Play central exibidos juntos. Sem flash perceptível de black + Play antes da imagem.

### Cenário B — Automática + Play OFF
- **Config:** BG OFF, Thumbnail ON, Source Automática (provider), Play Button OFF.
- **Ação:** F5 na página.
- **Resultado Esperado:** Provider Thumbnail limpa, sem Play central. Imagem inteira clicável para iniciar playback. Sem overlays escuros residuais.

### Cenário C — Custom + Play ON
- **Config:** BG OFF, Thumbnail ON, Source Personalizada, Play Button ON.
- **Ação:** F5 na página.
- **Resultado Esperado:** Custom Thumbnail + Play central. Nunca exibe black + Play antes da imagem custom.

### Cenário D — Custom + Play OFF
- **Config:** BG OFF, Thumbnail ON, Source Personalizada, Play Button OFF.
- **Ação:** F5 na página.
- **Resultado Esperado:** Custom Thumbnail limpa, sem botão central. Imagem inteira clicável para iniciar playback.

### Cenário E — Alternar Source (Preservação de Play Button)
- **Config:** Automática com Play Button OFF.
- **Ação:** Trocar para Personalizada e voltar para Automática no editor.
- **Resultado Esperado:** `showPlayButton = false` é preservado em todas as transições.

### Cenário F — Remover Custom (Preservação de Play Button)
- **Config:** Personalizada ativa com Play Button OFF.
- **Ação:** Clicar em "Remover" thumbnail personalizada.
- **Resultado Esperado:** Source volta para provider e `showPlayButton` continua `false` (não reseta para `true`).

### Cenário G — Custom Fallback (Preservação de Play Button)
- **Config:** Custom inválida com Play Button OFF (e depois com ON).
- **Ação:** Disparar erro de rede na custom.
- **Resultado Esperado:** Provider poster fallback assume preservando exatamente a preferência de `showPlayButton` (sem Play quando false, com Play quando true).

### Cenário H — Pause Thumbnail + Fake Progress
- **Config:** Fake Progress ON, Pause Thumbnail ON, Pause Play Button ON.
- **Ação:** Reproduzir por alguns segundos e pausar.
- **Resultado Esperado:** Custom Pause Thumbnail exibida com Fake Progress visível por cima (`z-15`) e Play Button com ondas concêntricas animadas. Fake Progress não avança durante a pausa.

### Cenário I — Pause Play OFF
- **Config:** Pause Thumbnail ON, Pause Play Button OFF.
- **Ação:** Pausar vídeo em foreground.
- **Resultado Esperado:** Custom Pause Thumbnail com Fake Progress sobreposta, sem Play central e sem ondas. Imagem inteira clicável.

### Cenário J — Reduced Motion
- **Config:** Ativar `prefers-reduced-motion: reduce` no sistema/navegador.
- **Ação:** Pausar com Play Button ON.
- **Resultado Esperado:** Botão de Play da pausa permanece visível e estático; ondas e pulse contínuos são desativados.

### Cenário K — Editor First Paint
- **Config:** Editor de vídeo com Provider ou Custom thumbnail configurada.
- **Ação:** F5 na página.
- **Resultado Esperado:** A thumbnail é pintada no primeiro frame renderizado pelo React. Sem flash de black + Play.

### Cenário L — Embed Cache Quente
- **Config:** Player embed com assets em cache do navegador.
- **Ação:** Recarregar página externa contendo `<evandro-player>`.
- **Resultado Esperado:** Apresentação da thumbnail praticamente instantânea após a resolução do bootstrap, sem exibição prévia de Play sobre tela preta.

### Cenário M — Embed Cache Frio
- **Config:** Limpar cache do navegador e recarregar player embed.
- **Ação:** F5 na página.
- **Resultado Esperado:** Fundo preto durante o fetch do bootstrap. Assim que a URL chega, a thumbnail é apresentada sem gates artificiais de decode. Play não surge sobre o preto enquanto o bootstrap estiver pendente.

---

## Critérios de Aceite Técnicos

- [x] Semântica de `playbackInitiator`: BG OFF inicia com `"system"`, somente ações explícitas definem `"user"`.
- [x] Regra de first-frame release: `isBg || !thumbEnabled || userForegroundRequested`.
- [x] Startup visual não bloqueado por `img.onload` ou `img.decode()`.
- [x] Tiny Loader prima a startup visual surface imediatamente no bootstrap.
- [x] Player Engine adota a superfície já primada sem flicker ou requisições redundantes.
- [x] Standalone / Editor prima startup visual síncrona no primeiro paint React.
- [x] Big Play button não aparece sobre tela preta aguardando thumbnail inicial.
- [x] `thumbnail.showPlayButton` controla thumbnails Automática e Personalizada.
- [x] Alternar ou remover thumbnail personalizada preserva `showPlayButton`.
- [x] Fake Progress Bar (`z-15`) visível sobre a Custom Pause Thumbnail (`z-12`) e congela durante pause.
- [x] Pause Play Button possui 3 ondas concêntricas animadas e pulse, respeitando `prefers-reduced-motion`.
- [x] Fallback custom → provider poster ocorre unicamente após erro real confirmado.
- [x] Broken-image glyph nativo impossibilitado pelo uso de CSS background surface.
- [x] USER PLAYBACK WINS preservado sem flash preto em cliques imediatos ou tardios.
- [x] Bundles dentro dos limites arquiteturais: Tiny Loader <= 25 KB minified.
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm build:embed` e `pnpm build` executam com 0 erros.
- [ ] Validação manual em todos os cenários (A a M) aguardando teste do usuário.