# Spec 021 — Mux Video Infrastructure

## Objetivo

Substituir completamente a infraestrutura atual de vídeo baseada em Cloudflare R2 + MP4 progressivo por Mux Video.

O WatchMap passa a utilizar Mux para:

- ingest/upload;
- armazenamento de vídeo;
- processamento;
- encoding;
- adaptive streaming;
- entrega da mídia.

O WatchMap continua responsável por:

- interface de upload;
- banco de dados;
- ownership;
- Player;
- Runtime;
- configurações;
- analytics;
- embed;
- Evandro.

Arquitetura final:

```text
Usuário
   ↓
WatchMap App
   ↓
Direct Upload URL
   ↓
Mux Video
   ↓
processamento
   ↓
Asset
   ↓
Playback ID
   ↓
HLS
   ↓
WatchMap Player
   ↓
HTMLVideoElement
   ↓
Player Runtime
   ↓
Evandro
```

Cloudflare R2 deixa completamente de fazer parte da infraestrutura de vídeo.

---

## 1. Princípio arquitetural

Mux é infraestrutura de mídia.

Mux NÃO substitui o WatchMap Player.

Não utilizar:

- Mux Player;
- iframe do Mux;
- componentes visuais do Mux para playback.

O fluxo deve continuar:

```text
Mux HLS
↓
WatchMap Player
↓
HTMLVideoElement
↓
Player Runtime
```

Preservar o princípio:

```text
Runtime = verdade física do player
Evandro = verdade analítica do comportamento
```

---

## 2. Dependências

Adicionar:

```text
@mux/mux-node
hls.js
```

`@mux/mux-node` deve ser utilizado exclusivamente no servidor.

`hls.js` deve ser utilizado pelo WatchMap Player para reprodução HLS em navegadores que não possuem suporte HLS nativo adequado.

Remover dependências utilizadas exclusivamente pelo R2/AWS S3 caso não sejam utilizadas por nenhuma outra funcionalidade.

Exemplo esperado:

```text
@aws-sdk/client-s3
@aws-sdk/s3-request-presigner
```

Só remover após confirmar que não possuem outro uso no projeto.

---

## 3. Variáveis de ambiente

Adicionar ao `.env.example`:

```env
MUX_TOKEN_ID=
MUX_TOKEN_SECRET=
```

Essas variáveis são server-side.

Nunca utilizar:

```text
NEXT_PUBLIC_MUX_TOKEN_ID
NEXT_PUBLIC_MUX_TOKEN_SECRET
```

Nunca expor credenciais do Mux para:

- navegador;
- embed;
- CDN;
- WatchMap Player;
- API pública.

Remover variáveis exclusivas do Cloudflare R2, após confirmar que não existe outro uso.

Exemplos:

```text
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
R2_ENDPOINT
```

Manter:

```text
BASE_URL
CDN_URL
```

porque continuam pertencendo à arquitetura do WatchMap.

---

## 4. Cliente Mux

Criar uma camada server-side centralizada.

Exemplo conceitual:

```text
src/lib/mux.ts
```

Responsabilidade:

```text
criar cliente Mux
validar envs necessárias
expor funções server-side relacionadas à mídia
```

Não instanciar cliente Mux espalhado por componentes ou rotas.

O cliente deve utilizar:

```text
MUX_TOKEN_ID
MUX_TOKEN_SECRET
```

---

## 5. Novo modelo de vídeo

O banco do WatchMap continua sendo a fonte de verdade sobre:

- qual usuário possui o vídeo;
- título;
- publicId;
- configurações do player;
- timestamps;
- estado lógico do vídeo.

Mux é a fonte de verdade sobre a mídia.

Adicionar ao modelo de vídeo os campos necessários para representar Mux.

Conceitualmente:

```text
muxUploadId
muxAssetId
muxPlaybackId
muxStatus
duration
```

Estados mínimos:

```text
waiting_upload
uploading
processing
ready
errored
```

Pode adaptar os nomes ao padrão existente do projeto.

Não criar uma arquitetura excessivamente genérica.

O WatchMap neste momento utiliza Mux.

---

## 6. Remover modelo R2

Remover do fluxo principal conceitos como:

```text
storageKey
R2 object key
presigned GET
presigned PUT
bucket
S3 object
playback URL do R2
```

Nenhuma reprodução nova deve depender de R2.

Nenhum upload novo deve depender de R2.

Não implementar migração automática dos arquivos antigos do R2 para Mux nesta spec.

Vídeos antigos sem `muxPlaybackId` podem ser tratados como legado durante desenvolvimento.

Não executar reset destrutivo automático do banco.

Se dados antigos impedirem a migration, informe ao final qual limpeza manual é necessária.

---

## 7. Criação do upload

O arquivo NÃO deve passar pelo servidor Next.js.

Fluxo:

```text
browser
↓
WatchMap backend
↓
cria Direct Upload no Mux
↓
retorna signed upload URL
↓
browser
↓
Mux
```

O backend deve:

1. autenticar usuário;
2. validar arquivo/metadados;
3. criar registro do vídeo;
4. criar Direct Upload no Mux;
5. salvar `muxUploadId`;
6. retornar URL temporária ao navegador.

Configuração inicial do asset:

```text
playback_policies:
- public

video_quality:
basic
```

Utilizar também:

```text
passthrough
```

com o ID interno do vídeo WatchMap sempre que adequado.

Isso permite relacionar o Asset Mux ao registro interno.

---

## 8. CORS do Direct Upload

Não utilizar `*` desnecessariamente.

O `cors_origin` deve ser derivado do ambiente atual do WatchMap.

Development:

```text
http://localhost:3000
```

Production:

```text
https://app.evandro.watch
```

Utilizar preferencialmente:

```text
BASE_URL
```

para derivar a origin autorizada.

Não hardcodar Stage.

Não existe ambiente Stage.

---

## 9. Upload no browser

Preservar a interface de upload existente do WatchMap.

Não substituir nossa UI pelo Mux Uploader.

O browser deve enviar o arquivo diretamente para a URL do Direct Upload.

Preservar:

- progresso percentual;
- estado visual;
- erro;
- cancelamento quando já existir;
- validação de arquivo.

Se o fluxo atual utiliza XHR para acompanhar upload progress, adaptar o mesmo padrão ao Direct Upload do Mux.

Não enviar o binário para:

```text
/api/...
Server Action
Vercel Function
```

O binário deve seguir:

```text
browser → Mux
```

---

## 10. Fluxo de estados

Fluxo esperado:

```text
waiting_upload
↓
uploading
↓
processing
↓
ready
```

Ou:

```text
waiting_upload
↓
uploading
↓
errored
```

Ou:

```text
processing
↓
errored
```

A interface deve comunicar claramente:

```text
Enviando vídeo...
Processando vídeo...
Pronto
Erro no processamento
```

Não marcar vídeo como `ready` apenas porque o upload terminou.

Upload concluído != Asset pronto para playback.

---

## 11. Sincronização sem webhook

Nesta primeira implementação NÃO configurar webhooks do Mux.

Utilizar polling controlado através do backend WatchMap.

Nunca consultar Mux diretamente do browser utilizando credenciais.

Criar uma operação server-side para sincronizar o estado do vídeo.

Fluxo:

```text
WatchMap video
↓
muxUploadId
↓
Mux Direct Upload status
```

Enquanto:

```text
status = waiting
```

continuar como upload/processamento conforme contexto.

Quando o Direct Upload retornar:

```text
status = asset_created
```

obter:

```text
asset_id
```

Salvar:

```text
muxAssetId
```

Depois consultar o Asset.

---

## 12. Sincronização do Asset

Quando `muxAssetId` existir:

```text
Mux Asset
↓
status
```

Se:

```text
preparing
```

WatchMap:

```text
processing
```

Se:

```text
ready
```

salvar:

```text
muxPlaybackId
duration
muxStatus = ready
```

Selecionar o Playback ID público correspondente.

Se:

```text
errored
```

WatchMap:

```text
errored
```

Persistir apenas informações de erro úteis e seguras.

Não persistir respostas enormes da API Mux sem necessidade.

---

## 13. Polling

Enquanto um vídeo estiver:

```text
processing
```

a UI pode consultar periodicamente o backend.

Utilizar intervalo razoável.

Exemplo:

```text
2–5 segundos
```

Não utilizar polling em 60fps.

Não criar timers globais permanentes.

Parar polling quando:

```text
ready
errored
componente desmontado
```

Ao abrir novamente a biblioteca ou página de um vídeo ainda em processamento, o WatchMap deve conseguir sincronizar novamente o estado com Mux.

Não depender apenas do estado em memória da tela de upload.

---

## 14. Playback URL

Quando o vídeo estiver `ready`, construir a reprodução através do `muxPlaybackId`.

Conceitualmente:

```text
https://stream.mux.com/{PLAYBACK_ID}.m3u8
```

Centralizar a construção da URL.

Não persistir URLs temporárias desnecessariamente.

Persistir o ID:

```text
muxPlaybackId
```

e derivar a URL HLS quando necessário.

---

## 15. Embed API

A API pública de embed não deve mais gerar presigned URL do R2.

Ela deve retornar a fonte de playback Mux.

Preferir contrato explícito:

```json
{
  "playback": {
    "type": "hls",
    "url": "https://stream.mux.com/PLAYBACK_ID.m3u8"
  }
}
```

Preservar os demais dados já utilizados pelo embed:

```text
videoId
title
config
```

Não retornar:

```text
muxAssetId
muxUploadId
MUX_TOKEN_ID
MUX_TOKEN_SECRET
```

O Playback ID público pode ser utilizado para construir a URL HLS.

---

## 16. WatchMap Player + HLS

Adaptar o WatchMap Player para HLS.

Não substituir o Player.

Fluxo:

```text
playback.type = hls
↓
WatchMap Player
↓
HTMLVideoElement
```

Estratégia:

### Navegadores com HLS nativo

Quando o elemento `<video>` suportar:

```text
application/vnd.apple.mpegurl
```

utilizar HLS nativo.

### Outros navegadores compatíveis

Utilizar:

```text
hls.js
```

Conectar o manifest ao mesmo:

```text
HTMLVideoElement
```

já utilizado pelo WatchMap Player.

Destruir corretamente a instância `Hls`:

- ao trocar vídeo;
- ao desmontar Player.

Evitar memory leaks.

---

## 17. Runtime

O Player Runtime NÃO deve conhecer Mux.

O Runtime continua observando o:

```text
HTMLVideoElement
```

Eventos continuam vindo do elemento real:

```text
play
pause
playing
waiting
seeking
seeked
timeupdate
ended
durationchange
volumechange
ratechange
```

Não enviar ao Runtime:

```text
Mux Asset ID
Mux Playback ID
segmentos HLS
bitrate interno
```

nesta spec.

Mux é responsabilidade da camada de mídia.

Runtime continua sendo independente.

---

## 18. Playback Controller

Não alterar regras existentes de:

- autoplay;
- background autoplay;
- foreground playback;
- restart;
- mute;
- volume;
- seek;
- fullscreen.

O Playback Controller deve continuar controlando o mesmo `HTMLVideoElement`.

HLS deve ser transparente para essa camada.

---

## 19. Fake Progress Bar

Não alterar o Fake Progress Engine.

Ele continua recebendo:

```text
currentTime
duration
```

do vídeo real.

HLS não altera essa responsabilidade.

Fake Progress nunca deve receber valor de progresso baseado em segmentos, buffer ou Mux.

---

## 20. Buffer

O progresso de buffer real pode continuar utilizando:

```text
video.buffered
```

quando disponível.

Não implementar métricas avançadas de HLS nesta spec.

Não adicionar UI de qualidade manual nesta spec.

Adaptive bitrate fica a cargo do pipeline HLS/Mux.

---

## 21. Player Preview

A preview interna e o embed externo devem utilizar exatamente a mesma infraestrutura de playback.

Não permitir:

```text
preview = MP4
embed = HLS
```

Ambos devem utilizar Mux/HLS.

Isso garante que o comportamento testado no painel seja o comportamento entregue ao visitante.

---

## 22. Exclusão de vídeo

Ao excluir um vídeo WatchMap:

```text
WatchMap
↓
Mux Asset
↓
Database
```

Se `muxAssetId` existir:

tentar excluir o Asset no Mux.

A operação deve ser tratada de forma segura e idempotente.

Não deixar erro de "Asset já não existe" bloquear permanentemente a exclusão local quando for possível determinar que a mídia já foi removida.

Preservar regras existentes de ownership.

---

## 23. Upload abandonado

Um Direct Upload pode existir sem gerar Asset caso o usuário abandone o envio.

Isso não deve quebrar o sistema.

Registros em:

```text
waiting_upload
```

podem continuar existindo temporariamente.

Não criar rotina de limpeza automática nesta spec.

Podemos implementar garbage collection posteriormente.

---

## 24. Cloudflare R2

Após o fluxo Mux estar funcional, remover completamente a infraestrutura R2 do código.

Remover:

- cliente R2;
- helpers S3/R2;
- geração de presigned PUT;
- geração de presigned GET;
- lógica de object key;
- chamadas de deleteObject;
- imports R2;
- variáveis R2;
- dependências AWS utilizadas apenas pelo R2;
- documentação operacional do R2.

Se existir:

```text
src/lib/r2.ts
```

e não houver mais nenhuma responsabilidade válida, remover.

Não deixar código morto "para caso precise depois".

Git mantém histórico.

---

## 25. Cloudflare fora da arquitetura de vídeo

Após esta spec, a arquitetura oficial de vídeo NÃO inclui Cloudflare.

Não documentar:

```text
R2
Cloudflare video storage
R2 playback
R2 upload
```

como alternativas atuais.

Se Cloudflare ainda for utilizado por algum serviço completamente diferente e comprovadamente ativo, não remover esse uso.

A remoção desta spec é especificamente da infraestrutura de vídeo antiga.

---

## 26. CDN do WatchMap Player

NÃO confundir Cloudflare R2 com o CDN do bundle do player.

Preservar:

```text
cdn.evandro.watch
```

Ele continua sendo o domínio público planejado para:

```text
/embed/v1/watchmap-player.js
```

Esse CDN pertence à distribuição do JavaScript do WatchMap Player.

Mux entrega:

```text
mídia
HLS
segmentos de vídeo
```

O WatchMap CDN entrega:

```text
JavaScript do Player
```

São responsabilidades diferentes.

---

## 27. Domínio da aplicação

Preservar a arquitetura:

```text
app.evandro.watch
```

para aplicação/API em produção.

Não fazer deploy nesta spec.

Não configurar Vercel nesta spec.

Não configurar DNS nesta spec.

---

## 28. Development e Production

Continuar utilizando somente:

```text
Development
Production
```

Não introduzir:

```text
Stage
Staging
Preview environment oficial
```

Development:

```text
localhost
Mux Development environment
```

Production:

```text
app.evandro.watch
Mux Production environment
```

As credenciais Mux de Production serão configuradas posteriormente durante o novo deploy.

Não reutilizar token Development em Production.

---

## 29. Segurança

Obrigatório:

- rotas que geram Direct Upload exigem autenticação;
- ownership deve ser validado;
- Token ID/Secret nunca chegam ao client;
- upload URL é temporária;
- usuário não escolhe arbitrary `passthrough`;
- usuário não consegue consultar vídeos de outra conta;
- exclusão valida ownership;
- API pública do embed só expõe dados necessários ao playback.

Nesta primeira versão, Playback ID pode ser:

```text
public
```

Signed playback fica fora do escopo.

---

## 30. Não implementar agora

Não implementar:

- Mux Player;
- Mux Data;
- webhooks;
- signed playback;
- DRM;
- subtitles;
- thumbnails automáticas adicionais;
- manual quality selector;
- download MP4;
- static renditions;
- live streaming;
- AI;
- analytics do Mux;
- bitrate analytics;
- resolução selecionada pelo usuário;
- migration automática R2 → Mux.

Esses itens ficam para specs futuras quando necessários.

---

## 31. Documentação

Atualizar documentação relevante para refletir:

```text
Mux = infraestrutura de vídeo
WatchMap = produto/player/runtime/analytics
```

Remover documentação antiga do R2 como infraestrutura ativa de mídia.

Não criar documentação repetitiva.

A documentação deve deixar claro:

```text
Upload
browser → Mux

Playback
Mux HLS → WatchMap Player

Player bundle
cdn.evandro.watch

App/API
app.evandro.watch
```

---

## 32. Migration do banco

Criar migration Drizzle adequada.

Não editar migration antiga já aplicada como forma de alterar schema.

Gerar uma nova migration.

Antes de remover coluna antiga do R2, confirmar dependências no código.

A migration deve permitir que o novo fluxo Mux funcione sem depender de dados antigos.

Não executar operações destrutivas inesperadas automaticamente.

Se vídeos antigos ficarem incompatíveis após a migration, documentar claramente.

---

## 33. Critérios de aceite — Upload

- usuário autenticado consegue selecionar um vídeo;
- WatchMap cria Direct Upload;
- arquivo vai browser → Mux;
- arquivo não passa pelo servidor WatchMap;
- progresso de upload continua visível;
- `muxUploadId` é persistido;
- upload concluído entra em `processing`;
- WatchMap identifica `muxAssetId`;
- WatchMap identifica quando Asset fica `ready`;
- `muxPlaybackId` é persistido;
- duração é atualizada;
- erro do Mux é refletido na UI.

---

## 34. Critérios de aceite — Playback

- vídeo `ready` reproduz via HLS;
- Chrome/Chromium funciona;
- Firefox funciona;
- Safari utiliza HLS nativo quando apropriado;
- player preview funciona;
- embed funciona;
- play/pause funciona;
- seek funciona;
- volume funciona;
- fullscreen funciona;
- playback rate funciona;
- autoplay continua funcionando;
- background autoplay continua funcionando;
- Fake Progress continua funcionando;
- Runtime continua recebendo eventos reais.

---

## 35. Critérios de aceite — Remoção R2

Não deve existir dependência funcional de:

```text
R2
S3
presigned URL
storageKey
bucket de vídeo
```

para upload ou playback.

Busca global deve ser feita por:

```text
R2
r2
S3
s3
AWS
storageKey
presign
presigned
```

Cada ocorrência remanescente deve ser avaliada.

Código morto relacionado à infraestrutura antiga deve ser removido.

---

## 36. Validação

Executar:

```text
pnpm typecheck
pnpm lint
pnpm build
pnpm build:embed
```

Também realizar teste funcional local:

```text
1. selecionar vídeo;
2. iniciar upload;
3. observar progresso;
4. upload termina;
5. vídeo entra em processing;
6. Asset fica ready;
7. playback começa via HLS;
8. preview funciona;
9. Fake Progress funciona;
10. excluir vídeo;
11. confirmar remoção do Asset Mux.
```

Validar também um vídeo longo, preferencialmente a VSL de aproximadamente 16 minutos que revelou o gargalo anterior.

---

## 37. Resultado final

Arquitetura antiga:

```text
Browser
↓
R2
↓
MP4
↓
WatchMap Player
```

Arquitetura nova:

```text
Browser
↓
Mux Direct Upload
↓
Mux Asset
↓
Adaptive HLS
↓
WatchMap Player
↓
HTMLVideoElement
↓
Player Runtime
↓
Evandro
```

Cloudflare R2 deixa de fazer parte da infraestrutura de vídeo.

Não implemente funcionalidades além das especificadas.