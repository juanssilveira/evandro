# Spec 048 — Corrective Pass

A Spec 048 atual NÃO está aceita.

A implementação introduziu regressões críticas e deve ser corrigida antes de qualquer nova milestone.

Não criar Spec 049 ainda.

## Bugs confirmados

### 1. Editor perdeu referência do `<video>`

Em `src/components/player/evandro-player.tsx`, antes da 048 o elemento nativo usava diretamente:

```tsx
<video ref={videoRef} />
```

Após a mudança passou a utilizar:

```tsx
<video ref={internalVideoRef} />
```

enquanto praticamente toda a lógica continua consultando:

```ts
videoRef.current
```

No modo editor/standalone:

```text
mediaElement = undefined
videoRef.current = null
```

e nunca é atualizado com `internalVideoRef.current`.

Isso quebra:

```text
source attach
HLS
PlayerRuntime
PlaybackController
play()
duration
seek
volume
first-frame detection
```

Sintoma observado:

```text
00:00 / 00:00
play não funciona
CTA não funciona
```

### Correção

Estabelecer uma única referência canônica para a mídia.

Preferir um callback ref ou helper explícito:

```ts
const setInternalVideoElement = (node: HTMLVideoElement | null) => {
  internalVideoRef.current = node;

  if (!mediaElement) {
    videoRef.current = node;
  }
};
```

e:

```tsx
<video ref={setInternalVideoElement} />
```

ou implementação equivalente.

Invariável:

```text
standalone/editor
→ videoRef.current === vídeo React

embed
→ videoRef.current === vídeo persistente do Stage
```

Nunca pode ficar `null` depois do mount quando um `<video>` real existe.

---

# 2. `thumbnail.enabled` não é persistido

`src/types/player-config.ts` recebeu:

```ts
appearance.thumbnail.enabled
```

mas:

```text
src/lib/validations/videos.ts
```

não foi atualizado.

O schema `updatePlayerConfigActionSchema` atualmente não aceita:

```ts
appearance.thumbnail
```

Consequência:

```text
UI envia thumbnail.enabled=false
↓
Zod remove/rejeita campo desconhecido do objeto parseado
↓
updatePlayerConfig recebe patch sem thumbnail
↓
servidor retorna config antiga
↓
UI volta para enabled=true
```

Isso explica a thumbnail continuar aparecendo.

### Correção

Adicionar:

```ts
thumbnail: z
  .object({
    enabled: z.boolean().optional(),
  })
  .optional()
```

em:

```text
updatePlayerConfigActionSchema.config.appearance
```

---

# 3. Deep merge de thumbnail

Também atualizar:

```text
src/lib/player-settings.ts
```

para fazer merge explícito:

```ts
appearance: {
  ...current.appearance,
  ...(patch.appearance || {}),
  thumbnail: {
    ...current.appearance.thumbnail,
    ...(patch.appearance?.thumbnail || {}),
  },
},
```

Isso evita perda de futuros campos de thumbnail.

---

# 4. Race entre Core e Engine no embed

Atualmente:

```text
enginePromise
corePromise
bootstrapPromise
```

começam paralelamente.

Porém `mountCore()` pode executar antes de:

```ts
this._engine = ...
```

Nesse caso é criado:

```ts
const mountContext = {
  mediaElement: this._videoElement,
  engine: this._engine, // null
}
```

React recebe:

```text
mediaElement válido
engine undefined
```

e esse valor fica congelado no contexto usado pelo mount.

Depois a Engine pode nascer e executar:

```text
loadSource()
new Hls()
```

enquanto React, por não saber da Engine, também pode executar seu lifecycle próprio sobre o mesmo `<video>`.

Isso viola a invariável fundamental da Spec 048.

---

# 5. Engine deve existir antes do Core adotar a mídia

Não fazer o Core montar com `engine=null`.

A ordem correta é:

```text
Stage criado sincronamente
↓
video criado sincronamente
↓
engine module começa a carregar
core module começa a carregar
bootstrap começa
↓
engine module pronto
↓
ENGINE INSTANCE é criada imediatamente
↓
Core pode receber engine estável
```

A criação da Engine não deve depender do bootstrap.

Ela pode nascer inicialmente sem source.

Conceitualmente:

```ts
const engineReadyPromise = loadPlayerEngineModule().then((module) => {
  if (!this._engine) {
    this._engine = module.create({
      videoElement: this._videoElement!,
      stageElement: this._stageElement,
      startupVisualElement: this._startupVisualElement,
    });
  }

  return this._engine;
});
```

Depois existem dois fluxos paralelos:

```text
bootstrap + engineReady
→ engine.loadSource()
```

e:

```text
coreReady + engineReady
→ mount React
```

Assim:

```text
React nunca recebe null engine no embed
```

sem obrigar o Core a esperar o bootstrap.

---

# 6. Não permitir fallback React-HLS no embed

Quando existe Stage persistente:

```text
Engine deve ser obrigatória
```

Não utilizar silenciosamente:

```text
mediaElement externo
+
engine null
+
React assume source
```

Esse fallback esconde race conditions.

No embed:

```text
persistent media element
=> persistent Engine
```

Se a Engine falhar ao carregar, mostrar erro técnico controlado ou manter startup surface; não iniciar outro owner de HLS silenciosamente.

---

# 7. Um único owner da source

Após correção, comprovar:

```text
EMBED

PlayerEngine
→ video.src / HLS lifecycle
```

React NÃO pode executar:

```text
attachMediaSource()
new Hls()
```

nesse caminho.

No editor temporariamente:

```text
EvandroPlayer React
→ source/HLS
```

continua permitido.

Portanto:

```text
embed → Engine owner
editor → React owner
```

até a próxima milestone consolidar tudo.

---

# 8. Corrigir comportamento do foreground

No embed, quando:

```text
backgroundAutoplay = true
```

clicar:

```text
"Seu vídeo já começou"
```

deve obrigatoriamente executar na Engine real:

```text
experience = foreground
quality cap removido
currentTime = 0
volume restaurado
muted = false quando volume > 0
play()
```

Não utilizar uma Engine prop stale ou `undefined`.

---

# 9. Play normal

Em:

```text
BG OFF
```

clicar no grande botão Play deve funcionar tanto:

```text
editor
embed
```

e a duração deve estar disponível normalmente.

---

# 10. Thumbnail OFF

Depois de persistir:

```text
appearance.thumbnail.enabled = false
```

recarregar a página deve continuar retornando:

```text
false
```

Não basta funcionar otimisticamente antes do request terminar.

Testar conceitualmente:

```text
OFF
↓
server save
↓
reload
↓
continua OFF
```

---

# 11. Startup visual

Preservar a regra da 048:

### BG ON

```text
preview permitido
thumbnail proibida
```

### BG OFF + Thumb ON

```text
thumbnail permitida
preview proibido
```

### BG OFF + Thumb OFF

```text
thumbnail proibida
preview proibido
first frame do main
```

Não voltar ao fallback:

```ts
preview || poster
```

---

# 12. Não reintroduzir `<video poster>`

Continuar sem:

```tsx
poster={posterUrl}
```

Thumbnail permanece uma camada explicitamente controlada.

---

# 13. Não alterar preview WebP novamente

Manter, por enquanto:

```text
Mux preview:
até 6s
480px
8fps
```

O problema atual não é o asset do preview.

Não mexer nesses parâmetros durante este corrective pass.

---

# 14. Não mexer em Delivery

Não implementar ainda:

```text
Cloudflare Worker
R2 player delivery
config manifests
ETags
draft/save architecture
```

Primeiro recuperar a estabilidade do player.

---

# 15. Não ampliar refactor

Não aproveitar o hotfix para migrar:

```text
PlaybackController
PlayerRuntime
telemetry
resume
access
```

Escopo estrito:

```text
restaurar playback
restaurar persistência de thumbnail
eliminar race Engine/Core
garantir ownership único
```

---

# Validação técnica do agente

Executar:

```bash
pnpm typecheck
pnpm lint
pnpm build:embed
pnpm build
```

Além disso, inspeção estática obrigatória.

## Editor

Comprovar que:

```text
videoRef.current
```

é preenchido pelo `<video>` interno.

## Embed

Comprovar que:

```text
Core nunca monta com engine=null
```

e que existe apenas:

```text
1 HTMLVideoElement
1 PlayerEngine
1 Hls instance principal
```

para um player.

---

# O que você deve perceber

## Caso 1 — cenário da screenshot

Abra o mesmo vídeo no editor.

Esperado imediatamente após correção:

```text
duração deixa de ser 00:00
```

Deve aparecer algo como:

```text
00:00 / 16:xx
```

de acordo com a duração real.

Clique no botão grande de Play:

```text
vídeo toca
```

Clique no botão inferior:

```text
play/pause funciona
```

---

## Caso 2 — Background Autoplay

Ative Background Autoplay.

Esperado:

```text
preview/main aparece
CTA "Seu vídeo já começou"
```

Clique no CTA.

Esperado:

```text
vai para 0
ativa foreground
áudio é restaurado
vídeo toca
```

Um único clique.

---

## Caso 3 — Thumbnail OFF

Desative:

```text
Exibir thumbnail
```

Espere salvar.

Recarregue a página inteira.

Esperado:

```text
switch continua OFF
thumbnail NÃO aparece
```

Com BG OFF:

```text
primeiro frame real do vídeo
```

deve ser a superfície visual quando estiver disponível.

---

## Caso 4 — Thumbnail ON

Ative novamente.

Recarregue.

Esperado:

```text
thumbnail aparece
```

Comportamento persistente.

---

# Falhou se

```text
00:00 / 00:00 continua

Play não responde

CTA "Seu vídeo já começou" não responde

thumbnail OFF volta para ON após reload

thumbnail aparece com OFF

Core pode montar antes de Engine existir

React e Engine podem anexar HLS simultaneamente

duas Hls instances aparecem para um embed

vídeo do editor continua sem videoRef

Background Autoplay piora

layout sofre shift
```

---

# Commit

Não criar Spec 049.

A Spec 048 continua sendo a milestone corrente.

Criar um commit corretivo separado:

```text
fix(048): stabilize media ownership and thumbnail persistence
```

Push somente para:

```text
origin development
```
