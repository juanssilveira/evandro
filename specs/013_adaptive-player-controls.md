# Spec 013 — Adaptive Player Controls

## Objetivo

Fazer os controles do WatchMap Player se adaptarem ao tamanho real do próprio player.

Também padronizar todos os ícones dos controles utilizando Lucide Icons.

A responsividade deve considerar o container renderizado do player, não a largura da viewport.

## Regra principal

Os controles devem responder a:

```text
largura real do WatchMap Player
```

e não:

```text
window.innerWidth
```

Utilizar CSS Container Queries sempre que possível.

Isso é necessário porque o player pode estar:

- horizontal;
- vertical;
- dentro de uma div estreita;
- expandido em um container grande;
- dentro do Preview Canvas;
- dentro do Web Component externo.

O mesmo player deve se adaptar automaticamente em todos esses cenários.

## Container

O root visual do player deve funcionar como container de layout.

Exemplo conceitual:

```css
.player {
  container-type: inline-size;
}
```

Os controles internos devem utilizar breakpoints baseados nesse container.

Não criar lógica JavaScript baseada em `window.innerWidth` para organizar os controles.

## Ícones

Padronizar controles utilizando exclusivamente Lucide Icons.

Utilizar:

```text
Play        → Play
Pause       → Pause

Som         → Volume2
Mudo        → VolumeX

Velocidade  → Gauge

Fullscreen  → Maximize
Sair        → Minimize
```

O controle de velocidade deve utilizar explicitamente um ícone relacionado a velocidade, preferencialmente:

```text
Gauge
```

Não utilizar engrenagem para velocidade.

Ícones devem possuir:

- stroke consistente;
- tamanhos padronizados;
- alinhamento central;
- área de clique maior que o próprio desenho do ícone.

Não misturar bibliotecas diferentes de ícones.

## Layout adaptativo

Criar pelo menos três níveis de densidade.

### Standard

Para players com espaço confortável.

Exibir:

```text
Play/Pause
Volume icon
Volume slider
Current Time / Duration
Speed
Fullscreen
```

O controle de velocidade pode exibir:

```text
[Gauge] 1x
```

ou equivalente.

### Compact

Quando a largura começar a ficar limitada:

- manter Play/Pause;
- manter Mute/Volume icon;
- remover o slider visual de volume;
- manter tempo em formato compacto quando houver espaço;
- velocidade pode virar apenas botão com ícone `Gauge`;
- manter Fullscreen.

O menu de velocidade continua acessível ao clicar no ícone.

### Minimal

Para players muito estreitos:

Priorizar:

```text
Play/Pause
Mute
Speed
Fullscreen
```

A timeline continua utilizável.

Elementos textuais secundários podem ser reduzidos ou ocultados quando necessário para evitar overflow.

Nenhum controle pode:

- sair do player;
- sobrepor outro controle;
- comprimir até ficar inutilizável;
- quebrar em duas linhas.

## Espaçamento responsivo

Padding, gaps e tamanho dos controles também devem responder ao espaço disponível.

Players maiores podem possuir:

- mais espaçamento;
- ícones ligeiramente maiores;
- áreas de interação confortáveis.

Players menores devem possuir:

- gaps menores;
- padding menor;
- controles compactos.

Evitar simplesmente aplicar `transform: scale()` em toda a interface.

A adaptação deve acontecer através do layout.

## Timeline

A barra de progresso deve continuar ocupando a largura disponível independentemente do modo de controles.

Ela não deve disputar horizontalmente espaço com os botões.

Estrutura recomendada:

```text
┌──────────────────────────────┐
│         VIDEO                │
│                              │
│ ───────── TIMELINE ───────── │
│ controls controls controls   │
└──────────────────────────────┘
```

Timeline e linha de controles devem continuar estruturalmente separadas.

## Vertical 9:16

O player vertical não deve reutilizar cegamente o mesmo espaçamento do player horizontal.

Como normalmente possui menor largura, ele deve naturalmente cair em Compact ou Minimal conforme sua largura real.

Não criar um conjunto separado de controles exclusivo para 9:16.

O sistema deve responder ao tamanho do container.

## Speed Control

Padronizar o controle de velocidade.

Trigger:

```text
Gauge
```

Quando houver espaço suficiente:

```text
[Gauge] 1.5x
```

Quando não houver:

```text
[Gauge]
```

Ao abrir, mostrar opções existentes:

```text
0.75x
1x
1.25x
1.5x
2x
```

A velocidade atual deve possuir estado selecionado claro.

Não utilizar ícone de engrenagem.

## Tooltips

Controles icon-only devem possuir tooltip quando apropriado.

Exemplos:

```text
Reproduzir
Pausar
Ativar som
Desativar som
Velocidade
Tela cheia
Sair da tela cheia
```

Também manter `aria-label` apropriado.

## Touch

Os controles precisam continuar utilizáveis em dispositivos touch.

Não reduzir áreas de interação apenas porque o player está pequeno.

O ícone pode diminuir visualmente, mas a área clicável deve permanecer adequada.

## Fullscreen

Ao entrar em fullscreen, o player passa a possuir espaço maior e os controles devem se reorganizar automaticamente para o modo correspondente.

Não criar tratamento manual específico apenas para fullscreen se Container Queries já resolverem a mudança de largura.

## PlayerConfig

Respeitar configurações existentes.

Se:

```text
controls.hidden = true
```

a interface de controles permanece escondida independentemente do tamanho.

Configurações de fullscreen continuam determinando quais formas de fullscreen estão disponíveis.

## Runtime

Não alterar a semântica do Player Runtime.

As ações dos controles continuam modificando o `HTMLVideoElement`, e o Runtime continua observando o estado real.

Não criar eventos artificiais apenas por causa da refatoração visual.

## Dashboard e Embed

O comportamento deve ser idêntico em:

```text
Preview do dashboard
Web Component externo
```

Os estilos necessários devem continuar funcionando dentro do Shadow DOM do embed.

Nenhum CSS da página hospedeira deve quebrar o layout dos controles.

## Critérios de aceite

- controles respondem à largura real do player;
- implementação utiliza container queries;
- player 16:9 grande utiliza layout Standard;
- players menores passam para Compact;
- players muito estreitos passam para Minimal;
- player 9:16 não possui overflow nos controles;
- alterar largura da div externa reorganiza os controles automaticamente;
- fullscreen reorganiza os controles corretamente;
- nenhuma ação essencial fica inacessível;
- Lucide é utilizado em todos os controles;
- velocidade utiliza `Gauge`;
- controles icon-only possuem labels acessíveis;
- Preview e Web Component possuem o mesmo comportamento;
- Player Runtime permanece funcional e inalterado;
- checks obrigatórios passam.

Não implemente funcionalidades além das especificadas.