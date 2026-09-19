# 049 — Custom Startup & Pause Thumbnails + Media Fade Transitions

## Objetivo

Fechar a camada visual do Evandro Player antes da próxima grande refatoração da Headless Engine.

Esta milestone adiciona:

```text
1. Thumbnail inicial personalizada
2. Thumbnail de pausa personalizada
3. Upload e armazenamento otimizado dessas imagens no R2
4. Fade-in extremamente rápido quando o vídeo real fica visualmente pronto
5. Crossfades coerentes entre thumbnail / preview / vídeo
```

A Spec 048 está funcionalmente aprovada e deve permanecer estável.

Esta spec NÃO deve alterar a arquitetura de playback, HLS ownership, Early Media Engine ou comportamento funcional de reprodução além das novas superfícies visuais.

---

# 1. Estados visuais oficiais

Após esta spec o player possui três superfícies visuais distintas.

```text
STARTUP
→ preview animado
→ thumbnail inicial
→ first frame real

PLAYBACK
→ vídeo real

PAUSE
→ thumbnail de pausa
OU
→ overlay atual "Continue assistindo"
```

Cada superfície possui uma responsabilidade independente.

---

# 2. Thumbnail inicial

A thumbnail existente passa a ter duas fontes possíveis:

```text
Automática
→ poster atual fornecido pelo provider

Personalizada
→ imagem enviada pelo usuário
```

Config conceitual:

```ts
appearance: {
  thumbnail: {
    enabled: boolean;
    source: "provider" | "custom";
    customUrl: string | null;
    customKey: string | null;
    customAspectRatio: "16:9" | "9:16" | "1:1" | null;
  };
}
```

Default:

```ts
{
  enabled: true,
  source: "provider",
  customUrl: null,
  customKey: null,
  customAspectRatio: null
}
```

Configurações antigas devem continuar parseando normalmente.

Não criar migration SQL.

`video_player_settings.config` já é JSONB.

---

# 3. Resolução da thumbnail inicial

Quando:

```text
backgroundAutoplay = false
thumbnail.enabled = true
```

resolver:

```text
source = custom
+ customUrl existe
→ customUrl

senão
→ posterUrl do provider
```

Se a custom thumbnail falhar ao carregar:

```text
fallback
→ posterUrl do provider
```

porque neste caso a funcionalidade de thumbnail continua habilitada.

---

# 4. Thumbnail OFF continua absoluta

Quando:

```text
thumbnail.enabled = false
```

não mostrar:

```text
custom thumbnail
provider thumbnail
<video poster>
```

Independentemente de URLs existentes.

O resultado continua sendo:

```text
surface preta
↓
first frame real do vídeo
```

conforme definido pela Spec 048.

---

# 5. Background Autoplay continua independente

Quando:

```text
backgroundAutoplay = true
```

a thumbnail inicial NÃO participa.

Mesmo se existir:

```text
customUrl
posterUrl
thumbnail.enabled = true
```

o startup continua sendo:

```text
Preview WebP
        +
Main Video
        ↓
Main First Frame
```

Nunca:

```text
Thumbnail
→ Preview
→ Video
```

Preservar estritamente a política da Spec 048.

---

# 6. Thumbnail de pausa

Adicionar uma segunda configuração independente:

```ts
appearance: {
  pauseThumbnail: {
    enabled: boolean;
    customUrl: string | null;
    customKey: string | null;
    customAspectRatio: "16:9" | "9:16" | "1:1" | null;
  };
}
```

Default:

```ts
{
  enabled: false,
  customUrl: null,
  customKey: null,
  customAspectRatio: null
}
```

---

# 7. Comportamento atual de pause permanece default

Hoje, depois que o usuário já começou a assistir e pausa, existe:

```text
Continue assistindo
Clique para continuar
```

Esse continua sendo o comportamento padrão.

Portanto:

```text
pauseThumbnail.enabled = false
↓
overlay "Continue assistindo"
```

Nenhuma regressão para usuários/configurações existentes.

---

# 8. Pause Thumbnail habilitada

Quando:

```text
pauseThumbnail.enabled = true
+
customUrl existe
```

ao pausar:

```text
vídeo
↓
thumbnail personalizada de pausa
```

Ela substitui completamente o card:

```text
Continue assistindo
```

Não renderizar ambos.

---

# 9. Interação da Pause Thumbnail

Toda a thumbnail de pausa deve ser clicável.

Clique em qualquer área da imagem:

```text
resume playback
```

Os controles normais do player continuam disponíveis acima da thumbnail quando configurados para serem exibidos.

Não adicionar textos obrigatórios sobre a imagem.

Não adicionar:

```text
Continue assistindo
Clique para continuar
```

quando a custom pause thumbnail estiver ativa.

---

# 10. Fallback da Pause Thumbnail

Se:

```text
pauseThumbnail.enabled = true
```

mas:

```text
customUrl está ausente
OU
imagem falhou
```

usar:

```text
overlay "Continue assistindo"
```

Não deixar o player sem ação de resume.

---

# 11. Quando a Pause Thumbnail pode aparecer

Somente quando:

```text
foreground já foi iniciado
AND
video está paused
AND
video não terminou
AND
player não está em erro
AND
player não está em startup
```

Não mostrar Pause Thumbnail:

```text
antes do primeiro Play
durante Background Autoplay
durante loading inicial
durante buffering
no estado ended
em error
```

---

# 12. Pause Thumbnail não altera playback

A imagem é apenas uma camada visual.

Nunca:

```text
destroy HLS
detach source
seek
recreate video
```

ao pausar.

O vídeo permanece exatamente no mesmo frame/time por baixo.

Ao clicar:

```text
video.play()
```

continua imediatamente.

---

# 13. Preload da Pause Thumbnail

Não baixar a Pause Thumbnail no critical startup path.

Ela não deve competir inicialmente com:

```text
Preview WebP
manifest HLS
first fragment
Player Engine
```

Estratégia:

```text
página abre
→ NÃO preload pause thumbnail

foreground começa
→ preload/prefetch pause thumbnail

usuário eventualmente pausa
→ imagem já tende a estar no cache
```

Pode usar `Image()` ou mecanismo equivalente depois do início do foreground.

Não elevar para prioridade `high`.

---

# 14. Upload de thumbnails

Aceitar originalmente:

```text
JPEG
PNG
WebP
```

Não aceitar:

```text
GIF
SVG
AVIF nesta primeira versão
```

porque queremos um pipeline simples e previsível.

Tamanho máximo do arquivo ORIGINAL selecionado:

```text
10 MB
```

O arquivo original não deve ser enviado diretamente ao R2.

---

# 15. Processamento client-side

Antes do upload:

```text
arquivo selecionado
↓
decode local
↓
crop central para aspect ratio atual
↓
resize
↓
WebP
↓
compressão
↓
upload
```

Utilizar Canvas/browser APIs.

Não adicionar biblioteca pesada de processamento apenas para esta funcionalidade.

---

# 16. Output final

Todo asset customizado armazenado deve ser:

```text
image/webp
```

O objetivo do output é:

```text
boa qualidade visual
+
baixo peso
```

Quality inicial sugerida:

```text
~0.84
```

Se o output ultrapassar aproximadamente:

```text
500 KB
```

reduzir qualidade progressivamente.

Não enviar ao backend um asset final superior a:

```text
750 KB
```

Se necessário, reduzir qualidade ou dimensão de forma controlada.

---

# 17. Dimensões recomendadas

A interface DEVE mostrar explicitamente a resolução recomendada de acordo com o aspect ratio atual.

## 16:9

```text
Recomendado:
1280 × 720 px
```

## 9:16

```text
Recomendado:
720 × 1280 px
```

## 1:1

```text
Recomendado:
1080 × 1080 px
```

Essas recomendações valem igualmente para:

```text
Thumbnail inicial
Thumbnail de pausa
```

---

# 18. Informação visual no uploader

Exemplo de texto para `16:9`:

```text
Tamanho recomendado: 1280 × 720 px (16:9)
JPG, PNG ou WebP • até 10 MB
```

Para `9:16`:

```text
Tamanho recomendado: 720 × 1280 px (9:16)
```

Para `1:1`:

```text
Tamanho recomendado: 1080 × 1080 px (1:1)
```

Também informar:

```text
Imagens fora dessa proporção serão recortadas para preencher o player.
```

---

# 19. Processamento de aspect ratio

A imagem final armazenada deve sair exatamente no aspect ratio atual.

Portanto, se o usuário subir:

```text
imagem 4:3
```

para um player:

```text
16:9
```

fazer:

```text
center crop
→ 16:9
→ resize
→ WebP
```

Não distorcer a imagem.

---

# 20. Mudança posterior de aspect ratio

Ao fazer upload, persistir:

```text
customAspectRatio
```

Exemplo:

```text
thumbnail criada em 16:9
```

Depois o usuário muda o player para:

```text
9:16
```

Não apagar a thumbnail automaticamente.

Mas mostrar aviso no editor:

```text
Esta imagem foi preparada para 16:9.
Para melhor resultado em 9:16, envie uma nova imagem.
```

O player ainda pode exibi-la usando `cover`.

---

# 21. Fit das imagens

Custom thumbnails devem preencher toda a área do vídeo:

```css
width: 100%;
height: 100%;
object-fit: cover;
```

Como o asset já será processado para o aspect correto, normalmente não haverá crop adicional perceptível.

Provider thumbnail pode continuar obedecendo a política visual existente, mas preferencialmente deve utilizar o mesmo comportamento de preenchimento se não causar regressão.

---

# 22. R2

Usar a infraestrutura existente:

```text
src/lib/asset-storage/r2.ts
```

Não criar novo storage provider.

Chaves versionadas:

```text
player-thumbnails/
  <publicId>/
    startup/
      <uuid>.webp

player-thumbnails/
  <publicId>/
    pause/
      <uuid>.webp
```

Exemplo:

```text
player-thumbnails/abc123/startup/c6f....webp
```

---

# 23. Cache

Cada upload gera uma NOVA key.

Usar:

```text
Cache-Control:
public, max-age=31536000, immutable
```

Não substituir bytes mantendo a mesma URL.

Assim:

```text
nova imagem
→ nova URL
→ cache automaticamente atualizado
```

sem purge.

---

# 24. Substituição de asset

Fluxo seguro:

```text
upload novo asset
↓
R2 confirma
↓
salvar nova config
↓
config confirma
↓
deletar asset antigo
```

Nunca apagar primeiro a imagem atualmente publicada.

Se atualização da config falhar:

```text
deletar novo asset órfão quando possível
```

e preservar o antigo.

---

# 25. Remoção

Para startup thumbnail personalizada:

```text
Remover personalizada
↓
delete R2 asset
↓
customUrl = null
customKey = null
customAspectRatio = null
source = provider
```

A opção automática volta a funcionar.

Para Pause Thumbnail:

```text
Remover
↓
delete R2 asset
↓
customUrl = null
customKey = null
customAspectRatio = null
enabled = false
```

O overlay:

```text
Continue assistindo
```

volta a ser utilizado.

---

# 26. Upload pelo painel

Como o arquivo processado final terá no máximo aproximadamente 750 KB, usar uma Server Action autenticada é aceitável nesta milestone.

Não precisamos introduzir presigned upload/R2 direct upload agora.

Criar ações dedicadas em:

```text
src/app/actions/videos.ts
```

ou em módulo separado se isso deixar responsabilidades mais claras.

Preferência:

```text
uploadPlayerThumbnailAction
removePlayerThumbnailAction
```

Não misturar upload binário dentro de:

```text
updatePlayerConfigAction
```

---

# 27. Segurança do upload

Server-side validar novamente:

```text
autenticação
plano ativo
ownership do videoId
kind = startup | pause
contentType = image/webp
processed size <= limite
```

Não confiar apenas no browser.

Também validar assinatura básica WebP antes de armazenar, quando simples de fazer:

```text
RIFF
...
WEBP
```

Não aceitar uma extensão `.webp` como prova suficiente.

---

# 28. Configuração persistida

Atualizar:

```text
src/types/player-config.ts
src/lib/validations/videos.ts
src/lib/player-settings.ts
```

para suportar os novos campos.

Garantir deep merge independente de:

```text
appearance.thumbnail
appearance.pauseThumbnail
```

Não repetir o bug corrigido na Spec 048 em que um nested field não era aceito/persistido.

---

# 29. UI — Thumbnail inicial

Em:

```text
Aparência
```

evoluir o bloco atual:

```text
Exibir thumbnail
```

para uma seção própria.

Exemplo conceitual:

```text
Thumbnail inicial

[ON]

Imagem exibida antes do vídeo começar.

Fonte
(•) Automática
( ) Personalizada

[preview da imagem]

Tamanho recomendado: 1280 × 720 px (16:9)
JPG, PNG ou WebP • até 10 MB

[ Enviar imagem ]
```

Quando existir custom:

```text
[ Substituir ]
[ Usar automática ]
[ Remover personalizada ]
```

---

# 30. UI — Background Autoplay ON

Se Background Autoplay estiver ativo, não esconder a configuração de thumbnail porque o usuário pode querer configurá-la para quando desativar o autoplay posteriormente.

Mas mostrar aviso discreto:

```text
A thumbnail inicial não é exibida enquanto o Background Autoplay estiver ativo.
```

Não desabilitar upload.

---

# 31. UI — Thumbnail de pausa

Adicionar ainda em Aparência uma seção:

```text
Ao pausar
```

Com opções equivalentes a:

```text
(•) Mostrar "Continue assistindo"
( ) Mostrar thumbnail personalizada
```

Quando selecionar custom:

```text
[preview]

Tamanho recomendado: 1280 × 720 px (16:9)

[ Enviar imagem ]
```

Se não houver imagem válida:

```text
Continue assistindo
```

permanece como fallback.

---

# 32. Preview do editor

Todas as mudanças precisam ser visíveis imediatamente no preview interno.

Startup thumbnail:

```text
source provider/custom
enabled on/off
```

Pause thumbnail:

```text
pause
→ custom image
```

O usuário não precisa publicar embed externo para verificar a aparência.

---

# 33. Fade-in do vídeo

Adicionar uma transição visual extremamente rápida quando o vídeo real se tornar visível pela primeira vez.

Objetivo:

```text
sem vídeo
↓
frame aparece duro instantaneamente
```

virar:

```text
sem vídeo
↓
frame aparece suavemente em poucos ms
```

Sem parecer uma animação elaborada.

---

# 34. Duração do fade

Usar aproximadamente:

```text
140ms
```

com:

```css
opacity
ease-out
```

Faixa aceitável:

```text
120–160ms
```

Não ultrapassar:

```text
180ms
```

O efeito precisa ser percebido como polimento, não como atraso.

---

# 35. Fade não pode atrasar playback

O fade é exclusivamente visual.

Não:

```text
await animation
↓
video.play()
```

O vídeo continua tocando normalmente por baixo.

O fade altera apenas:

```text
opacity
```

da media layer.

---

# 36. Main Video inicial

Antes do primeiro frame confirmado:

```text
video opacity = 0
```

Quando o primeiro frame visualmente utilizável existir:

```text
video opacity
0 → 1
~140ms
```

Utilizar o boundary de first frame já existente na Spec 048.

Não criar outro conceito concorrente de readiness.

---

# 37. BG ON

Fluxo desejado:

```text
Preview WebP
        ↓
main first frame
        ↓
preview 1 → 0
video   0 → 1
        ~140ms
```

Crossfade sincronizado.

Não:

```text
preview desaparece
↓
preto
↓
video aparece
```

---

# 38. BG OFF + Thumbnail ON

A thumbnail NÃO deve desaparecer apenas porque o main conseguiu decodificar um frame em background.

Ela representa o estado:

```text
aguardando interação do usuário
```

Portanto:

```text
thumbnail
+
main preparado por baixo
```

até:

```text
usuário clica Play
```

Então:

```text
thumbnail 1 → 0
video     0 → 1
~140ms
```

Se o vídeo ainda não tiver frame pronto, manter a thumbnail até o primeiro frame ficar realmente disponível.

Isso evita flash preto.

---

# 39. BG OFF + Thumbnail OFF

Fluxo:

```text
surface preta
↓
first frame real
↓
video fade-in 140ms
```

O frame permanece parado esperando Play.

Nunca mostrar imagem externa.

---

# 40. Fade e pause/resume

O fade-in do vídeo NÃO deve ser executado novamente em:

```text
seek
buffering
quality switch
regular pause/resume sem pause thumbnail
volume change
rate change
```

Ele é uma transição de apresentação inicial.

---

# 41. Pause Thumbnail fade

Quando o usuário pausa e existe custom pause thumbnail:

```text
thumbnail opacity
0 → 1
~100–120ms
```

Muito rápido.

Ao clicar para continuar:

```text
thumbnail opacity
1 → 0
~100–120ms
```

O vídeo já está renderizado por baixo.

Não fazer fade-in novamente no vídeo.

---

# 42. Reduced Motion

Respeitar:

```css
@media (prefers-reduced-motion: reduce)
```

Nesse caso, remover ou praticamente eliminar os fades.

O player continua funcional.

---

# 43. Embed Early Engine

A nova resolução de thumbnail precisa existir também no caminho Early Engine.

Atualizar:

```text
src/components/player/engine/player-engine.ts
src/components/player/engine/types.ts
src/components/player/embed/loader-entry.ts
```

para entender:

```text
provider thumbnail
custom startup thumbnail
pause thumbnail
```

Não permitir divergência visual entre:

```text
editor
embed
```

---

# 44. Startup Engine resolution

No Engine, conceitualmente:

```ts
const startupThumbnail =
  config.appearance.thumbnail.source === "custom" &&
  config.appearance.thumbnail.customUrl
    ? config.appearance.thumbnail.customUrl
    : posterUrl;
```

Mas somente usar isso se:

```text
BG OFF
+
thumbnail.enabled
```

Background Autoplay continua usando apenas:

```text
backgroundPreviewUrl
```

---

# 45. Não preload asset errado

Startup:

```text
BG ON
→ preload preview
→ NÃO startup custom thumb

BG OFF + Thumb ON + Custom
→ preload custom thumb

BG OFF + Thumb ON + Provider
→ preload poster

BG OFF + Thumb OFF
→ nenhum visual asset
```

---

# 46. Pause asset não entra no Loader crítico

Mesmo que a config contenha:

```text
pauseThumbnail.customUrl
```

o Tiny Loader não deve adicionar:

```text
<link rel="preload" fetchpriority="high">
```

para ela no startup.

Preservar bandwidth para mídia principal.

---

# 47. Performance marks

Adicionar somente se útil:

```text
ep:visual:custom-thumbnail:start
ep:visual:custom-thumbnail:ready
ep:visual:pause-thumbnail:ready
ep:visual:main-reveal
```

Não adicionar telemetry remota.

---

# 48. Asset deletion no vídeo

Quando o vídeo for excluído, os assets personalizados também devem ser removidos do R2.

Hoje:

```text
deleteVideo()
```

já remove `backgroundPreviewKey`.

Evoluir para remover também:

```text
startup custom thumbnail key
pause thumbnail key
```

extraídos da configuração antes da exclusão.

Falha de delete no R2 não deve impedir exclusão do vídeo.

---

# 49. Não mexer em Delivery

Não implementar nesta milestone:

```text
Evandro Delivery
manifest versioning
ETag
custom CDN architecture
draft/save
Cloudflare Worker
```

Esse trabalho ficou explicitamente para depois de fecharmos toda a arquitetura de vídeo.

---

# 50. Não mexer na próxima Headless Engine

Não antecipar:

```text
Full Headless Playback Ownership
Resume Store
Telemetry
Access split
```

Preservar a Spec 048.

---

# Arquivos principais

Trabalhar principalmente em:

```text
src/types/player-config.ts

src/components/player/evandro-player.tsx

src/components/player/engine/player-engine.ts
src/components/player/engine/types.ts

src/components/player/embed/loader-entry.ts
src/components/player/embed/embed-player.tsx

src/components/videos/video-settings.tsx
src/components/videos/video-player-view.tsx

src/app/actions/videos.ts

src/lib/player-settings.ts
src/lib/validations/videos.ts
src/lib/videos.ts

src/lib/asset-storage/r2.ts
```

Criar preferencialmente um componente dedicado:

```text
src/components/videos/player-thumbnail-uploader.tsx
```

ou nome semanticamente equivalente.

Não transformar `video-settings.tsx` em um arquivo ainda maior com todo o processamento de imagem inline.

---

# O QUE MUDA TECNICAMENTE

Depois desta milestone:

```text
Provider thumbnail
        │
        ├── continua disponível
        │
Custom startup thumbnail
        │
        ├── WebP otimizado no R2
        │
Pause thumbnail
        │
        └── WebP otimizado no R2
```

PlayerConfig passa a saber:

```text
qual startup thumbnail usar
se deve usar pause thumbnail
URLs/keys dos assets
aspect em que foram preparados
```

E a media layer ganha um único reveal suave de aproximadamente 140ms.

---

# O QUE VOCÊ DEVE PERCEBER VISUALMENTE

## Startup com thumb

Ao atualizar:

```text
thumbnail
```

continua aparecendo instantaneamente.

Quando você clicar Play:

```text
thumbnail
→ vídeo
```

deve ficar ligeiramente mais suave.

Não deve parecer uma animação.

Apenas deixa de existir aquele corte visual duro.

---

## Startup sem thumb

Ao atualizar:

```text
preto
↓
primeiro frame real
```

O primeiro frame deve entrar com um fade extremamente rápido.

---

## Background Autoplay

```text
Preview WebP
↓
vídeo principal
```

A transição deve ficar mais natural e sem corte seco.

---

## Pause customizada

Quando você clicar Pause:

```text
vídeo
↓
sua imagem personalizada
```

O card:

```text
Continue assistindo
```

não aparece.

Ao clicar na imagem:

```text
vídeo continua
```

---

# O QUE NÃO DEVE MUDAR

Não deve mudar:

```text
playback
HLS
buffering
timeline
volume
velocidade
fullscreen
fake progress
Background Autoplay
Preview WebP
CTA "Seu vídeo já começou"
tracking
quota
layout
aspect ratio
```

A thumbnail inicial automática continua funcionando para quem não configurar nada.

---

# SEU TESTE MANUAL

## Cenário 1 — Automática

Configurar:

```text
BG OFF
Thumbnail ON
Fonte = Automática
```

F5.

Esperado:

```text
thumbnail atual do provider aparece
```

Play:

```text
crossfade rápido
→ vídeo
```

---

## Cenário 2 — Custom startup

Fazer upload de uma custom thumbnail.

Esperado no editor:

```text
preview mostra a nova imagem
```

F5.

Esperado:

```text
custom image
```

e não a automática.

Play:

```text
custom thumbnail
→ fade rápido
→ vídeo
```

---

## Cenário 3 — Thumb OFF

Desligar:

```text
Exibir thumbnail
```

F5.

Esperado:

```text
nenhuma custom
nenhuma provider thumbnail
nenhum preview
```

Então:

```text
primeiro frame real
```

aparece com fade curto.

---

## Cenário 4 — BG ON

Mesmo tendo custom thumbnail configurada:

```text
Background Autoplay ON
```

F5.

Esperado:

```text
Preview WebP
→ Main Video
```

A custom thumbnail NÃO aparece.

---

## Cenário 5 — Pause default

```text
Pause Thumbnail OFF
```

Play.

Pause.

Esperado:

```text
Continue assistindo
```

exatamente como hoje.

---

## Cenário 6 — Pause personalizada

Enviar Pause Thumbnail e ativá-la.

Play.

Pause.

Esperado:

```text
imagem personalizada
```

Sem:

```text
Continue assistindo
```

Clique na imagem.

Esperado:

```text
vídeo continua imediatamente
```

---

## Cenário 7 — Aspect 9:16

Mudar o player para:

```text
9:16
```

Uploader deve informar:

```text
720 × 1280 px
```

Upload.

Imagem deve ocupar corretamente todo o frame.

---

## Cenário 8 — Aspect 1:1

Uploader:

```text
1080 × 1080 px
```

---

## Cenário 9 — Troca de aspect

Upload de thumb em:

```text
16:9
```

Depois alterar para:

```text
9:16
```

Esperado:

```text
warning de proporção
```

Não apagar asset automaticamente.

---

# FALHOU SE

A milestone falhou se:

```text
custom startup thumb aparece durante Background Autoplay

thumbnail aparece com Thumbnail OFF

pause thumbnail aparece antes do primeiro Play

Continue assistindo aparece junto da Pause Thumbnail

clicar Pause Thumbnail não retoma playback

upload de uma nova imagem continua mostrando versão antiga por cache

imagem causa layout shift

imagem distorce

thumbnail custom pesa vários MB no runtime

fade atrasa play()

fade é executado em todo pause/resume

fade é lento ou chamativo

existe flash preto entre thumb/preview e vídeo

config custom desaparece após F5

asset antigo é apagado antes da nova config estar salva

player/HLS quebra
```

---

# Validação do agente

Executar:

```bash
pnpm typecheck
pnpm lint
pnpm build:embed
pnpm build
```

Não adicionar Playwright.

Não exigir browser do agente.

Além disso validar estaticamente:

```text
PlayerConfig aceita todos os novos campos
validation schema aceita os novos campos
deep merge preserva ambos os objetos
custom asset URL chega no bootstrap
BG ON ignora startup thumbnail
BG OFF Thumb OFF não carrega nenhuma thumbnail
pause thumbnail não é preload crítico
R2 keys são versionadas
assets antigos são limpos corretamente
```

Tiny Loader continua:

```text
<= 25 KB
```

Reportar os tamanhos dos bundles no walkthrough.

---

# Resultado final

A camada visual passa a ser:

```text
                    STARTUP

BG ON
Preview WebP ────────────────┐
                             │
                             ▼
                        Main Video
                         fade 140ms

BG OFF + THUMB ON
Provider / Custom Thumb ─────┐
                             │ Play
                             ▼
                        Main Video
                         fade 140ms

BG OFF + THUMB OFF
Black Surface ───────────────┐
                             │ first frame
                             ▼
                        Main Video
                         fade 140ms


                     FOREGROUND

                        Main Video
                             │
                           Pause
                             ▼
             ┌───────────────┴───────────────┐
             │                               │
 Pause Thumb OFF                     Pause Thumb ON
             │                               │
 Continue Assistindo                Custom Thumbnail
             │                               │
             └───────────────┬───────────────┘
                             │ click
                             ▼
                        Main Video
```

A próxima milestone só começa depois desta experiência estar manualmente aprovada.
