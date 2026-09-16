# Spec 006 — Player Runtime

## Objetivo

Criar a camada de runtime do WatchMap Player responsável por transformar eventos nativos do `HTMLVideoElement` em eventos padronizados do WatchMap.

O Runtime será a fonte de dados utilizada posteriormente pelo Evandro.

Neste milestone não existe envio de tracking para backend.

---

## Arquitetura

Fluxo:

```text
HTMLVideoElement
      ↓
Player Runtime
      ↓
WatchMap Events
      ↓
futuros consumidores
```

O `WatchMapPlayer` continua responsável pela reprodução e interface.

O `PlayerRuntime` observa o estado real do `<video>` e publica eventos normalizados.

---

## Localização

Criar o runtime dentro do domínio do player.

Estrutura sugerida:

```text
src/components/player/
├── watchmap-player.tsx
├── player-controls.tsx
└── runtime/
    ├── player-runtime.ts
    └── types.ts
```

A estrutura pode ser ajustada se a implementação existente justificar, sem alterar a separação de responsabilidades.

---

## Eventos

O Runtime deve expor inicialmente:

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

BUFFER_START
BUFFER_END

ENDED
ERROR
```

Os nomes devem possuir representação tipada e centralizada.

Não espalhar strings de eventos manualmente pelo código.

---

## Snapshot

Todo evento deve carregar um snapshot consistente do estado de reprodução.

Estrutura conceitual:

```ts
{
  eventId
  type

  videoId

  currentTime
  duration
  playbackRate

  paused
  muted
  volume
  ended

  timestamp
}
```

### Regras

`eventId`

* identificador único daquela ocorrência;
* gerado no momento da emissão.

`currentTime`

* segundos;
* preservar precisão disponível;
* não arredondar para segundos inteiros.

`duration`

* segundos;
* permitir valor indisponível antes dos metadados carregarem.

`timestamp`

* horário real da ocorrência;
* representar tempo absoluto de forma inequívoca.

---

## Eventos específicos

Alguns eventos precisam carregar dados adicionais.

### SEEK_START

Registrar:

```text
from
```

representando a posição antes do seek.

### SEEK_END

Registrar:

```text
from
to
```

Permitindo identificar direção e distância do seek posteriormente.

### RATE_CHANGE

Registrar:

```text
previousRate
newRate
```

### VOLUME_CHANGE

Registrar estado atualizado de:

```text
volume
muted
```

### ERROR

Registrar apenas informações seguras e úteis para diagnóstico.

Não incluir URLs assinadas ou dados sensíveis.

---

## TIME_UPDATE

`TIME_UPDATE` representa a posição atual do vídeo para consumidores internos.

Não transformar esse evento em tracking de backend.

Não implementar nesta spec:

```text
checkpoint a cada 5s
retention
watched bitmap
watched_ms
analytics
```

A frequência deve acompanhar o comportamento do player sem criar timers artificiais de 1 segundo.

O Runtime deve derivar estado do próprio `HTMLVideoElement`.

---

## Seek

O Runtime deve distinguir claramente:

```text
reprodução normal
≠
seek
```

Fluxo esperado:

```text
currentTime = 20.4

SEEK_START
from = 20.4

usuário move timeline

SEEK_END
from = 20.4
to = 57.8
```

A UI do player não deve precisar emitir eventos analíticos manualmente para que o Runtime identifique o seek.

---

## Buffering

Mapear o comportamento nativo do vídeo para:

```text
BUFFER_START
BUFFER_END
```

Evitar emitir múltiplos `BUFFER_START` consecutivos para o mesmo período de buffering.

Fluxo:

```text
PLAYING
↓
BUFFER_START
↓
BUFFER_END
↓
PLAYING
```

O Runtime deve manter estado suficiente para evitar eventos duplicados inconsistentes.

---

## Ready

Emitir:

```text
PLAYER_READY
```

quando o vídeo possuir metadados suficientes para o Runtime conhecer a reprodução básica, incluindo duração quando disponível.

Esse evento deve ocorrer uma única vez por instância do player.

---

## Lifecycle

O Runtime deve possuir lifecycle explícito:

```text
initialize
destroy
```

Ao destruir:

* remover todos os event listeners;
* liberar referências;
* impedir emissões posteriores.

Re-renderizações do React não podem registrar listeners duplicados.

---

## API para consumidores

O Runtime deve permitir que futuros módulos se inscrevam nos eventos sem conhecer o `HTMLVideoElement`.

Exemplo conceitual:

```ts
runtime.subscribe((event) => {
  // Evandro futuramente
})
```

A API deve retornar uma forma simples de unsubscribe.

Não adicionar biblioteca externa de event emitter.

---

## Debug

Em ambiente de desenvolvimento, permitir visualizar os eventos do Runtime no console.

Formato esperado:

```text
[WatchMap Runtime] PLAYER_READY
[WatchMap Runtime] PLAY
[WatchMap Runtime] TIME_UPDATE 4.328
[WatchMap Runtime] PAUSE 7.912
[WatchMap Runtime] SEEK_START 7.912
[WatchMap Runtime] SEEK_END 7.912 → 42.441
```

O logging deve ser simples de desativar e não deve poluir produção por padrão.

---

## Integração

O `WatchMapPlayer` deve inicializar um único Runtime para sua instância de vídeo.

O Runtime deve receber pelo menos:

```text
videoId
HTMLVideoElement
```

A interface visual continua consumindo diretamente o estado necessário para renderização quando isso for mais simples.

Não transformar o Runtime em store global de UI.

---

## Critérios de aceite

* [ ] Runtime existe como módulo separado do Player UI;
* [ ] eventos estão tipados e centralizados;
* [ ] `PLAYER_READY` funciona;
* [ ] play, playing, pause e ended são detectados;
* [ ] `TIME_UPDATE` preserva precisão temporal;
* [ ] seek registra `from` e `to`;
* [ ] alteração de velocidade é detectada;
* [ ] volume e mute são detectados;
* [ ] buffering possui início e fim coerentes;
* [ ] erros geram evento seguro;
* [ ] todo evento possui snapshot consistente;
* [ ] listeners não duplicam após re-render;
* [ ] destroy remove listeners corretamente;
* [ ] consumidores podem subscribe/unsubscribe;
* [ ] debug funciona em desenvolvimento;
* [ ] nenhum evento é enviado ao backend;
* [ ] todos os checks obrigatórios passam;
* [ ] milestone é finalizado conforme `AGENTS.md`.

Não implemente funcionalidades além das especificadas.