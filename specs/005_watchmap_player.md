# Spec 005 — WatchMap Player

## Objetivo

Implementar a primeira versão funcional do WatchMap Player para reproduzir os vídeos MP4 armazenados no Cloudflare R2.

Ao final deste milestone, o usuário deve conseguir abrir um vídeo da própria Account e reproduzi-lo utilizando controles próprios do WatchMap.

---

## Playback

O WatchMap Player deve utilizar o `HTMLVideoElement` como engine nativa de reprodução.

Não utilizar bibliotecas externas de player.

Fluxo:

```text
Video record
   ↓
storage_key
   ↓
server authorization
   ↓
presigned GET URL
   ↓
HTMLVideoElement
   ↓
WatchMap Player UI
```

O arquivo deve ser carregado diretamente:

```text
Browser → Cloudflare R2
```

e nunca passar pelo servidor Next.js.

---

## URL de reprodução

Adicionar à integração R2 existente uma função server-side para gerar uma presigned GET URL a partir de `storage_key`.

A URL:

* deve ser gerada somente após autenticação e autorização;
* deve possuir expiração limitada;
* não deve ser persistida no banco;
* deve ser tratada como credencial temporária.

O frontend nunca pode fornecer um `storage_key` arbitrário para obter acesso a um objeto.

---

## Página do vídeo

Criar:

```text
/videos/[videoId]
```

O servidor deve:

```text
session
  ↓
current Account
  ↓
buscar video por:
id + account_id
  ↓
gerar playback URL
  ↓
renderizar player
```

Se o vídeo não pertencer à Account atual:

```text
404
```

Não revelar a existência de vídeos de outras Accounts.

Atualizar a biblioteca `/videos` para permitir abrir cada vídeo.

---

## WatchMap Player

Criar o componente principal em:

```text
src/components/player/watchmap-player.tsx
```

O player deve possuir UI própria.

Não utilizar os controles nativos visíveis do navegador.

---

## Controles

Implementar:

```text
play / pause
seek
current time
duration
mute / unmute
volume
playback speed
fullscreen
```

Velocidades iniciais:

```text
0.75x
1x
1.25x
1.5x
2x
```

`1x` é o padrão.

---

## Comportamento

O `<video>` deve utilizar:

```text
playsInline
preload="metadata"
```

O player deve refletir corretamente:

* reprodução;
* pausa;
* progresso;
* seek;
* volume;
* mute;
* velocidade;
* loading/buffering;
* finalização;
* erro de reprodução.

A UI deve continuar sincronizada mesmo quando o estado do `HTMLVideoElement` mudar por eventos nativos do navegador.

---

## Seek

A barra de progresso deve:

* representar a duração total;
* acompanhar a posição atual;
* permitir clicar/arrastar para alterar `currentTime`;
* atualizar corretamente após o seek.

Seek deve funcionar utilizando byte-range do arquivo remoto.

---

## Loading

Enquanto o vídeo estiver aguardando dados suficientes para reprodução, apresentar feedback visual discreto no player.

Não bloquear toda a página.

---

## Erro

Se o vídeo não puder ser carregado ou reproduzido, apresentar estado de erro dentro do player.

Não expor:

```text
presigned URL
storage_key
stack trace
detalhes internos do R2
```

---

## Fullscreen

Implementar fullscreen utilizando a Fullscreen API do navegador.

O player inteiro deve entrar em fullscreen, não apenas o elemento `<video>`.

---

## Layout

O player deve:

* possuir fundo preto;
* ser responsivo;
* manter o vídeo centralizado;
* utilizar `object-fit: contain`;
* seguir `docs/DESIGN.md` nos controles;
* utilizar o roxo WatchMap para estados ativos relevantes.

A interface deve ser funcional em desktop e mobile.

---

## Estrutura

Separar responsabilidades quando necessário entre:

```text
WatchMapPlayer
PlayerControls
```

Não criar arquitetura excessiva para esta versão.

Toda lógica de reprodução deve permanecer encapsulada dentro do domínio do player.

---

## R2 CORS

Garantir que o bucket permita a reprodução do vídeo pelos ambientes utilizados pelo WatchMap.

Configurar os métodos necessários:

```text
GET
HEAD
```

e headers necessários para reprodução/range requests.

Não tornar o bucket público.

---

## Tracking

Não implementar tracking neste milestone.

Não implementar ainda:

```text
Evandro
session tracking
analytics
progress events para backend
viewer_id
watch_session_id
```

O próximo milestone conectará o runtime do player ao Evandro.

---

## Critérios de aceite

* [ ] `/videos/[videoId]` existe;
* [ ] apenas vídeos da Account atual podem ser acessados;
* [ ] playback URL é criada server-side;
* [ ] arquivo é servido diretamente R2 → Browser;
* [ ] bucket continua privado;
* [ ] WatchMap Player utiliza `HTMLVideoElement`;
* [ ] controles nativos não ficam visíveis;
* [ ] play/pause funciona;
* [ ] seek funciona;
* [ ] current time e duration funcionam;
* [ ] volume e mute funcionam;
* [ ] playback speed funciona;
* [ ] fullscreen funciona;
* [ ] loading possui feedback;
* [ ] erros possuem estado visual;
* [ ] player funciona em layout responsivo;
* [ ] `/videos` permite abrir um vídeo;
* [ ] nenhum tracking foi implementado;
* [ ] todos os checks obrigatórios passam;
* [ ] milestone é finalizado conforme `AGENTS.md`.

Não implemente funcionalidades além das especificadas.