# Spec 009 — Embeddable Web Component

## Objetivo

Permitir que um vídeo WatchMap seja reproduzido em uma página externa através de um Web Component próprio.

O embed deve utilizar o mesmo WatchMap Player, PlayerConfig e Player Runtime utilizados dentro da plataforma.

O objetivo deste milestone é permitir testes reais do player fora do ambiente do dashboard.

## Embed

O formato inicial deve ser:

```html
<script
  src="https://PLAYER_HOST/embed/v1/watchmap-player.js"
  defer
></script>

<watchmap-player video-id="PUBLIC_VIDEO_ID"></watchmap-player>
```

O consumidor não deve precisar instalar React, CSS ou qualquer outra dependência.

## Identidade pública do vídeo

Adicionar ao domínio de `videos` um identificador público próprio para embed.

Exemplo conceitual:

```text
public_id
```

Requisitos:

- único;
- não sequencial;
- gerado pelo WatchMap;
- seguro para exposição pública;
- diferente do `id` interno utilizado como primary key.

O Web Component deve trabalhar com `public_id`, não com `account_id` ou identificadores privados.

## Embed API

Criar uma interface pública de leitura para o player resolver um vídeo através de `public_id`.

Exemplo conceitual:

```text
GET /api/embed/videos/{publicId}
```

Essa rota não utiliza sessão do usuário do dashboard.

Ela deve retornar somente os dados necessários para reprodução, por exemplo:

```ts
{
  videoId,
  playbackUrl,
  config
}
```

Não retornar:

- account_id;
- storage_key;
- credenciais;
- informações internas da Account;
- dados desnecessários do vídeo.

A `playbackUrl` deve ser uma presigned GET URL temporária do R2.

O bucket continua privado.

## CORS

A Embed API deve poder ser chamada por uma página externa.

Configurar CORS especificamente para essa interface pública.

Nesta fase beta, permitir origens externas necessárias para teste sem utilizar cookies ou credenciais de autenticação.

A arquitetura deve permitir adicionar futuramente allowlist de domínios por vídeo.

## Web Component

Registrar:

```js
customElements.define("watchmap-player", ...)
```

O elemento deve aceitar inicialmente:

```html
<watchmap-player video-id="..."></watchmap-player>
```

`video-id` é obrigatório.

Quando conectado ao DOM:

```text
connectedCallback
      ↓
carregar configuração pública
      ↓
resolver playback URL
      ↓
montar WatchMap Player
```

Quando removido:

```text
disconnectedCallback
      ↓
desmontar Player
      ↓
Runtime destroy
      ↓
liberar listeners e recursos
```

Remover e adicionar novamente o mesmo elemento não pode duplicar Runtime ou listeners.

## Shadow DOM

Utilizar Shadow DOM para isolar o WatchMap Player da página hospedeira.

O player deve continuar visualmente correto mesmo quando a página externa possuir CSS global agressivo.

Exemplos que não podem quebrar o player:

```css
button {
  all: unset;
}

video {
  width: 20px;
}

* {
  box-sizing: content-box;
}
```

Os estilos necessários do WatchMap Player devem ser fornecidos dentro do Web Component.

Não depender do Tailwind ou CSS da página hospedeira.

## Reutilização do Player

Não criar um segundo player específico para embed.

A implementação deve reutilizar o núcleo atual do:

```text
WatchMap Player
PlayerConfig
Player Runtime
```

A diferença entre dashboard e embed deve estar somente na forma de bootstrap e obtenção dos dados.

Evitar duplicação de comportamento.

## Runtime

O Runtime deve funcionar exatamente como dentro da plataforma.

Eventos já existentes devem continuar funcionando, incluindo:

```text
PLAYER_READY
PLAY
PLAYING
PAUSE
TIME_UPDATE
SEEK_START
SEEK_END
RATE_CHANGE
VOLUME_CHANGE
FULLSCREEN_ENTER
FULLSCREEN_EXIT
BUFFER_START
BUFFER_END
ENDED
ERROR
```

O lifecycle do Web Component deve integrar corretamente com:

```text
Runtime initialize
Runtime destroy
```

Com debug ativado na configuração do vídeo, logs devem aparecer também quando o player estiver embedado externamente.

## Configuração

O Web Component deve carregar e aplicar o `PlayerConfig` persistido daquele vídeo.

Nenhuma configuração do player deve ser hardcoded especificamente no embed.

Fluxo:

```text
public_id
   ↓
Embed API
   ↓
PlayerConfig
   ↓
WatchMap Player
```

## Estados

O Web Component deve tratar:

```text
loading
ready
video not found
playback failure
configuration failure
```

Falhas não podem expor:

- presigned URL;
- storage key;
- stack trace;
- informações internas.

## Bundle

Gerar um bundle standalone para o Web Component.

O bundle deve:

- funcionar sem dependências externas instaladas pela página;
- possuir entrypoint próprio;
- ser versionável;
- ser adequado para cache/CDN;
- não depender do runtime do Next.js da página hospedeira.

Estrutura conceitual:

```text
/embed/v1/watchmap-player.js
```

A estratégia de build pode utilizar uma ferramenta leve adequada para gerar o bundle standalone.

Não introduzir uma segunda aplicação completa apenas para gerar o embed.

## Teste externo

Criar uma página HTML mínima independente do dashboard para testar o Web Component.

Ela deve conter apenas algo equivalente a:

```html
<!doctype html>
<html>
  <body>
    <h1>External WatchMap Embed Test</h1>

    <watchmap-player video-id="PUBLIC_VIDEO_ID"></watchmap-player>

    <script src="WATCHMAP_EMBED_SCRIPT"></script>
  </body>
</html>
```

O teste deve provar que o player funciona sem depender dos componentes ou estilos do dashboard.

Também testar com CSS propositalmente conflitante para validar o isolamento do Shadow DOM.

## Critérios de aceite

- vídeo possui identificador público para embed;
- script standalone do Web Component é gerado;
- `<watchmap-player>` funciona em página externa;
- página externa não precisa de React ou CSS do WatchMap;
- Shadow DOM isola corretamente os estilos;
- Embed API não expõe dados privados;
- R2 continua privado;
- playback ocorre diretamente R2 → browser;
- PlayerConfig real do vídeo é aplicado;
- Runtime funciona dentro do embed;
- debug funciona no embed;
- fullscreen funciona no embed;
- remover o elemento dispara cleanup/destroy;
- remount não duplica listeners;
- player existente é reutilizado em vez de duplicado;
- checks obrigatórios passam.

Não implemente funcionalidades além das especificadas.