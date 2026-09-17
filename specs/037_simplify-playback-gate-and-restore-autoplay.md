# 037 — Simplify Playback Gate and Restore Autoplay

## Objetivo

Remover completamente a implementação de Mux Signed Playback/JWT introduzida na spec 036 e restaurar o fluxo simples e estável do player.

O objetivo desta spec NÃO é criar segurança criptográfica da mídia.

O objetivo é:

> O WatchMap só entrega o stream do vídeo quando o proprietário daquele vídeo possui uma assinatura ativa.

Depois dessa autorização, o browser pode consumir o HLS diretamente da Mux.

Arquitetura final:

```text
Browser
   ↓
GET /api/embed/videos/{publicId}
   ↓
WatchMap Backend
   ↓
resolve vídeo → account → owner
   ↓
assinatura ativa?
   ├── NÃO → 403
   └── SIM
         ↓
      retorna config + poster + playbackUrl público
         ↓
Browser
   ↓
Mux CDN
```

Não fazer:

```text
Browser
→ WatchMap
→ proxy dos bytes do vídeo
→ Mux
```

O WatchMap é a barreira para obtenção da URL.

A Mux continua sendo responsável pela entrega dos bytes.

---

# 1. Princípio arquitetural

A regra de acesso é simples:

```text
publicId
↓
video.id + accountId
↓
owner da account
↓
assinatura ativa?
```

Se NÃO:

```text
403
```

e nenhuma URL de playback é retornada.

Se SIM:

```text
carregar vídeo
↓
validar disponibilidade
↓
retornar playbackUrl público
```

Essa é a barreira principal desta versão.

---

# 2. Manter `resolvePlaybackEntitlement`

A função atual:

```ts
resolvePlaybackEntitlement(publicId)
```

deve ser preservada.

Ela já representa corretamente a barreira desejada.

Fluxo:

```text
publicId
→ video.id + accountId
→ owner
→ getActivePlanForUser(owner)
```

Assinatura válida continua sendo:

```text
status = active

AND

expiresAt IS NULL
OR
expiresAt > now
```

Não remover essa verificação.

Não simplificar de volta para um fluxo em que a mídia seja resolvida antes da assinatura.

---

# 3. Bootstrap é a barreira principal

Endpoint:

```text
GET /api/embed/videos/[publicId]
```

deve obrigatoriamente começar por:

```ts
resolvePlaybackEntitlement(publicId)
```

Sem autorização:

```text
403
```

Resposta genérica:

```text
Este vídeo está temporariamente indisponível.
```

Não retornar:

- playbackUrl;
- muxPlaybackId;
- poster;
- preview;
- config;
- dados da conta.

---

# 4. Bootstrap autorizado

Se o owner possui assinatura ativa:

1. carregar o vídeo completo;
2. sincronizar status se necessário;
3. confirmar `status = ready`;
4. confirmar existência de `muxPlaybackId`;
5. montar URL HLS pública;
6. retornar dados completos do player.

Resposta conceitual:

```json
{
  "videoId": "public-id",
  "title": "Vídeo",
  "duration": 123,
  "playbackUrl": "https://stream.mux.com/PLAYBACK_ID.m3u8",
  "playback": {
    "type": "hls",
    "url": "https://stream.mux.com/PLAYBACK_ID.m3u8"
  },
  "posterUrl": "...",
  "backgroundPreviewUrl": "...",
  "config": {}
}
```

A URL só aparece depois da verificação de assinatura.

---

# 5. Não usar signed playback

Remover integralmente do runtime da aplicação:

```text
Mux Signed Playback
JWT playback
JWT thumbnail
JWT animated image
signed playback policy
```

Não manter uma segunda estratégia de signed como fallback.

Não tentar suportar simultaneamente:

```text
public + signed
```

A implementação final desta spec utiliza:

```text
Mux public playback
```

---

# 6. Variáveis de ambiente

Remover dependência de:

```text
MUX_SIGNING_KEY_ID
MUX_SIGNING_PRIVATE_KEY
MUX_PLAYBACK_TOKEN_TTL_SECONDS
```

Remover essas variáveis de:

```text
.env.example
```

O runtime deve precisar somente de:

```text
MUX_TOKEN_ID
MUX_TOKEN_SECRET
```

para operações administrativas da API Mux.

As signing keys podem permanecer temporariamente configuradas externamente sem efeito, mas nenhum código da aplicação deve depender delas.

---

# 7. Simplificar `src/lib/mux.ts`

Remover configuração de:

```text
jwtSigningKey
jwtPrivateKey
TTL de playback
```

O client Mux deve voltar a ser criado apenas com:

```ts
new Mux({
  tokenId,
  tokenSecret,
})
```

---

# 8. Remover helpers signed

Remover helpers equivalentes a:

```ts
getMuxSignedPlaybackUrl()
getMuxSignedThumbnailUrl()
getMuxSignedAnimatedUrl()
```

Remover também tipos/opções criados exclusivamente para assinatura JWT.

---

# 9. Restaurar HLS público

Criar/restaurar helper simples:

```ts
export function getHlsPlaybackUrl(playbackId: string): string {
  return `https://stream.mux.com/${playbackId}.m3u8`
}
```

Sem:

```text
?token=
JWT
exp
aud
```

---

# 10. Novos uploads Mux

Em:

```ts
createMuxDirectUpload()
```

alterar:

```text
playback_policy: ["signed"]
```

para:

```text
playback_policy: ["public"]
```

Todos os novos vídeos devem receber Playback ID público.

---

# 11. Sync do Asset

Em:

```ts
syncVideoStatus()
```

não procurar mais:

```text
policy === "signed"
```

Procurar:

```text
policy === "public"
```

Se o Asset estiver `ready` e não possuir Playback ID público:

```text
criar Playback ID public
```

Persistir esse ID em:

```text
videos.muxPlaybackId
```

Não criar signed Playback ID.

---

# 12. Playback ID no banco

`muxPlaybackId` deve voltar a representar:

```text
Mux PUBLIC Playback ID
```

Nenhuma migration estrutural de banco é necessária.

Não adicionar novos campos de provider nesta spec.

Não implementar abstração multi-provider nesta spec.

---

# 13. Restaurar vídeos existentes

Os vídeos que foram convertidos para signed pela spec 036 precisam ser revertidos para public.

Criar script:

```text
scripts/restore-public-mux-playback.mjs
```

Adicionar comando:

```text
pnpm mux:restore-public-playback
```

Suportar:

```text
--dry-run
```

---

# 14. Migração signed → public

Para cada vídeo com:

```text
mux_asset_id IS NOT NULL
```

executar:

1. consultar Asset Mux;
2. verificar Playback IDs existentes;
3. procurar `policy = public`;
4. se não existir, criar Playback ID público;
5. confirmar que o public ID existe;
6. atualizar `videos.mux_playback_id`;
7. confirmar persistência;
8. remover Playback IDs `signed`;
9. confirmar que o Asset possui pelo menos um public ID;
10. confirmar que o banco aponta para esse public ID.

---

# 15. Ordem segura da migração

NUNCA remover o signed Playback ID antes de:

```text
public ID criado
+
DB atualizado
```

Ordem:

```text
create public
↓
persist public no DB
↓
confirm
↓
delete signed
```

---

# 16. Idempotência da migração

Rodar o script mais de uma vez deve ser seguro.

Se o Asset já possuir:

```text
1 public ID
0 signed IDs
```

e o banco já apontar para o public ID:

```text
nenhuma alteração necessária
```

---

# 17. Remover script antigo de segurança

Depois que a migração reversa existir, remover:

```text
scripts/secure-mux-playback.mjs
```

Remover do `package.json`:

```text
mux:secure-playback
```

Não deixar um comando que possa converter acidentalmente tudo novamente para signed.

---

# 18. Background Preview

Restaurar o fluxo simples de imagens públicas da Mux.

`getMuxPosterUrl()` deve voltar a montar URL pública diretamente.

Exemplo:

```ts
export function getMuxPosterUrl(playbackId: string): string {
  return `https://image.mux.com/${playbackId}/thumbnail.webp?width=640`
}
```

Não precisa ser `async`.

---

# 19. Animated Preview

Restaurar URL pública para animated preview.

Exemplo conceitual:

```text
https://image.mux.com/{playbackId}/animated.webp
?start=0
&end=10
&width=640
&fps=12
```

Sem JWT.

Sem token.

---

# 20. Geração do Background Preview em R2

`generateAndStoreBackgroundPreview()` continua existindo.

Mas deve voltar a buscar:

```text
image.mux.com
```

através de URL pública.

Fluxo:

```text
Mux animated WebP
↓
fallback GIF se necessário
↓
baixar no servidor
↓
armazenar no R2
```

R2 continua exatamente como antes.

Não remover R2.

---

# 21. Fallback de Background Preview

Se não existir preview derivado no R2:

```text
backgroundPreviewUrl =
Mux public animated preview
```

Esse fallback deve continuar funcionando.

Nenhum signing token deve ser necessário.

---

# 22. Restaurar Background Autoplay real

Este é um requisito crítico.

Quando:

```text
config.playback.backgroundAutoplay = true
```

o vídeo real deve voltar a:

- carregar automaticamente;
- iniciar muted;
- iniciar loop;
- reproduzir em background;
- mostrar overlay de ativação de som;
- ao clique, voltar para 0;
- sair do loop;
- ativar áudio;
- iniciar foreground playback.

Não substituir Background Autoplay por:

```text
imagem estática
animated preview
poster
```

Esses assets podem continuar servindo como camada visual/fallback, mas o comportamento real de Background Autoplay deve continuar utilizando o vídeo HLS.

---

# 23. Por que o autoplay quebrou

A implementação signed removeu o `playbackUrl` do bootstrap.

Com isso:

```text
Embed carrega
↓
WatchMapPlayer não possui src
↓
HLS não é anexado
↓
PlaybackController não consegue executar background autoplay
```

A correção é restaurar o `src` autorizado no bootstrap.

Não criar outra arquitetura para contornar isso.

---

# 24. `EmbedVideoData`

Restaurar:

```ts
playbackUrl?: string | null
```

em:

```text
EmbedVideoData
```

---

# 25. `EmbedPlayer`

Ao receber bootstrap autorizado:

ler:

```text
json.playback?.url
||
json.playbackUrl
```

e armazenar em:

```text
data.playbackUrl
```

Depois passar:

```tsx
<WatchMapPlayer
  src={data.playbackUrl || undefined}
  ...
/>
```

---

# 26. WatchMapPlayer

Simplificar o player.

O `src` deve voltar a representar diretamente a mídia que já foi autorizada pelo bootstrap.

Fluxo:

```text
src recebido
↓
attachMediaSource(src)
↓
manifest ready
↓
PlaybackController.resolveInitialPlayback()
```

Isso deve restaurar o comportamento original.

---

# 27. Remover autorização para obter src

Remover do player a necessidade de:

```text
authorizePlaybackOnce()
```

para obter a URL HLS.

Remover:

```text
pendingAuthPromiseRef
activatedSrc como fonte obrigatória
```

e outros estados introduzidos exclusivamente para esperar uma signed URL.

A URL já vem do bootstrap.

---

# 28. `resolvedSrc`

Pode voltar ao modelo simples:

```ts
const resolvedSrc = src || ""
```

ou equivalente.

Não fazer o player depender de uma URL retornada posteriormente por `/activate`.

---

# 29. Media Attachment

Quando `src` existir:

```text
isMediaAttached = true
```

e:

```text
attachMediaSource(src)
```

deve acontecer normalmente.

Isso vale tanto para:

```text
foreground normal
```

quanto:

```text
background autoplay
```

---

# 30. Não atrasar HLS por causa de quota

Não fazer:

```text
click
→ backend
→ esperar URL
→ anexar HLS
→ esperar manifest
→ tocar
```

O HLS já deve estar carregado quando o player for autorizado pelo bootstrap.

Essa latência foi uma das causas da regressão do fluxo.

---

# 31. `/activate` continua existindo

NÃO remover:

```text
POST /api/embed/videos/[publicId]/activate
```

Ele continua responsável por:

- confirmar entitlement;
- validar editor;
- registrar Play;
- controlar quota;
- manter idempotência por playSessionId.

Mas ele NÃO é mais responsável por fornecer a única URL HLS existente.

---

# 32. `/activate` também valida plano

Mesmo que o bootstrap já tenha validado:

```text
/activate
```

deve validar novamente a assinatura.

Motivo:

a assinatura pode ser removida entre:

```text
page load
```

e:

```text
primeiro Play
```

Não remover essa segunda defesa.

---

# 33. `/activate` pode retornar playbackUrl público

Para manter compatibilidade, o endpoint pode continuar retornando:

```json
{
  "authorized": true,
  "playback": {
    "type": "hls",
    "url": "https://stream.mux.com/..."
  },
  "playbackUrl": "https://stream.mux.com/..."
}
```

Mas essa URL é pública e simples.

Não gerar token.

O player não precisa depender dela para attach inicial.

---

# 34. `validateAndActivatePlayback`

Preservar a ordem:

```text
resolvePlaybackEntitlement
↓
vídeo ready
↓
editor/quota
↓
Play
```

Remover apenas:

```ts
getMuxSignedPlaybackUrl()
```

Substituir por:

```ts
getHlsPlaybackUrl()
```

---

# 35. Registro de Play

Preservar:

```text
monthly_usage
play_sessions
```

Preservar:

```text
videoId + playSessionId
```

como idempotência.

Não redefinir Play nesta spec.

---

# 36. Foreground Activation

Ao entrar em foreground pela primeira vez, continuar disparando `/activate`.

Mas `/activate` NÃO deve controlar:

```text
attach inicial do HLS
background autoplay
carregamento do manifest
```

O player já possui a mídia.

---

# 37. Não quebrar interação

A transição:

```text
background autoplay muted
↓
usuário clica
↓
currentTime = 0
↓
loop false
↓
volume restaurado
↓
foreground
```

deve permanecer fluida.

Não desmontar/recriar HLS durante essa transição.

Não trocar `src`.

Não criar novo Hls instance desnecessariamente.

---

# 38. Quota e simplicidade

Manter a lógica atual de quota no `/activate`.

Não criar:

- JWT;
- revogação de token;
- signed URL;
- proxy;
- nova camada de provider;
- sessão criptográfica.

Aceitar que a barreira desta versão é o WatchMap.

Não tentar resolver nesta spec reutilização manual de uma URL pública copiada da Mux.

---

# 39. Limitação aceita desta arquitetura

Esta spec adota conscientemente:

```text
application-level access control
```

e NÃO:

```text
cryptographic CDN-level access control
```

Depois que um usuário autorizado recebe:

```text
https://stream.mux.com/{publicPlaybackId}.m3u8
```

essa URL é pública na infraestrutura Mux.

Essa limitação é aceita nesta fase em troca de:

- simplicidade;
- estabilidade;
- Background Autoplay funcional;
- menor acoplamento;
- menor complexidade operacional.

NÃO reintroduzir signed playback nesta spec para tentar resolver essa limitação.

---

# 40. Preview interno do editor

Restaurar o fluxo simples do editor.

Em:

```text
/videos/[videoId]
```

depois do acesso autenticado e do plano já validado pelo app:

```text
muxPlaybackId
↓
getHlsPlaybackUrl()
↓
playbackUrl
↓
VideoPlayerView
↓
WatchMapPlayer src
```

O preview deve funcionar imediatamente.

---

# 41. `VideoPlayerView`

Restaurar prop:

```ts
playbackUrl: string
```

Passar:

```tsx
<WatchMapPlayer
  src={playbackUrl}
  ...
/>
```

Não obrigar o preview interno a buscar uma URL signed através de `/activate` para iniciar o player.

---

# 42. Página de detalhes

Em:

```text
src/app/(app)/videos/[videoId]/page.tsx
```

restaurar:

```ts
const playbackUrl = currentVideo.muxPlaybackId
  ? getHlsPlaybackUrl(currentVideo.muxPlaybackId)
  : ""
```

Passar novamente para:

```text
VideoDetailsView
→ VideoPlayerView
```

---

# 43. Poster da Biblioteca

Remover signed thumbnails.

Não executar uma assinatura JWT por vídeo na renderização da Biblioteca.

Pode voltar ao modelo simples:

```ts
const posterUrl =
  video.status === "ready" && video.muxPlaybackId
    ? `https://image.mux.com/${video.muxPlaybackId}/thumbnail.webp?...`
    : null
```

---

# 44. `videoThumbnailsMap`

Se:

```text
videoThumbnailsMap
```

foi introduzido exclusivamente para gerar signed thumbnails server-side, remover essa complexidade.

Preferir restaurar o comportamento simples dentro de:

```text
VideoCard
```

utilizando `video.muxPlaybackId`.

Remover plumbing desnecessário de:

```text
VideosPage
FolderPage
VideosLibrary
VideoCard
```

se ele existir somente por causa de signed thumbnails.

---

# 45. Folder Page

Remover:

```text
getMuxSignedThumbnailUrl
```

da página de pasta.

Não fazer:

```text
Promise.all(sign thumbnail...)
```

para renderizar a biblioteca.

---

# 46. Library Page

Remover:

```text
getMuxSignedThumbnailUrl
```

da Biblioteca.

Não fazer uma chamada de signing por vídeo.

Isso deve voltar a ser uma renderização simples e barata.

---

# 47. Dev Panel

NÃO reverter a correção do modal de plano.

Preservar:

```text
default planMode = none
```

Preservar o reset ao abrir modal.

Preservar:

```text
sem plano → none
pro permanente → pro_permanent
pro temporário → pro_temporary
```

Preservar:

```text
router.refresh()
```

se atualmente necessário.

Essa correção está correta e é independente do signed playback.

---

# 48. Remover testes signed

Remover testes que existem exclusivamente para:

```text
JWT
signed thumbnail
signed playback
signing key
```

Por exemplo, remover/adaptar:

```text
scripts/test-secure-playback.ts
scripts/test-secure-playback.mjs
```

se forem exclusivamente da spec 036 signed.

---

# 49. Criar teste simples de access gate

Criar teste focado no comportamento que realmente queremos.

Nome sugerido:

```text
scripts/test-playback-access-gate.ts
```

Validar:

```text
sem plano + vídeo ready
→ entitlement 403

sem plano + vídeo processing
→ entitlement 403

plano expirado
→ entitlement 403

plano ativo + vídeo ready
→ autorizado

editor sem plano
→ bloqueado

editor com plano
→ autorizado / isento conforme regra atual
```

---

# 50. Testar URL pública

Com plano ativo:

```text
validateAndActivatePlayback()
```

deve retornar:

```text
https://stream.mux.com/{playbackId}.m3u8
```

Sem:

```text
?token=
```

---

# 51. Testar bootstrap

Plano ativo:

```text
GET embed
→ 200
→ contém playbackUrl
```

Sem plano:

```text
GET embed
→ 403
→ NÃO contém playbackUrl
```

Esse é o teste principal desta spec.

---

# 52. Testar remoção de plano

Cenário obrigatório:

1. criar usuário com plano;
2. criar vídeo;
3. embed funciona;
4. bootstrap retorna playbackUrl;
5. remover plano;
6. recarregar embed;
7. bootstrap retorna 403;
8. playbackUrl não é retornado.

---

# 53. Testar Background Autoplay

Cenário obrigatório.

Config:

```text
backgroundAutoplay = true
```

Plano ativo.

Ao abrir embed:

```text
bootstrap retorna playbackUrl
↓
HLS é anexado
↓
manifest carrega
↓
vídeo começa muted
↓
vídeo loop
```

Ao clicar:

```text
volta para 0
↓
desativa loop
↓
restaura volume
↓
foreground playback
```

Esse teste deve ser realizado no bundle real do embed.

---

# 54. Testar player normal

Config:

```text
backgroundAutoplay = false
```

Ao abrir:

```text
HLS pode carregar/preload
↓
vídeo permanece parado
```

Ao clicar:

```text
play normal
```

Não introduzir regressão no fluxo padrão.

---

# 55. Testar R2 preview

Confirmar:

- preview R2 existente continua funcionando;
- geração de novos previews funciona;
- fallback público Mux funciona;
- nenhuma signing key é necessária.

---

# 56. Testar Biblioteca

Confirmar:

- thumbnails aparecem;
- folders aparecem;
- thumbnails não expiram;
- não existem requests para gerar JWT;
- renderização não depende de Signing Key.

---

# 57. Testar editor

Confirmar:

```text
/videos/[videoId]
```

renderiza player imediatamente.

Background Autoplay também deve funcionar no editor.

Config changes continuam refletindo no preview.

---

# 58. Auditoria de signed playback

Buscar globalmente:

```text
MUX_SIGNING_KEY_ID
MUX_SIGNING_PRIVATE_KEY
MUX_PLAYBACK_TOKEN_TTL_SECONDS
getMuxSignedPlaybackUrl
getMuxSignedThumbnailUrl
getMuxSignedAnimatedUrl
jwt.signPlaybackId
jwtSigningKey
jwtPrivateKey
policy: "signed"
policy === "signed"
?token=
```

Ao final da implementação, nenhuma ocorrência runtime deve permanecer.

Exceção:

- documentação/spec histórica antiga, se mantida como registro.

Código executável não deve depender de signed playback.

---

# 59. Auditoria do player

Buscar por:

```text
authorizePlaybackOnce
pendingAuthPromiseRef
activatedSrc
```

Remover estados introduzidos exclusivamente para atrasar obtenção da mídia.

Não remover outros usos que tenham função independente comprovada.

---

# 60. Não implementar provider abstraction

Nesta spec, NÃO implementar:

```text
VideoProvider
provider registry
providerVideoId
providerPlaybackId
providerUploadId
MuxVideoProvider
BunnyVideoProvider
```

Isso está fora de escopo.

Continuar utilizando a infraestrutura Mux atual diretamente.

Bunny será tratado separadamente quando realmente for implementado.

---

# 61. Não alterar schema desnecessariamente

Nenhuma alteração estrutural no banco é necessária para esta simplificação.

Não criar migration apenas por causa desta spec.

Manter:

```text
muxUploadId
muxAssetId
muxPlaybackId
```

---

# 62. Não alterar Analytics

Não iniciar Analytics nesta spec.

Não alterar:

```text
play_sessions
monthly_usage
```

além do necessário para manter o comportamento atual.

Analytics continua sendo etapa posterior.

---

# 63. CORS

Preservar funcionamento do embed cross-origin.

Bootstrap:

```text
GET
OPTIONS
```

Activation:

```text
POST
OPTIONS
```

Continuar com headers necessários para embeds externos.

---

# 64. Cache

Bootstrap continua:

```text
private
no-cache
no-store
must-revalidate
```

A remoção de um plano deve ser percebida em um novo carregamento imediatamente.

Não colocar resposta de entitlement em cache público.

---

# 65. Build do embed

Após alterações:

```text
pnpm build:embed
```

Regenerar:

```text
public/embed/v1/watchmap-player.js
```

O teste não está completo se apenas o player React interno funcionar.

---

# 66. Ordem de rollout

A implementação deve considerar que os Assets atuais podem estar signed.

Ordem recomendada:

```text
1. implementar código compatível com public playback
2. criar restore-public-mux-playback
3. rodar --dry-run
4. rodar migração real no ambiente de desenvolvimento
5. confirmar public Playback IDs no Mux
6. confirmar DB apontando para public IDs
7. testar player
8. remover código signed
9. rebuild embed
```

Evitar deixar o banco apontando para signed Playback ID depois que o código de JWT foi removido.

---

# 67. Produção futura

Quando essa alteração for promovida para produção:

rodar também:

```text
pnpm mux:restore-public-playback
```

utilizando:

```text
DATABASE_URL de produção
MUX_TOKEN_ID de produção
MUX_TOKEN_SECRET de produção
```

antes de considerar o rollout concluído.

Não reutilizar dados de Development.

---

# 68. Resultado arquitetural final

O sistema deve terminar simples:

```text
GET EMBED

publicId
↓
resolvePlaybackEntitlement()
↓
sem plano → 403
↓
com plano
↓
getVideoByPublicId()
↓
ready?
↓
getHlsPlaybackUrl()
↓
retorna playbackUrl
```

Player:

```text
recebe playbackUrl
↓
attach HLS
↓
Background Autoplay funciona
```

Primeiro foreground Play:

```text
/activate
↓
entitlement
↓
quota
↓
registra Play
```

Mux:

```text
serve HLS público diretamente ao browser
```

Sem:

```text
JWT
Signing Key
token expiration
signed thumbnails
signed animated previews
delayed HLS attachment
```

---

# Critérios de aceite

- `resolvePlaybackEntitlement()` continua existindo e funcionando.
- Sem plano, bootstrap retorna 403.
- Sem plano, bootstrap nunca retorna HLS.
- Com plano, bootstrap retorna HLS público.
- HLS não possui JWT.
- Novos uploads usam `playback_policy: ["public"]`.
- Assets existentes podem ser restaurados para public.
- `muxPlaybackId` aponta para Playback ID público.
- Signed Playback IDs antigos são removíveis de forma segura.
- Signing envs não são mais necessárias.
- Helpers signed foram removidos.
- Signed thumbnail foi removido.
- Signed animated preview foi removido.
- Background preview via R2 continua funcionando.
- Fallback Mux público continua funcionando.
- Biblioteca exibe thumbnails normalmente.
- Página de pasta exibe thumbnails normalmente.
- Preview interno funciona.
- Embed funciona.
- Background Autoplay real voltou a funcionar.
- Background Autoplay inicia muted + loop.
- Clique no Background Autoplay volta para 0 e ativa foreground.
- Player normal continua funcionando.
- `/activate` continua validando plano.
- `/activate` continua registrando Plays/quota.
- `playSessionId` continua idempotente.
- Correção do modal `/dev` não foi revertida.
- Nenhuma abstração nova de provider foi criada.
- Nenhuma migration estrutural desnecessária foi criada.
- Bundle público foi regenerado.