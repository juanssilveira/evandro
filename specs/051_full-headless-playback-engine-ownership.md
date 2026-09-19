# 1. Nome da spec

051_full-headless-playback-engine-ownership.md

# 2. Spec

## 051 — Full Headless Playback Engine Ownership

### Estado da milestone

A Spec 050 — Thumbnail Play Button Visibility & Editor UI Polish já foi implementada em `development`.

A Spec 051 ainda não foi implementada e ainda não foi aceita.

Antes de iniciar qualquer trabalho, o agente deve conferir novamente o HEAD atual de `development` e usar o código real como fonte de verdade.

### Objetivo

Concluir a consolidação do Evandro Player para que exista uma única autoridade sobre playback, mídia, first frame e lifecycle visual de startup: o `PlayerEngine`.

Esta milestone também deve corrigir duas races visuais já observadas manualmente:

- ao clicar Play muito cedo, antes do first frame, a thumbnail de startup pode permanecer presa sobre um vídeo que já começou a reproduzir;
- com Background Autoplay ativo, após F5, o browser pode exibir por um instante o ícone nativo de imagem quebrada antes de o Background Preview aparecer.

As duas situações devem ser tratadas como sintomas do mesmo problema: hoje o playback e o startup visual ainda não possuem uma única fonte autoritativa.

### Invariantes finais

Para cada Evandro Player funcional deve existir:

- exatamente 1 `HTMLVideoElement` principal;
- exatamente 1 `PlayerEngine`;
- no máximo 1 instância HLS principal;
- exatamente 1 authority de playback;
- exatamente 1 authority de first frame;
- exatamente 1 lifecycle autoritativo de startup visual;
- 0 owners concorrentes de source/HLS/playback.

Isso vale para:

- embed;
- editor;
- standalone.

React deve atuar principalmente como UI, interação e renderização de estado.

### Problema arquitetural atual

No embed, o caminho já é conceitualmente:

Tiny Loader → Persistent Stage → Persistent HTMLVideoElement → PlayerEngine → React Core.

Porém ainda existem responsabilidades distribuídas entre:

- `PlayerEngine`;
- `PlaybackController`;
- `PlayerRuntime`;
- handlers React;
- lifecycle HLS mantido no React para editor/standalone;
- detecção de first frame no React;
- estado visual de thumbnail/preview no React.

Isso permite:

- races;
- stale state;
- overlays presos;
- listeners duplicados;
- divergência entre editor e embed;
- mais de uma camada tentando decidir qual superfície deve estar visível.

### Regra arquitetural obrigatória: USER PLAYBACK WINS

Adicionar uma invariável explícita:

**USER PLAYBACK WINS**

A partir do momento em que o usuário solicita explicitamente foreground playback, qualquer visual de startup deixa de possuir autoridade sobre a experiência.

São considerados startup visuals:

- provider thumbnail;
- custom startup thumbnail;
- Background Preview WebP;
- startup shell do Tiny Loader;
- qualquer imagem visual temporária utilizada para esconder warming.

Isso não significa remover a imagem obrigatoriamente no mesmo milissegundo do clique.

Se ainda não existe um frame real disponível, a imagem pode continuar temporariamente para evitar black flash.

O lifecycle esperado é:

1. usuário solicita foreground;
2. Engine registra explicitamente a intenção do usuário;
3. startup visual entra em estado equivalente a `pending_release`;
4. mídia continua preparando;
5. primeiro frame real fica disponível;
6. main video é revelado;
7. todos os startup visuals são liberados definitivamente.

### Bug obrigatório: thumbnail presa após Play antecipado

Reprodução do problema:

1. F5;
2. startup thumbnail aparece;
3. usuário clica Play antes do vídeo possuir first frame;
4. `startForeground()` é executado;
5. `hasFirstFrame` ainda é `false`;
6. thumbnail permanece;
7. first frame chega posteriormente;
8. vídeo aparece;
9. thumbnail pode continuar sobre o vídeo porque a configuração ainda diz que a thumbnail está enabled.

Isso deve deixar de ser possível.

Depois que o usuário solicitou foreground, `thumbnail.enabled` não pode ser usado como motivo para manter a startup thumbnail depois do primeiro frame real.

A regra correta é:

- antes do Play explícito, a config decide qual startup visual deve aparecer;
- depois do Play explícito, o estado real de playback decide qual visual pode permanecer.

### Estado explícito de foreground solicitado pelo usuário

O Engine deve possuir estado equivalente a:

- `playbackInitiator = "user"`;
- `userForegroundRequested = true`;

ou nomenclatura semanticamente equivalente.

Esse estado não deve depender de React inferir que houve clique a partir de outros flags.

### First frame + user foreground

No callback autoritativo de first frame:

Se foreground foi solicitado explicitamente pelo usuário:

- revelar o vídeo;
- liberar startup visual;
- marcar startup visual como released.

Isso deve acontecer independentemente de:

- `thumbnail.enabled`;
- source provider/custom;
- showPlayButton;
- estado anterior do preview.

### First frame sem Play explícito

Preservar o comportamento de preparação antecipada.

Com BG OFF + Thumbnail ON, o player pode obter first frame por baixo antes do usuário clicar Play.

Nesse caso, a thumbnail deve continuar aparecendo.

First frame sozinho não significa remover a thumbnail.

A condição que força o release é:

**first frame + user foreground requested**

### Lifecycle autoritativo do startup visual

Modelar conceitualmente um lifecycle equivalente a:

- `available`;
- `loading`;
- `visible`;
- `pending_release`;
- `released`.

Os nomes podem variar.

A regra importante é:

**released é terminal para aquele source.**

Depois de released, a startup visual não pode reaparecer sem:

- novo source;
- novo `video-id`;
- reset explícito equivalente de lifecycle.

### releaseStartupVisual deve ser idempotente

A operação de release pode ser acionada por mais de um caminho:

- `startForeground`;
- first frame;
- safety check de `playing`.

Chamadas repetidas não podem causar:

- flicker;
- timers concorrentes;
- DOM inconsistente;
- dupla animação;
- reinserção de visual antigo.

### `playing` como proteção adicional

Se o Engine confirmar:

- experience = foreground;
- playbackInitiator = user;
- isPlaying = true;

então nenhum startup visual pode permanecer ativo.

Isso funciona como safety guard.

Não substituir o first-frame boundary por `playing`, porque o first frame continua necessário para evitar black flash.

---

## Background Preview instantâneo e sem broken-image glyph

### Política visual continua igual

Preservar:

- BG ON → Background Preview WebP;
- BG OFF + Thumbnail ON → provider/custom startup thumbnail;
- BG OFF + Thumbnail OFF → black surface / first real frame.

Em especial:

**Thumbnail inicial OFF + Background Autoplay ON**

continua significando:

**Background Preview WebP**

`thumbnail.enabled` não interfere no Background Preview.

### Bug obrigatório: broken-image glyph

Hoje, no editor/standalone, uma imagem pode ser renderizada visualmente com `src` antes de o asset estar pronto.

Isso permite que o browser mostre:

- broken-image glyph;
- alt text;
- imagem vazia;
- artefato visual momentâneo.

Após esta spec, isso não é permitido.

### Regra de readiness de imagem

O request deve começar o mais cedo possível.

Mas:

**request iniciado != imagem autorizada a aparecer**

O asset só pode se tornar visualmente visível depois de:

- `load` confirmado;
- ou `decode()` confirmado;
- ou mecanismo equivalente seguro.

Enquanto a imagem ainda não estiver pronta:

- manter black surface;
- não renderizar visualmente um `<img>` quebrado.

### Não mascarar com CSS

Não esconder apenas o ícone de imagem quebrada com CSS.

Corrigir o lifecycle.

O browser não deve receber uma imagem visível antes de ela estar pronta para ser apresentada.

### Preservar perceived speed

A correção não pode atrasar desnecessariamente o preview.

Preservar:

- early bootstrap;
- `preloadVisual`;
- `fetchPriority="high"` quando aplicável;
- request assim que a URL estiver disponível;
- carregamento independente de HLS/manifest/first frame.

Com cache quente, o preview deve continuar praticamente instantâneo.

Com cache frio, é aceitável:

black → preview válido

Não é aceitável:

broken image → preview válido.

### BG ON não usa startup thumbnail como fallback

Quando Background Autoplay está ON e o Background Preview ainda não ficou pronto:

usar temporariamente black surface.

Não usar como fallback:

- provider thumbnail;
- custom startup thumbnail.

Background Preview e startup thumbnail continuam sendo produtos visuais separados.

### Erro real de Background Preview

Se o preview falhar:

- não mostrar broken-image glyph;
- não cair para provider/custom startup thumbnail;
- manter black surface;
- revelar main video quando first frame chegar.

Fluxo esperado:

black → first main frame → video.

### Late-load race

Tratar explicitamente:

1. preview começa a carregar;
2. main video vence;
3. startup visual é released;
4. preview termina de carregar depois.

Resultado obrigatório:

**ignorar o preview atrasado.**

Nenhum callback tardio pode inserir novamente startup visual.

Essa regra vale para:

- Background Preview;
- provider thumbnail;
- custom startup thumbnail.

---

## Pause Thumbnail é outro lifecycle

Pause Thumbnail não é startup visual.

Ela pode aparecer depois que foreground playback já começou quando:

- vídeo está pausado;
- pause thumbnail está enabled;
- existe custom URL válida.

Quando `isPlaying = true`:

- Pause Thumbnail deve estar hidden;
- Continue assistindo deve estar hidden.

Ao retomar playback, a camada de pause deve sair imediatamente.

Ela nunca pode ficar presa sobre vídeo reproduzindo.

A configuração da Spec 050 continua válida:

- `thumbnail.showPlayButton`;
- `pauseThumbnail.showPlayButton`.

Esses campos são apenas de apresentação.

Eles não alteram:

- startup lifecycle;
- media ownership;
- release rules;
- first frame;
- playback commands.

---

## PlayerEngine obrigatório

### Embed

Continuar utilizando a Engine criada pelo Tiny Loader.

React recebe:

- `mediaElement`;
- `engine`;

e adota ambos.

React não cria segunda Engine.

React não destrói a Engine externa em unmount do Core.

### Editor / standalone

Quando não existir Engine externa:

- React cria/renderiza o `HTMLVideoElement`;
- cria uma Engine associada a esse elemento;
- chama `engine.loadSource()`.

Utilizar a mesma implementação de PlayerEngine do embed.

Não manter lifecycle HLS paralelo em React.

### Lifetime

Engine acompanha o vídeo.

Não recriar por:

- config update;
- thumbnail update;
- pause thumbnail update;
- accent color;
- border radius;
- controls;
- volume;
- rate.

Novo source pode reutilizar a mesma Engine via `loadSource()`.

---

## Source/HLS ownership

Somente o Engine pode controlar operações equivalentes a:

- `video.src = ...`;
- `video.load()`;
- `new Hls()`;
- `hls.loadSource()`;
- `hls.attachMedia()`;
- `hls.destroy()`;
- `hls.startLoad()`;
- `hls.recoverMediaError()`.

`evandro-player.tsx` não deve continuar com lifecycle HLS próprio.

Remover do React, quando usados como ownership:

- `hlsRef`;
- `attachMediaSource`;
- `loadHlsEngine`;
- `shouldUseNativeHls`;
- `createStartupHlsConfig`;
- `saveBandwidthEstimate`;
- seleção Native HLS;
- recovery HLS;
- attach/destroy.

### Bundles

Preservar arquitetura separada:

- Tiny Loader;
- Player Engine;
- Player Core;
- HLS Light.

Não resolver a consolidação colocando HLS/Engine dentro do Player Core de forma duplicada.

Safari/native path continua podendo carregar 0 bytes de HLS.js quando aplicável.

---

## Playback commands passam pelo Engine

Toda mutação funcional da mídia deve passar pelo PlayerEngine.

Incluindo:

- Play;
- Pause;
- Background → Foreground;
- Seek;
- Volume;
- Mute;
- Playback Rate;
- Background Autoplay transitions.

API conceitual:

- `engine.play()`;
- `engine.pause()`;
- `engine.seek(time)`;
- `engine.setVolume(volume)`;
- `engine.setMuted(muted)`;
- `engine.setPlaybackRate(rate)`;
- `engine.startForeground(...)`;
- API apropriada para atualização de Background Autoplay/config.

Os nomes exatos podem variar.

### React deixa de controlar diretamente a mídia

Handlers React não devem executar diretamente, como owner normal:

- `video.play()`;
- `video.pause()`;
- `video.currentTime = ...`;
- `video.volume = ...`;
- `video.muted = ...`;
- `video.playbackRate = ...`.

React expressa intenção.

Engine realiza o comando.

---

## Estado canônico do Engine

Expandir `PlayerEngineState` conforme necessário para cobrir ao menos:

- `videoId`;
- `playbackUrl`;
- `experience`;
- `playbackInitiator`;
- `userForegroundRequested`;
- `isPlaying`;
- `isMuted`;
- `volume`;
- `currentTime`;
- `duration`;
- `bufferedEnd`;
- `playbackRate`;
- `hasFirstFrame`;
- `hasStartedForeground`;
- `isBuffering`;
- `isEnded`;
- `hasError`;
- `errorMessage`.

Nomes podem variar.

Regra:

**se é um fato de playback, o Engine é a fonte canônica.**

---

## PlaybackController

Preferência: remover `PlaybackController`.

Se permanecer temporariamente, ele não pode tocar diretamente no `HTMLVideoElement`.

Só pode delegar comandos para o PlayerEngine.

Não manter duas abstrações com autoridade equivalente.

---

## PlayerRuntime

Pode permanecer para:

- events;
- snapshots;
- debug;
- `onEvent`;
- `onRuntimeReady`;
- futuro Tracker.

Mas apenas como observer.

Não pode:

- comandar mídia;
- possuir playback mode concorrente;
- manter authority diferente da Engine.

---

## Background Autoplay

Preservar:

- Background Preview WebP;
- muted playback;
- janela de aproximadamente 8 segundos;
- quality cap de aproximadamente até 480p onde aplicável;
- visibility handling.

### Background → Foreground

Ao clicar no CTA:

- experience → foreground;
- playbackInitiator → user;
- startup visual → pending release / invalidated;
- quality cap → removido;
- currentTime → 0;
- volume → restaurado;
- muted → conforme volume;
- default playbackRate → aplicada;
- `play()`.

Tudo usando:

- mesmo video;
- mesmo source;
- mesma HLS instance;
- mesmo buffer.

Não recriar HLS.

### BG ON/OFF ao vivo no editor

Alterações live:

- OFF → ON;
- ON → OFF;

devem ser processadas pela Engine.

Não recriar HLS/source/manifest sem necessidade.

---

## First frame

Deve existir uma única authority de first frame: PlayerEngine.

React não instala segundo detector concorrente.

Engine:

- detecta first frame;
- atualiza state;
- notifica subscribers;
- coordena startup release quando necessário.

---

## Seek, Volume, Mute e Rate

Seek:

- timeline click;
- timeline drag;
- ArrowLeft;
- ArrowRight;

usa `engine.seek()`.

Volume usa `engine.setVolume()`.

Mute usa `engine.setMuted()`.

Playback rate usa `engine.setPlaybackRate()`.

Preservar a UX atual.

---

## Keyboard

Preservar:

- Space / K → Play/Pause;
- M → Mute;
- F → Fullscreen;
- ArrowLeft → -5s;
- ArrowRight → +5s.

Comandos de mídia passam pelo Engine.

Fullscreen continua responsabilidade da UI.

---

## Native HLS e HLS Light

Preservar:

- Native HLS em Safari/Apple/WebKit quando adequado;
- HLS.js não carregado no native path;
- HLS Light separado;
- startup ABR;
- bandwidth session memory;
- dynamic loading;
- Mux;
- Bunny.

---

## Cleanup da Engine

`engine.destroy()` deve limpar:

- video event listeners;
- visibility listener;
- first-frame callback;
- visual async work;
- pending image callbacks;
- HLS listeners;
- HLS instance;
- subscribers.

Preferir `AbortController` ou handlers removíveis.

Engine externa do embed não deve ser destruída pelo unmount do React Core.

Engine interna do editor pode ser destruída quando o vídeo realmente desmontar.

---

## Source change e generation guard

Novo source pode reiniciar o startup lifecycle.

Source anterior não pode reassumir o player por callback assíncrono atrasado.

Preservar/reforçar generation guard.

Depois de trocar source:

- callbacks de imagem antigos não podem inserir visual;
- callbacks HLS antigos não podem assumir mídia;
- first-frame antigo não pode alterar o novo source.

---

## Tracking e regras comerciais

Preservar tracking atual de foreground activation.

Não bloquear playback aguardando tracking.

PlayerEngine não deve conhecer:

- subscription;
- quota;
- account;
- billing;
- entitlement;
- ownership.

Essas regras permanecem fora da Engine.

---

## Fora do escopo

Não implementar nesta milestone:

- Persistent Resume;
- Access / Startup Pipeline evolution;
- Tracker / remote telemetry;
- Evandro Delivery;
- Edge Gateway;
- custom video CDN;
- HLS proxy;
- signed playback redesign.

---

## Testes manuais obrigatórios

### Cenário 1 — Play antecipado com provider thumbnail

Config:

- BG OFF;
- Thumbnail ON;
- source provider.

F5.

Clicar Play imediatamente, antes do vídeo parecer pronto.

Esperado:

- thumbnail pode permanecer durante warming;
- primeiro frame real chega;
- thumbnail desaparece;
- vídeo fica sozinho;
- Pause/Play posteriores nunca trazem startup thumbnail de volta.

### Cenário 2 — Play antecipado com custom startup

Repetir com:

- custom startup;
- showPlayButton ON.

Depois repetir com:

- custom startup;
- showPlayButton OFF.

Mesmo resultado.

### Cenário 3 — BG ON + Thumbnail OFF

Config:

- Thumbnail inicial OFF;
- Background Autoplay ON.

F5.

Desde o primeiro pixel, o usuário pode ver apenas:

- black surface;
- ou Background Preview válido.

Nunca:

- broken-image glyph;
- alt text;
- provider thumbnail;
- custom thumbnail;
- white flash.

Com cache frio:

black → preview válido → main video.

Com cache quente:

preview praticamente instantâneo → main video.

### Cenário 4 — Preview falha

Forçar falha do Background Preview.

Esperado:

black → main first frame → video.

Sem broken image e sem fallback para startup thumbnail.

### Cenário 5 — Late preview

Preview termina de carregar depois que o vídeo já venceu.

Esperado:

preview é ignorado e nunca aparece.

### Cenário 6 — Pause Thumbnail

Play.

Pause.

Custom Pause Thumbnail aparece quando configurada.

Resume.

Esperado:

pause thumbnail sai imediatamente e vídeo fica visível.

### Cenário 7 — Continue assistindo

Com Pause Thumbnail OFF:

Pause → Continue assistindo.

Resume → card desaparece.

### Cenário 8 — Background Autoplay

F5 com BG ON.

Preview → first frame → preview sai.

Clique CTA.

Nenhum startup preview permanece ou reaparece.

### Cenário 9 — Editor vs embed

Executar os principais testes em editor e embed.

Comportamento deve ser semanticamente equivalente.

### Cenário 10 — Source change

Trocar `video-id`/source.

Novo source pode iniciar novo startup lifecycle.

Startup visual do source anterior nunca pode reaparecer.

### Cenário 11 — Múltiplos players

Dois ou mais players na mesma página.

Cada player possui seu próprio:

- video;
- Engine;
- HLS;
- startup lifecycle.

Sem cross-talk.

---

## Inspeção estática obrigatória

Comprovar:

- 1 HTMLVideoElement por player;
- 1 PlayerEngine por player;
- <= 1 HLS principal por player;
- `evandro-player.tsx` sem lifecycle HLS próprio;
- React sem direct playback media mutations como owner;
- PlaybackController removido ou neutralizado;
- PlayerRuntime apenas observer;
- 1 authority de first frame;
- user foreground + first frame → startup release obrigatório;
- startup visual released → late asset não reaparece;
- preview só fica visualmente exposto quando carregado;
- `releaseStartupVisual()` idempotente;
- config visual não recria Engine/HLS;
- external Engine não é destruída pelo React Core.

---

## Checks técnicos

Executar:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm build:embed`
- `pnpm build`

Todos devem passar.

Não adicionar Playwright/Cypress como requisito da milestone.

---

## Bundle validation

Reportar tamanhos de:

- Tiny Loader;
- Player Engine;
- Player Core;
- HLS Light.

Confirmar:

- Tiny Loader <= 25 KB minified;
- Player Engine separado;
- Player Core separado;
- HLS Light separado;
- native path continua sem HLS.js quando aplicável.

---

## Falhou se

A milestone falhou se qualquer um destes ocorrer:

- Play antecipado deixa startup thumbnail presa;
- vídeo toca por baixo de startup thumbnail;
- Pause/Play posterior não remove startup visual;
- broken-image glyph aparece;
- preview é exposto visualmente antes de carregar;
- Thumbnail OFF impede Background Preview com BG ON;
- BG ON usa provider/custom thumbnail como fallback;
- late preview reaparece sobre vídeo;
- late custom/provider thumbnail reaparece sobre vídeo;
- Pause Thumbnail permanece enquanto isPlaying=true;
- Continue assistindo permanece enquanto isPlaying=true;
- first frame continua com múltiplos owners;
- React continua owner de HLS;
- PlaybackController continua segundo owner;
- editor e embed mantêm arquiteturas divergentes;
- Background → Foreground recria HLS;
- Background → Foreground perde buffer;
- startup visual some cedo demais e cria black flash desnecessário;
- Spec 050 showPlayButton sofre regressão;
- Background Preview sofre regressão;
- fade/crossfade sofre regressão;
- spinner sofre regressão;
- seek/volume/mute/rate/fullscreen sofrem regressão.

---

## Commit esperado

`spec(051): consolidate playback ownership in headless engine`

Push somente para `origin development`.

Não promover para `main`.

---

## Critério de aceite

A Spec 051 continua não aceita até existir:

- implementação concluída;
- typecheck/lint/build passando;
- inspeção estrutural;
- teste manual;
- confirmação explícita do usuário.

Somente depois disso avançar para a próxima milestone.