# Spec 022 — Background Preview Assets

## Objetivo

Criar um asset visual leve derivado dos primeiros segundos de cada vídeo para ser utilizado no Background Autoplay.

O vídeo principal continua:

Mux
→ HLS
→ WatchMap Player

O Background Autoplay passa a utilizar:

Mux Asset
→ geração única de preview animado
→ R2
→ CDN de assets
→ WatchMap Player

O Background Autoplay NÃO deve iniciar o HLS principal.

---

## 1. Arquitetura final

```text
UPLOAD

Browser
↓
Mux Direct Upload
↓
Mux Asset
↓
Playback ID
↓
HLS principal
```

Após o Asset ficar pronto:

```text
Mux Asset
↓
Mux Animated Image API
↓
primeiros ~6 segundos
↓
WebP animado
↓
R2
↓
backgroundPreviewUrl
```

Durante uma visita pública:

```text
Página abre
↓
background preview do R2
↓
loop visual
↓
ZERO playback Mux principal
```

Somente após interação:

```text
Clique para ativar o som / Play
↓
+1 View
↓
carregar HLS do Mux
↓
vídeo real começa do início
```

---

## 2. Responsabilidades

Mux:

```text
vídeo original
encoding
HLS
playback real
geração inicial do preview derivado
```

R2:

```text
background preview
futuros assets derivados leves
```

WatchMap:

```text
Player
Runtime
controle de playback
views
analytics
```

R2 NÃO volta a ser infraestrutura de vídeo principal.

Não utilizar R2 para:

- vídeo original;
- playback principal;
- MP4 completo;
- HLS;
- upload do vídeo do usuário;
- fallback do Mux.

---

## 3. Formato inicial do Background Preview

Gerar inicialmente:

```text
formato: animated WebP
início: 0s
fim: aproximadamente 6s
largura: 640px
fps: aproximadamente 12
sem áudio
```

A URL de origem pode seguir conceitualmente:

```text
https://image.mux.com/{PLAYBACK_ID}/animated.webp
  ?start=0
  &end=6
  &width=640
  &fps=12
```

Nunca expor credenciais Mux.

A geração deve ocorrer server-side.

---

## 4. Vídeos menores que 6 segundos

Se:

```text
duration < 6s
```

usar a duração disponível.

Nunca solicitar um `end` superior à duração real de forma que quebre a geração.

Manter duração mínima válida para Animated Image API.

---

## 5. WebP como primeira opção

Utilizar animated WebP como formato preferencial por eficiência.

Validar funcionamento real nos browsers suportados pelo WatchMap.

O asset precisa:

```text
animar automaticamente
repetir continuamente
não exigir interação
```

Se o WebP produzido pelo Mux não repetir de forma confiável nos browsers alvo:

utilizar o endpoint equivalente em GIF como fallback.

Não implementar FFmpeg apenas para resolver esse problema.

---

## 6. R2 como Asset Storage

Reintroduzir R2 apenas como storage de assets derivados.

Criar uma camada claramente nomeada.

Exemplo conceitual:

```text
src/lib/asset-storage/r2.ts
```

Evitar recriar algo genérico chamado apenas:

```text
src/lib/r2.ts
```

que faça parecer que R2 voltou a ser nossa infraestrutura principal de vídeo.

---

## 7. Dependência AWS

Se necessário, utilizar:

```text
@aws-sdk/client-s3
```

apenas para:

```text
PutObject
DeleteObject
```

Não reintroduzir:

```text
presigned upload
presigned playback
GetObject para playback do usuário
```

Não adicionar:

```text
@aws-sdk/s3-request-presigner
```

se não houver necessidade real.

---

## 8. Variáveis de ambiente

Adicionar somente as variáveis necessárias ao asset storage.

Exemplo:

```env
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_ASSETS_BUCKET=
ASSETS_BASE_URL=
```

`ASSETS_BASE_URL` representa a origem pública dos assets.

Development poderá utilizar o domínio público correspondente ao bucket de development.

Production será configurado posteriormente.

Não introduzir Stage.

---

## 9. Buckets

A arquitetura prevê somente:

```text
evandro-assets-development
evandro-assets-production
```

Não utilizar:

```text
watchmap-videos-*
```

O bucket agora é de ASSETS derivados, não vídeos principais.

Não criar bucket Stage.

---

## 10. Chave do objeto

Utilizar chave imutável/versionada.

Exemplo:

```text
background-previews/{videoPublicId}/{muxAssetId}.webp
```

Não utilizar simplesmente:

```text
background/{videoId}.webp
```

se isso puder causar cache antigo após substituir o vídeo.

A URL deve ser imutável enquanto aquele Asset Mux existir.

---

## 11. Cache

Como o asset é versionado pelo Asset ID, utilizar cache agressivo.

Conceitualmente:

```http
Cache-Control: public, max-age=31536000, immutable
```

O preview deve ser baixado uma vez e reutilizado pelo navegador/CDN.

---

## 12. Geração

Quando o Mux Asset atingir:

```text
ready
```

e possuir:

```text
muxPlaybackId
```

verificar se o background preview já existe.

Se não existir:

```text
Mux Animated Image API
↓
fetch server-side
↓
validar resposta
↓
upload R2
↓
persistir key
```

Não gerar novamente em toda sincronização.

A operação deve ser idempotente.

---

## 13. Estado do preview

Adicionar ao vídeo o estado necessário para representar o derivado.

Conceitualmente:

```text
backgroundPreviewStatus
backgroundPreviewKey
```

Estados mínimos:

```text
pending
ready
errored
```

Adapte nomes ao padrão atual do schema.

Não persistir URL completa se ela puder ser derivada de:

```text
ASSETS_BASE_URL
+
backgroundPreviewKey
```

---

## 14. Erro na geração

Falha ao gerar background preview NÃO deve tornar o vídeo principal inutilizável.

Se:

```text
Mux Asset = ready
background preview = errored
```

o vídeo continua:

```text
ready
```

O player deve usar fallback:

```text
poster estático
```

Nunca usar como fallback:

```text
autoplay do HLS principal
```

porque isso reintroduziria exatamente o consumo que queremos eliminar.

---

## 15. Background Autoplay público

Quando:

```text
backgroundAutoplay.enabled = true
```

e existir:

```text
backgroundPreviewUrl
```

o player deve mostrar:

```text
background preview animado
+
overlay atual
+
CTA atual
```

Não carregar o HLS principal nesse momento.

---

## 16. Player inicial

Na abertura da página pública:

```text
Mux HLS
→ NÃO carregar
```

Nenhum:

```text
.m3u8
segmento HLS
hls.js
video principal
```

deve ser iniciado exclusivamente por causa do Background Autoplay.

---

## 17. Ativação foreground

Quando o visitante realizar a interação principal:

```text
Clique para ativar o som
```

executar:

```text
background preview continua visível
↓
inicializar HLS real
↓
aguardar player real ficar pronto/playing
↓
realizar transição visual
↓
remover background preview
```

Evitar flash preto.

O vídeo principal deve começar:

```text
currentTime = 0
```

Preservar a regra existente do foreground playback.

---

## 18. Transição

Não remover o preview imediatamente ao clique.

Enquanto o HLS inicializa:

```text
preview permanece como camada visual
```

Quando o vídeo real estiver pronto para aparecer:

```text
fade curto
preview → vídeo real
```

Evitar:

- tela preta;
- flash;
- layout shift.

---

## 19. Views

Background preview:

```text
0 views
```

Abrir página:

```text
0 views
```

Loop do preview:

```text
0 views
```

Primeira ativação intencional do foreground:

```text
+1 view
```

Pause + Play na mesma sessão:

```text
continua 1 view
```

O background asset nunca pode gerar View.

---

## 20. Runtime

O Player Runtime NÃO deve observar o background preview.

Runtime continua conectado exclusivamente ao:

```text
HTMLVideoElement do playback real
```

Não emitir eventos Runtime para:

```text
loop do preview
tempo do preview
fim do preview
```

O preview é decoração visual.

---

## 21. Fake Progress

Durante Background Autoplay:

```text
Fake Progress = 0
```

Preservar comportamento existente.

Somente quando foreground real iniciar:

```text
currentTime real
↓
Fake Progress Engine
```

Não derivar fake progress da animação de background.

---

## 22. Editor

No editor do WatchMap, o comportamento padrão também deve evitar HLS.

Quando Background Autoplay estiver habilitado:

```text
background preview do R2
+
overlay
```

Isso permite visualizar praticamente o estado real do player sem consumir delivery Mux.

---

## 23. Testar reprodução

Manter/adicionar uma ação explícita:

```text
Testar reprodução
```

Somente após essa ação o editor pode carregar o HLS real.

Teste interno:

```text
não contabiliza View
não entra em analytics públicos
```

Porém:

```text
consome delivery Mux real
```

porque existe reprodução real.

---

## 24. Sem Background Autoplay

Se:

```text
backgroundAutoplay.enabled = false
```

o editor padrão deve utilizar:

```text
poster
```

e não carregar HLS automaticamente apenas para montar o preview visual.

---

## 25. Embed API

Adicionar ao contrato público somente a informação necessária.

Exemplo:

```json
{
  "playback": {
    "type": "hls",
    "url": "..."
  },
  "backgroundPreviewUrl": "https://assets.../background.webp"
}
```

Não retornar:

```text
R2 key interno desnecessário
R2 credentials
Mux Asset ID
Mux Upload ID
```

---

## 26. WatchMap Player

O Player conhece:

```text
playback HLS
backgroundPreviewUrl
```

O Player NÃO conhece:

```text
R2
bucket
Mux Asset
Mux image API
```

Assim continuamos com separação correta:

```text
backend
→ sabe onde os assets estão

player
→ recebe URLs
```

---

## 27. Exclusão

Ao excluir vídeo:

```text
delete Mux Asset
delete background preview R2
delete registro WatchMap
```

Tratamento idempotente.

Se o background preview já não existir:

não bloquear a exclusão do vídeo.

---

## 28. Substituição/reupload

Caso o source Mux de um vídeo seja substituído:

gerar um novo background preview usando o novo `muxAssetId`.

Como a key contém o Asset ID:

```text
novo asset
→ nova URL
```

Após confirmação do novo preview:

remover o asset derivado antigo quando apropriado.

---

## 29. Spec 021

Atualizar documentação criada na Spec 021.

Onde estiver escrito:

```text
R2 deixa completamente de fazer parte da arquitetura
```

corrigir para:

```text
R2 deixa de fazer parte da infraestrutura de playback principal.
```

Arquitetura oficial:

```text
Mux
→ vídeo principal

R2
→ assets derivados leves
```

Não reintroduzir nenhum fluxo R2 anterior.

---

## 30. Não implementar

Não implementar nesta spec:

- FFmpeg;
- MediaConvert;
- Cloudflare Stream;
- upload principal para R2;
- MP4 completo no R2;
- fallback de HLS para R2;
- signed assets;
- seleção manual de trecho;
- configuração de FPS pelo usuário;
- configuração de qualidade pelo usuário;
- configuração de duração do preview pelo usuário.

O comportamento é automático.

---

## 31. Valores internos iniciais

Começar com aproximadamente:

```text
duration = 6 segundos
width = 640
fps = 12
format = webp
```

Esses valores são implementação interna.

Não adicionar opções na UI.

Podem ser ajustados posteriormente após medirmos tamanho e aparência.

---

## 32. Validação de Network — Página pública

Background Autoplay ativo.

Antes da interação:

deve existir request para algo como:

```text
background.webp
```

Não deve existir:

```text
.m3u8
.ts
.m4s
```

do playback principal.

Após interação:

```text
.m3u8
segmentos HLS
```

devem começar a aparecer.

---

## 33. Validação de Network — Editor

Abrir editor:

```text
preview asset
→ permitido
```

Mux HLS:

```text
→ NÃO
```

Clicar "Testar reprodução":

```text
Mux HLS
→ SIM
```

---

## 34. Validação visual

Confirmar:

- preview ocupa exatamente a área do vídeo;
- object-fit permanece correto;
- aspect ratio permanece correto;
- overlay atual continua correto;
- animação repete sem flash visível;
- transição para HLS não gera tela preta;
- mobile funciona;
- desktop funciona.

---

## 35. Validação de custo/comportamento

Com DevTools aberto:

```text
abrir página
esperar 30 segundos
```

O background pode repetir várias vezes.

Mesmo assim:

```text
nenhum request de playback principal Mux
```

deve ocorrer.

Somente após interação explícita o HLS deve iniciar.

---

## 36. Critérios de aceite

A implementação está concluída quando:

```text
1. upload principal continua Mux;
2. Asset ready gera background preview automaticamente;
3. preview é persistido no R2;
4. URL é salva/derivável no WatchMap;
5. background autoplay público usa somente esse preview;
6. preview repete continuamente;
7. HLS não carrega antes da interação;
8. interação inicia HLS real do zero;
9. transição não apresenta flash preto;
10. background preview não conta View;
11. editor não carrega HLS por padrão;
12. Runtime ignora completamente o preview;
13. Fake Progress permanece em 0 no background;
14. delete remove também o asset derivado;
15. fallback em erro é poster, nunca autoplay Mux.
```

Não implemente funcionalidades além das especificadas.