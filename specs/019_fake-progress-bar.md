# Spec 019 — Fake Progress Bar

## Objetivo

Implementar a Fake Progress Bar do WatchMap Player.

A funcionalidade deve criar uma curva visual de progresso calculada automaticamente pelo WatchMap com base na duração real do vídeo.

O usuário não configura a curva.

Fluxo:

```text
duração do vídeo
      ↓
WatchMap Fake Progress Engine
      ↓
curva automática
      ↓
progresso visual do player
```

A Fake Progress Bar altera somente a representação visual da timeline.

Tempo real, seek, Runtime e analytics permanecem baseados exclusivamente no `HTMLVideoElement`.

---

## Experiência do produto

A funcionalidade deve ser apresentada como um recurso próprio do WatchMap, sem expor parâmetros técnicos para o usuário.

Na interface, utilizar:

```text
Barra de progresso inteligente
```

Descrição:

```text
Nosso motor calcula automaticamente uma curva de progresso adaptada à duração do vídeo, acelerando o avanço visual no início e suavizando ao longo da reprodução.
```

Pode utilizar um pequeno indicador visual:

```text
Automático
```

A apresentação deve transmitir que existe inteligência interna por trás da funcionalidade, sem exageros ou linguagem promocional excessiva.

Não exibir:

```text
targetPercent
targetSeconds
curva
fórmula
checkpoints
coeficientes
```

---

## Configuração

A configuração pública dessa funcionalidade deve ser:

```ts
progress: {
  height: number

  fake: {
    enabled: boolean
  }
}
```

Defaults:

```ts
progress: {
  height: 4,

  fake: {
    enabled: false
  }
}
```

Não alterar `PlayerConfig.version`.

Parâmetros internos utilizados pelo algoritmo não devem fazer parte do `PlayerConfig`.

Se existirem campos preparatórios de curva no schema/defaults atuais, eles devem ser removidos da configuração final dessa funcionalidade.

Não criar migration de banco.

---

## Configurações disponíveis ao usuário

O usuário pode controlar somente:

```text
Barra de progresso inteligente
→ ON/OFF

Altura da barra
→ espessura visual
```

Nenhuma configuração da curva deve ser exposta.

---

## Interface

Adicionar uma seção:

```text
Barra de progresso
```

Estrutura conceitual:

```text
Barra de progresso inteligente          [Automático]

Nosso motor calcula automaticamente uma curva de
progresso adaptada à duração do vídeo, acelerando
o avanço visual no início e suavizando ao longo
da reprodução.

[Switch] Ativar barra inteligente


Altura da barra

4 px

[ controle de altura ]
```

Seguir o padrão visual já utilizado nas configurações do player.

---

## Altura da barra

Configuração:

```text
progress.height
```

Unidade:

```text
px
```

Range:

```text
2px → 10px
```

Default:

```text
4px
```

A altura deve funcionar independentemente do estado da Fake Progress Bar.

```text
Fake OFF
→ progresso real com altura personalizada

Fake ON
→ progresso calculado com altura personalizada
```

Modificar somente a espessura visual da barra.

Não diminuir a área clicável da timeline.

A hit area de seek deve continuar confortável mesmo quando:

```text
height = 2
```

---

## Fake Progress Engine

Criar uma camada isolada responsável pelo cálculo da curva.

O componente visual não deve possuir a fórmula espalhada em seu JSX.

Estrutura conceitual:

```text
Player
  ↓
currentTime + duration
  ↓
Fake Progress Engine
  ↓
displayProgress
```

API conceitual:

```ts
calculateFakeProgress({
  currentTime,
  duration
}): number
```

Retorno:

```text
0 → 1
```

---

## Responsabilidade do motor

O WatchMap Fake Progress Engine deve calcular automaticamente a curva apropriada utilizando:

```text
duration
```

como entrada principal nesta primeira versão.

A intensidade da curva deve se adaptar à duração.

Por exemplo:

```text
vídeo curto
→ distorção visual mais moderada

vídeo médio
→ curva intermediária

vídeo longo
→ avanço inicial proporcionalmente mais forte
```

Os valores exatos pertencem ao motor.

Não codificar conceitos como:

```text
85% em 10 segundos
```

como regra universal da funcionalidade.

---

## Perfil interno

O motor pode gerar internamente um perfil equivalente a:

```ts
type FakeProgressPoint = {
  time: number
  progress: number
}

type FakeProgressProfile = FakeProgressPoint[]
```

Exemplo conceitual:

```text
0s        →   0%
checkpoint →  progresso calculado
checkpoint →  progresso calculado
checkpoint →  progresso calculado
fim       → 100%
```

Os checkpoints não são configuráveis nem persistidos pelo usuário.

A implementação pode utilizar:

```text
função matemática
```

ou:

```text
perfil de checkpoints + interpolação
```

desde que permaneça encapsulada no Fake Progress Engine.

---

## Propriedades da curva

Toda curva gerada deve ser:

```text
determinística
monotônica
contínua
suave
```

Deve sempre respeitar:

```text
início → 0%

fim → 100%
```

Nunca pode:

```text
ficar abaixo de 0%
ultrapassar 100%
voltar para trás durante reprodução normal
terminar antes de 100%
```

O comportamento visual esperado é:

```text
início
→ avanço mais perceptível

meio
→ desaceleração gradual

final
→ aproximação progressiva de 100%
```

Não criar mudanças bruscas entre segmentos.

---

## Progresso exibido

Calcular separadamente:

```text
realProgress
fakeProgress
displayProgress
```

Conceitualmente:

```ts
const realProgress = currentTime / duration;

const fakeProgress = calculateFakeProgress({
  currentTime,
  duration,
});

const displayProgress =
  config.progress.fake.enabled
    ? fakeProgress
    : realProgress;
```

A implementação pode adaptar os nomes à arquitetura existente.

---

## Separação entre visual e reprodução

A Fake Progress Bar é exclusivamente visual.

Nunca alterar:

```text
video.currentTime
duration
playbackRate
buffer
Playback Controller
Player Runtime
eventos
analytics
```

Separação obrigatória:

```text
HTMLVideoElement
      ↓
tempo real
      ↓
Player Runtime
```

e:

```text
currentTime + duration
      ↓
Fake Progress Engine
      ↓
displayProgress
      ↓
UI
```

Runtime permanece sendo a verdade física da reprodução.

---

## Seek

A timeline continua representando uma superfície interativa de seek real.

Ao clicar ou arrastar:

```text
posição do ponteiro
      ↓
duration real
      ↓
video.currentTime
```

Não utilizar a curva fake para calcular o destino do seek.

A posição visual da barra e a função de seek permanecem responsabilidades independentes.

---

## Pause

Não criar timer próprio para a Fake Progress Bar.

Quando o vídeo pausa:

```text
currentTime para
↓
fake progress para
```

Quando a reprodução continua:

```text
currentTime avança
↓
fake progress continua
```

---

## Background Autoplay

Durante:

```text
playbackMode === "background_autoplay"
```

o progresso visual fake de uma reprodução foreground não deve avançar.

Quando o usuário iniciar a reprodução real e o fluxo existente retornar o vídeo para:

```text
currentTime = 0
```

a Fake Progress Bar deve começar em:

```text
0%
```

Não alterar a lógica do Playback Controller.

---

## Autoplay foreground

Quando autoplay resultar em reprodução foreground real:

```text
progress.fake.enabled = true
```

deve aplicar a Fake Progress Bar normalmente.

---

## Final da reprodução

Quando o vídeo atingir o final:

```text
displayProgress = 1
```

Garantir visualmente:

```text
100%
```

independentemente de precisão decimal ou interpolação interna.

---

## Evolução do motor

A arquitetura deve permitir evolução do Fake Progress Engine sem modificar o WatchMap Player.

Primeira versão:

```text
duração
   ↓
motor determinístico
   ↓
curva
```

Evolução futura:

```text
duração
+
estrutura do conteúdo
+
análise por IA
+
dados históricos
+
comportamento dos espectadores
        ↓
WatchMap Fake Progress Engine
        ↓
curva otimizada
```

Essa evolução não faz parte desta spec.

Não implementar IA agora.

Não criar processamento de vídeo.

Não persistir análise.

Apenas garantir que o cálculo esteja isolado o suficiente para evoluir posteriormente.

---

## Preview

Alterações devem refletir imediatamente no preview.

```text
ativar/desativar
→ preview atualiza

alterar altura
→ preview atualiza
```

Reutilizar o fluxo otimista existente:

```text
mudança local
→ preview
→ persistência
→ rollback em erro
```

---

## Embed

O embed deve utilizar a mesma configuração e o mesmo Fake Progress Engine do preview interno.

Não criar implementação específica para embed.

Resultado:

```text
Preview
   ↓
mesmo PlayerConfig
   ↓
mesmo Player
   ↓
mesmo Fake Progress Engine

Embed
   ↓
mesmo PlayerConfig
   ↓
mesmo Player
   ↓
mesmo Fake Progress Engine
```

---

## Critérios de aceite

- Fake Progress Bar é implementada;
- usuário consegue ativar/desativar a funcionalidade;
- interface apresenta a funcionalidade como um recurso automático do WatchMap;
- descrição informa que o motor calcula a curva automaticamente;
- usuário não configura parâmetros da curva;
- usuário consegue configurar somente a altura visual da barra;
- altura aceita 2px até 10px;
- altura default é 4px;
- altura funciona com fake ON e OFF;
- hit area da timeline não diminui junto com a altura visual;
- Fake Progress Engine existe separado da UI;
- duração do vídeo influencia automaticamente a curva;
- vídeos de durações diferentes podem possuir curvas diferentes;
- curva começa em 0%;
- curva termina exatamente em 100%;
- curva é contínua e monotônica;
- início possui avanço visual proporcionalmente mais forte;
- final desacelera progressivamente;
- nenhum parâmetro interno da curva é exposto no PlayerConfig;
- pause/resume funciona corretamente;
- seek continua utilizando tempo real;
- autoplay foreground funciona;
- Background Autoplay não avança uma reprodução foreground;
- Runtime não é alterado;
- Playback Controller não recebe lógica de Fake Progress;
- nenhum valor fake chega aos eventos ou analytics;
- preview e embed utilizam a mesma implementação;
- `pnpm typecheck` passa;
- `pnpm lint` passa;
- `pnpm build` passa.

Não implemente funcionalidades além das especificadas.