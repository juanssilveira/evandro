# Spec 008 — Playback Settings

## Objetivo

Implementar as configurações de reprodução do WatchMap Player:

- Autoplay;
- Background Autoplay.

As duas funcionalidades são independentes e possuem semânticas diferentes para o Player Runtime.

## Configuração

Utilizar a estrutura existente:

```ts
playback: {
  autoplay: boolean
  backgroundAutoplay: boolean
}
```

Não criar novas colunas ou configurações fora de `PlayerConfig`.

## Interface

Adicionar uma categoria de configurações:

```text
Reprodução
```

Com dois toggles independentes.

### Autoplay

Descrição:

> Inicia o vídeo automaticamente como uma reprodução normal. Alguns navegadores podem bloquear autoplay com áudio.

### Background Autoplay

Descrição:

> Mantém o vídeo reproduzindo automaticamente no mudo como fundo antes da interação do espectador. Essa reprodução não representa uma visualização real.

As alterações devem persistir através da infraestrutura criada na Spec 007 e refletir no player.

---

## Autoplay

`playback.autoplay = true` representa autoplay real.

Ao carregar o player:

```text
attempt video.play()
```

A reprodução deve utilizar:

```text
playbackMode = foreground
playbackInitiator = autoplay
```

Não mutar automaticamente o vídeo apenas para fazer o autoplay funcionar.

Se o navegador permitir:

```text
PLAY
PLAYING
```

ocorrem normalmente através do `HTMLVideoElement`.

Se o navegador bloquear autoplay com áudio, não simular sucesso.

O player permanece aguardando interação do usuário, salvo quando Background Autoplay também estiver habilitado.

---

## Background Autoplay

`playback.backgroundAutoplay = true` representa reprodução visual de fundo.

Comportamento:

```text
muted = true
autoplay
loop
playsInline
```

Contexto do Runtime:

```text
playbackMode = background_autoplay
playbackInitiator = autoplay
```

O Runtime continua registrando a reprodução física normalmente:

```text
PLAY
PLAYING
TIME_UPDATE
...
```

Não cabe ao Runtime decidir se esses eventos contam como analytics real.

Essa interpretação será responsabilidade do Evandro.

---

## Resolução entre os modos

As configurações podem coexistir.

Resolver nesta ordem:

```text
1. autoplay = true
   → tentar Autoplay real

2. se Autoplay real for bloqueado
   e backgroundAutoplay = true
   → iniciar Background Autoplay

3. autoplay = false
   e backgroundAutoplay = true
   → iniciar Background Autoplay

4. ambos false
   → reprodução normal aguardando usuário
```

Se o Autoplay real funcionar, Background Autoplay não deve iniciar.

---

## Transição Background → Reprodução real

Durante Background Autoplay, o usuário deve possuir uma ação clara para começar a assistir normalmente.

Ao ocorrer essa interação:

```text
background autoplay
      ↓
interação do usuário
      ↓
desativar loop
      ↓
currentTime = 0
      ↓
muted = false
      ↓
playbackMode = foreground
playbackInitiator = user
      ↓
reprodução normal
```

A reprodução real deve começar do início para que o espectador não perca o conteúdo reproduzido silenciosamente no background.

---

## Runtime — mudança de contexto

O Runtime precisa registrar explicitamente quando o contexto de reprodução mudar durante uma reprodução já ativa.

Adicionar evento tipado:

```text
PLAYBACK_CONTEXT_CHANGE
```

Payload específico:

```ts
{
  previousMode
  mode
  previousInitiator
  initiator
}
```

Exemplo:

```text
PLAYBACK_CONTEXT_CHANGE
background_autoplay → foreground
autoplay → user
```

Esse evento é necessário porque a transição pode acontecer enquanto o `HTMLVideoElement` já está em estado `playing`, portanto um novo evento nativo `PLAY` não é garantido.

Não fabricar um `PLAY` artificial apenas para representar essa transição.

---

## Runtime

O Runtime continua tendo o `HTMLVideoElement` como fonte de verdade física.

Exemplos:

### Autoplay real

```text
PLAY
mode=foreground
initiator=autoplay

PLAYING
mode=foreground
initiator=autoplay
```

### Background Autoplay

```text
PLAY
mode=background_autoplay
initiator=autoplay

PLAYING
mode=background_autoplay
initiator=autoplay
```

### Usuário começa a assistir após Background Autoplay

```text
PLAYBACK_CONTEXT_CHANGE
background_autoplay → foreground
autoplay → user

SEEK
... → 0

VOLUME_CHANGE
0 → volume efetivo
```

Os eventos físicos efetivamente disparados pelo navegador devem continuar sendo registrados normalmente.

---

## Autoplay bloqueado

Bloqueio de autoplay pelo navegador não deve gerar `ERROR`.

É uma condição esperada da plataforma.

Com debug ativo, pode registrar:

```text
[WatchMap Player] AUTOPLAY_BLOCKED
```

Isso é log do Player/Playback Controller, não evento de erro do Runtime.

---

## Separação

A implementação deve preservar:

```text
PlayerConfig
     ↓
Playback Controller
     ↓
HTMLVideoElement
     ↓
Player Runtime
```

O Runtime não deve consultar diretamente `PlayerConfig`.

O Playback Controller resolve as configurações e informa ao Runtime apenas o contexto necessário.

---

## Critérios de aceite

- os dois toggles persistem corretamente;
- Autoplay inicia reprodução real quando permitido pelo navegador;
- Autoplay não força mute para contornar bloqueios;
- Background Autoplay reproduz muted e em loop;
- Background Autoplay possui contexto próprio no Runtime;
- Autoplay real possui contexto `foreground + autoplay`;
- Autoplay real tem prioridade quando ambos estão ativos;
- Background Autoplay funciona como fallback quando Autoplay real é bloqueado;
- usuário consegue transformar Background Autoplay em reprodução real;
- reprodução real iniciada após Background Autoplay começa em `0`;
- `PLAYBACK_CONTEXT_CHANGE` registra corretamente a transição;
- nenhum `PLAY` artificial é fabricado;
- bloqueio de autoplay não gera `ERROR`;
- configurações de outros grupos permanecem funcionando;
- checks obrigatórios passam.

Não implemente funcionalidades além das especificadas.