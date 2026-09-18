# 040 — Multi-Provider Video Infrastructure

## Objetivo

Preparar o WatchMap para operar simultaneamente com dois providers de vídeo:

- Mux
- Bunny Stream

Cada vídeo deve pertencer permanentemente ao provider no qual foi criado.

Nesta spec:

```text
provider padrão = Mux
```

Ainda NÃO criar seletor no painel `/dev`.

A próxima spec será responsável apenas por trocar o provider padrão usado para NOVOS uploads.

---

# 1. Regra central

O provider é escolhido uma única vez:

```text
novo upload
↓
getDefaultVideoProvider()
↓
provider = mux | bunny
↓
salvar no vídeo
```

Depois disso:

```text
video.provider
```

é a única fonte de verdade.

Alterar o provider padrão no futuro NÃO pode alterar vídeos existentes.

Exemplo futuro:

```text
vídeo A → mux
vídeo B → mux

admin muda default para bunny

vídeo A → continua mux
vídeo B → continua mux
vídeo C → bunny
vídeo D → bunny
```

---

# 2. Fora de escopo

NÃO implementar nesta spec:

- seletor de provider no `/dev`;
- migração de vídeo de Mux para Bunny;
- failover automático entre providers;
- replicação da mesma mídia em dois providers;
- fallback Mux → Bunny;
- signed playback;
- token authentication;
- mudanças nas regras de plano/quota;
- mudanças no player;
- mudanças em Analytics.

Queremos apenas permitir que Mux e Bunny coexistam corretamente.

---

# 3. Modelo de dados

Adicionar ao vídeo:

```ts
provider: "mux" | "bunny"

providerUploadId: string | null
providerVideoId: string | null
providerPlaybackId: string | null
providerThumbnailFileName: string | null
```

No banco:

```text
provider
provider_upload_id
provider_video_id
provider_playback_id
provider_thumbnail_file_name
```

`provider`:

```text
NOT NULL
DEFAULT 'mux'
```

Criar também:

```ts
export const videoProviderEnum = ["mux", "bunny"] as const
export type VideoProviderName =
  (typeof videoProviderEnum)[number]
```

Não é necessário criar PostgreSQL ENUM.

---

# 4. Compatibilidade com vídeos Mux atuais

NÃO remover:

```text
muxUploadId
muxAssetId
muxPlaybackId
```

Esses campos permanecem temporariamente.

Migration deve fazer backfill:

```text
provider = 'mux'

providerUploadId = muxUploadId
providerVideoId = muxAssetId
providerPlaybackId = muxPlaybackId
```

Todos os vídeos existentes continuam funcionando sem alteração de mídia.

Durante esta fase, novos vídeos Mux devem manter os campos genéricos e os campos legados Mux sincronizados.

---

# 5. Semântica dos IDs

## Mux

```text
provider = mux

providerUploadId
→ Mux Direct Upload ID

providerVideoId
→ Mux Asset ID

providerPlaybackId
→ Mux Playback ID
```

## Bunny

```text
provider = bunny

providerVideoId
→ Bunny Video GUID

providerPlaybackId
→ Bunny Video GUID

providerUploadId
→ pode permanecer null nesta implementação

providerThumbnailFileName
→ thumbnailFileName retornado pela Bunny
```

No Bunny o mesmo GUID é suficiente para construir o HLS.

---

# 6. Camada de providers

Criar uma camada pequena:

```text
src/lib/video-providers/
├── types.ts
├── registry.ts
├── default-provider.ts
├── mux-provider.ts
└── bunny-provider.ts
```

Não criar framework complexo.

A abstração existe somente porque agora temos dois providers reais.

---

# 7. Contrato mínimo do provider

Criar interface equivalente a:

```ts
interface VideoProviderAdapter {
  name: VideoProviderName

  createUploadSession(
    input: ProviderCreateUploadInput
  ): Promise<ProviderUploadSession>

  syncVideo(
    video: Video
  ): Promise<ProviderVideoState>

  getPlaybackUrl(
    video: Video
  ): string | null

  getPosterUrl(
    video: Video
  ): string | null

  getBackgroundPreviewUrl(
    video: Video
  ): string | null

  deleteVideo(
    video: Video
  ): Promise<void>
}
```

Não colocar nesta interface:

- plano;
- quota;
- autenticação de usuário;
- Analytics;
- folders;
- player config.

Provider trata apenas infraestrutura de mídia.

---

# 8. Registry

Criar:

```ts
getVideoProvider(providerName)
```

Exemplo:

```ts
mux → muxProvider
bunny → bunnyProvider
```

Provider desconhecido deve falhar explicitamente.

Não criar fallback automático.

---

# 9. Default provider

Criar:

```ts
getDefaultVideoProviderName()
```

Nesta spec:

```ts
return "mux"
```

Não ler diretamente `"mux"` em vários lugares.

A próxima spec vai alterar somente a implementação desta fonte de verdade para utilizar o valor escolhido no painel admin.

---

# 10. Upload genérico

`createVideoUploadSession()` não deve mais chamar diretamente:

```ts
createMuxDirectUpload()
```

Fluxo:

```text
reserve slot
↓
providerName = getDefaultVideoProviderName()
↓
salvar provider no vídeo
↓
getVideoProvider(providerName)
↓
provider.createUploadSession()
↓
persistir IDs retornados
↓
retornar instruções de upload ao client
```

O provider deve ser persistido ANTES de o restante do ciclo depender dele.

---

# 11. Contrato de upload

O retorno para o client deve ser discriminado pelo transporte.

Exemplo:

```ts
type ProviderUploadSession =
  | {
      provider: "mux"
      transport: "put"
      uploadUrl: string
    }
  | {
      provider: "bunny"
      transport: "tus"
      endpoint: string
      headers: {
        AuthorizationSignature: string
        AuthorizationExpire: string
        VideoId: string
        LibraryId: string
      }
    }
```

A UI não decide qual provider usar.

Ela apenas executa o transporte retornado pelo backend.

---

# 12. Upload Mux

Preservar exatamente a infraestrutura pública atual.

Mux continua:

```text
Direct Upload
→ PUT direto do browser
→ public Playback ID
```

Não reintroduzir signed playback.

`MuxProvider` deve encapsular:

- create direct upload;
- retrieve upload;
- retrieve asset;
- criar public Playback ID se necessário;
- HLS;
- poster;
- animated preview;
- delete.

Internamente pode reutilizar `src/lib/mux.ts`.

---

# 13. Upload Bunny

O fluxo deve ser:

```text
WatchMap backend
↓
POST Create Video na Bunny
↓
recebe Video GUID
↓
gera credenciais pre-signed TUS
↓
retorna dados TUS ao browser
↓
browser envia arquivo DIRETO para Bunny
```

Endpoint TUS:

```text
https://video.bunnycdn.com/tusupload
```

Usar upload resumível via:

```text
tus-js-client
```

Adicionar dependência somente se necessária:

```text
tus-js-client
```

---

# 14. Bunny API Key nunca vai ao browser

Server-side:

```text
BUNNY_STREAM_API_KEY
```

pode ser utilizado para:

- Create Video;
- Get Video;
- Delete Video;
- gerar assinatura do upload TUS.

Nunca retornar essa API Key ao client.

O browser recebe somente os dados pre-signed necessários ao upload.

---

# 15. Bunny TUS

Gerar assinatura server-side conforme protocolo atual da Bunny.

O client deve receber:

```text
AuthorizationSignature
AuthorizationExpire
VideoId
LibraryId
```

O upload deve usar:

```text
https://video.bunnycdn.com/tusupload
```

Configurar retry razoável no `tus-js-client`.

Utilizar:

```text
findPreviousUploads()
```

quando possível para permitir resume.

O upload deve continuar atualizando a barra de progresso existente.

---

# 16. UploadDialog

Preservar a UI atual.

Depois de `createUploadUrlAction()`:

```text
transport = put
→ usar fluxo XHR atual

transport = tus
→ usar tus-js-client
```

O usuário não deve perceber qual provider está sendo utilizado.

Não mostrar:

```text
Mux
Bunny
```

na interface pública.

Após sucesso:

```text
syncVideoStatusAction({ videoId })
```

continua sendo disparado.

---

# 17. Bunny client server-side

Criar helper dedicado, por exemplo:

```text
src/lib/bunny-stream.ts
```

Responsável por:

```text
createBunnyVideo()
getBunnyVideo()
deleteBunnyVideo()
createBunnyTusCredentials()
getBunnyHlsUrl()
getBunnyPosterUrl()
getBunnyPreviewUrl()
```

API base de gerenciamento:

```text
https://video.bunnycdn.com/library/{libraryId}/videos
```

Autenticação server-side:

```text
AccessKey
```

---

# 18. Bunny playback

Utilizar o Pull Zone/CDN hostname configurado.

HLS:

```text
https://{BUNNY_STREAM_CDN_HOSTNAME}/{videoGuid}/playlist.m3u8
```

Poster:

```text
https://{BUNNY_STREAM_CDN_HOSTNAME}/{videoGuid}/{thumbnailFileName}
```

Preview animado:

```text
https://{BUNNY_STREAM_CDN_HOSTNAME}/{videoGuid}/preview.webp
```

O WatchMap Player continua recebendo apenas uma URL HLS.

Ele não deve saber se veio de Mux ou Bunny.

---

# 19. Status normalizado

O restante do WatchMap continua usando somente:

```text
waiting_upload
uploading
processing
ready
errored
```

Cada adapter converte os estados próprios do provider para esses estados.

Mux:

```text
Mux status
→ WatchMap status
```

Bunny:

```text
Bunny VideoModelStatus
→ WatchMap status
```

Centralizar o mapping Bunny em um único arquivo.

Não espalhar códigos numéricos de status pela aplicação.

Confirmar os valores atuais do `VideoModelStatus` na documentação oficial da Bunny durante a implementação.

---

# 20. Sync provider-neutral

Refatorar:

```ts
syncVideoStatus(videoId)
```

para:

```text
buscar vídeo
↓
getVideoProvider(video.provider)
↓
provider.syncVideo(video)
↓
estado normalizado
↓
persistir
```

Não usar:

```text
if muxAssetId...
```

como decisão principal.

O provider salvo no vídeo decide a infraestrutura.

---

# 21. Limite de duração

A regra continua pertencendo ao WatchMap:

```text
maxVideoDurationSeconds = 1200
```

Provider retorna duração normalizada.

Core:

```text
duration > limite
↓
provider.deleteVideo(video)
↓
status = errored
↓
libera comportamento atual de slot
```

Mesma regra para Mux e Bunny.

Não duplicar regra de plano dentro dos adapters.

---

# 22. Playback provider-neutral

Criar helper de domínio equivalente a:

```ts
getVideoPlaybackUrl(video)
```

Internamente:

```text
video.provider
↓
adapter
↓
getPlaybackUrl(video)
```

Substituir dependências diretas como:

```ts
getHlsPlaybackUrl(video.muxPlaybackId)
```

em:

- embed bootstrap;
- preview interno;
- helpers de playback;
- qualquer outra resolução de mídia.

Não alterar a lógica da spec 038.

Somente tornar a resolução da mídia provider-neutral.

---

# 23. Poster provider-neutral

Criar:

```ts
getVideoPosterUrl(video)
```

Mux:

```text
image.mux.com
```

Bunny:

```text
BUNNY_STREAM_CDN_HOSTNAME
```

`VideoCard` não deve montar URL Mux diretamente.

Remover lógica como:

```ts
video.muxPlaybackId
  ? `https://image.mux.com/...`
```

do client.

---

# 24. Biblioteca

Resolver poster server-side para cada vídeo.

Passar algo equivalente a:

```ts
videoPosterUrls: Record<string, string | null>
```

para:

```text
VideosLibrary
→ VideoCard
```

`VideoCard` recebe apenas:

```text
posterUrl
```

e não conhece Mux ou Bunny.

---

# 25. Página de detalhes

`/videos/[videoId]` deve usar:

```text
getVideoPlaybackUrl(video)
getVideoPosterUrl(video)
getVideoBackgroundPreviewUrl(video)
```

Não:

```text
muxPlaybackId diretamente
```

O preview do WatchMap continua exatamente igual.

---

# 26. Embed

O bootstrap continua com as regras atuais:

```text
assinatura
→ limites
→ vídeo ready
→ playbackUrl
```

Depois da autorização:

```ts
playbackUrl = getVideoPlaybackUrl(video)
```

O response não precisa informar:

```text
provider
```

Player recebe:

```json
{
  "playback": {
    "type": "hls",
    "url": "..."
  }
}
```

Mux e Bunny são transparentes para o player.

---

# 27. Background Preview

Refatorar a geração atual, que hoje é Mux-specific.

Fluxo:

```text
video
↓
provider.getBackgroundPreviewUrl(video)
↓
fetch server-side
↓
R2
```

Mux:

```text
animated.webp / animated.gif
```

Bunny:

```text
preview.webp
```

R2 continua sendo o storage final preferencial para previews derivados.

---

# 28. R2

Não alterar a arquitetura R2.

Vídeos antigos continuam utilizando as keys existentes.

Para novos previews, utilizar key provider-neutral, por exemplo:

```text
background-previews/{publicId}/{provider}-{providerVideoId}.webp
```

Não migrar assets R2 antigos.

---

# 29. Falha no background preview

Falha ao gerar preview:

```text
NÃO pode impedir status ready
```

Preservar comportamento atual.

Fallback:

```text
provider preview
ou
poster
```

quando disponível.

---

# 30. Delete provider-neutral

Refatorar:

```ts
deleteVideo()
```

para:

```text
video.provider
↓
provider.deleteVideo(video)
↓
delete R2 preview
↓
delete DB record
```

Mux:

```text
delete Asset
```

Bunny:

```text
DELETE Bunny Video
```

Nunca tentar deletar Bunny como Mux ou vice-versa.

---

# 31. Provider imutável

Após criação:

```text
video.provider
```

não deve ser alterado por:

- default atual;
- sync;
- playback;
- delete;
- mudança futura no admin.

Somente uma migração explícita de mídia poderia alterar isso futuramente.

---

# 32. Variáveis de ambiente Bunny

Adicionar:

```env
BUNNY_STREAM_LIBRARY_ID=""
BUNNY_STREAM_API_KEY=""
BUNNY_STREAM_CDN_HOSTNAME=""
BUNNY_STREAM_TUS_TTL_SECONDS="21600"
```

Mux continua:

```env
MUX_TOKEN_ID=""
MUX_TOKEN_SECRET=""
```

Bunny credentials só devem ser validadas quando Bunny for efetivamente utilizado.

A aplicação não deve deixar de iniciar porque Bunny ainda não está configurado enquanto o default continuar Mux.

---

# 33. Configuração Bunny nesta versão

A Video Library usada deve estar configurada para playback HLS direto compatível com a arquitetura pública atual do WatchMap.

NÃO implementar nesta spec:

```text
Bunny Token Authentication
```

O modelo continua equivalente ao Mux public playback atual.

---

# 34. Erros e textos

Remover textos internos/public-facing que assumem Mux.

Exemplo atual:

```text
"Vídeo em processamento no Mux"
```

trocar por:

```text
"Vídeo em processamento"
```

Server logs podem incluir provider:

```text
[Bunny Sync]
[Mux Sync]
```

Mensagens ao usuário devem continuar neutras.

---

# 35. Server Actions

`createUploadUrlAction()` não deve retornar erro:

```text
"Falha ao gerar URL de upload no Mux."
```

Usar:

```text
"Falha ao preparar o upload do vídeo."
```

Mesmo princípio para sync/delete.

---

# 36. Não expor provider ao player

Não adicionar:

```ts
provider="mux"
provider="bunny"
```

ao `WatchMapPlayer`.

Player continua operando somente com:

```text
src HLS
posterUrl
backgroundPreviewUrl
```

Isso é importante para manter o player completamente desacoplado da infraestrutura.

---

# 37. Default continua Mux

Depois desta spec:

```ts
getDefaultVideoProviderName()
→ "mux"
```

Portanto o comportamento de produção continua exatamente como hoje.

A infraestrutura Bunny fica pronta, mas ainda não se torna default.

A próxima spec vai controlar exclusivamente essa função através do painel `/dev`.

---

# 38. Migration

Criar migration Drizzle para os campos novos.

Backfill deve ser seguro e idempotente.

Vídeos existentes:

```text
provider = mux
providerUploadId = muxUploadId
providerVideoId = muxAssetId
providerPlaybackId = muxPlaybackId
```

Não modificar IDs existentes da Mux.

Não chamar APIs externas durante migration de banco.

---

# 39. Testes Mux

Confirmar regressão zero:

```text
novo upload Mux
→ upload funciona
→ processamento funciona
→ ready
→ thumbnail
→ background preview
→ playback
→ delete
```

Vídeos Mux antigos também devem continuar funcionando.

---

# 40. Testes Bunny

Testar diretamente o Bunny adapter:

```text
Create Video
→ TUS credentials
→ upload direto
→ processamento
→ sync
→ duração
→ ready
→ HLS
→ thumbnail
→ preview
→ R2 background preview
→ playback no WatchMap Player
→ delete
```

Não é necessário expor seletor público/admin nesta spec para realizar esse teste.

---

# Critérios de aceite

- Existem exatamente dois providers suportados: Mux e Bunny.
- Todo vídeo possui `provider`.
- Vídeos antigos são `mux`.
- Provider é persistido no momento da criação.
- Alterar default futuramente não afeta vídeos existentes.
- Existe registry simples de providers.
- Default continua Mux.
- Mux continua funcionando sem regressão.
- Bunny possui integração real de upload.
- Bunny upload acontece diretamente browser → Bunny.
- Bunny API Key nunca chega ao browser.
- Bunny usa TUS resumível.
- UploadDialog suporta PUT e TUS.
- Status é normalizado pelo provider.
- Limite de 20 minutos funciona nos dois.
- Playback é provider-neutral.
- Poster é provider-neutral.
- Background preview é provider-neutral.
- R2 continua funcionando.
- VideoCard não conhece Mux nem Bunny.
- WatchMapPlayer não conhece Mux nem Bunny.
- Embed não conhece detalhes específicos do provider.
- Delete usa o provider armazenado no vídeo.
- Nenhum failover automático foi criado.
- Nenhuma seleção no `/dev` foi criada ainda.