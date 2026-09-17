# Spec 020 — Background Autoplay CTA

## Objetivo

Refinar o CTA exibido durante `background_autoplay` para que tenha identidade própria do WatchMap, melhor hierarquia visual e menos aparência de botão genérico.

Não alterar o comportamento funcional do Background Autoplay.

Estado:

```text
playbackMode === "background_autoplay"
```

O overlay escuro existente deve ser preservado.

---

## Conteúdo

Substituir o texto atual por uma composição em coluna:

```text
[ ícone ]

Seu vídeo já começou
Clique para ativar o som
```

Utilizar exatamente:

```text
Seu vídeo já começou
Clique para ativar o som
```

Não utilizar:

```text
Ativar som e assistir do início
```

---

## Hierarquia

O CTA deve possuir três níveis visuais:

```text
ícone
↓
título discreto
↓
ação principal
```

### Ícone

Utilizar um ícone relacionado a áudio, preferencialmente:

```text
Volume2
```

O ícone deve:

- ficar centralizado;
- possuir tamanho suficiente para ser reconhecido rapidamente;
- não dominar o CTA;
- permanecer legível em players pequenos.

Pode utilizar um pequeno fundo translúcido ou círculo interno para dar acabamento.

---

## Título

Texto:

```text
Seu vídeo já começou
```

Deve ser:

- pequeno;
- discreto;
- medium ou semibold;
- menor que o texto principal;
- com opacidade levemente reduzida.

Sua função é contextualizar, não competir com a ação.

---

## Texto principal

Texto:

```text
Clique para ativar o som
```

Deve ser o principal elemento textual.

Utilizar:

- tamanho maior que o título;
- peso semibold;
- boa legibilidade;
- alinhamento central;
- no máximo duas linhas em containers estreitos.

---

## Forma do CTA

Evitar aparência de botão tradicional em formato pill.

Preferir uma peça compacta com:

```text
rounded-xl
ou
rounded-2xl
```

em vez de:

```text
rounded-full
```

O CTA continua totalmente clicável.

Visual esperado:

```text
┌─────────────────────────┐
│           🔊            │
│   Seu vídeo já começou  │
│ Clique para ativar o som│
└─────────────────────────┘
```

Não transformar em card complexo.

---

## Cor

O fundo principal continua utilizando:

```text
var(--player-accent)
```

Preservar contraste suficiente para texto e ícone brancos.

Pode utilizar:

```text
borda branca muito sutil
sombra moderada
highlight interno discreto
```

Não utilizar efeitos excessivos.

---

## Pulse

Refinar o pulse existente.

Atualmente o ring utiliza diretamente:

```text
var(--player-accent)
```

Isso deve ser alterado.

O pulse precisa ser visualmente muito mais claro que o CTA principal.

Conceito:

```text
CTA
→ accent color

Pulse
→ versão clara/luminosa do accent
→ baixa opacidade
→ expansão suave
→ desaparecimento
```

O ring pode ser derivado do accent utilizando uma mistura com branco.

Exemplo conceitual:

```css
color-mix(
  in srgb,
  var(--player-accent) 25%,
  white 75%
)
```

O valor exato pode ser ajustado visualmente.

O importante é:

```text
pulse claramente mais claro que o CTA
```

e não apenas uma versão transparente da mesma cor escura.

---

## Animação

Manter o pulse externo.

Não animar continuamente o scale do CTA principal.

Fluxo:

```text
ring aparece próximo ao CTA
↓
expande suavemente
↓
perde opacidade
↓
desaparece
↓
reinicia
```

Referência:

```text
duração: ~1.8s–2.2s
ease-out
```

O efeito deve chamar atenção sem parecer agressivo.

---

## Reduced Motion

Continuar respeitando:

```text
prefers-reduced-motion: reduce
```

Nesse caso:

```text
pulse desativado
CTA permanece funcional
```

---

## Responsividade

O CTA deve se adaptar à largura real do player através das container queries existentes.

### Player estreito

Manter:

```text
12–16px de espaço lateral mínimo
```

O CTA:

- não pode ultrapassar o viewport;
- pode reduzir padding;
- pode quebrar o texto principal em duas linhas;
- deve manter ícone e título legíveis.

### Player maior

Não expandir desnecessariamente.

Utilizar largura baseada no conteúdo com limite máximo razoável.

Validar principalmente:

```text
9:16
```

e também:

```text
16:9
```

---

## Interação

Todo o CTA continua sendo clicável.

Clique deve reutilizar exclusivamente:

```text
startForegroundPlayback(...)
```

já existente.

O clique no overlay continua mantendo o comportamento atual.

Não duplicar lógica de playback.

---

## Overlay

Preservar o filtro escuro existente sobre o vídeo durante `background_autoplay`.

A hierarquia permanece:

```text
vídeo
↓
filtro escuro
↓
CTA
↓
pulse externo
```

Não aumentar excessivamente a opacidade do overlay apenas para compensar problemas de contraste do CTA.

---

## Não alterar

Não alterar:

```text
Playback Controller
Player Runtime
PlayerConfig
autoplay
Fake Progress Bar
controles
fullscreen
embed/CDN
eventos
analytics
```

Esta spec é exclusivamente visual.

---

## Critérios de aceite

- CTA não possui mais aparência de pill genérica;
- utiliza `Volume2` ou equivalente;
- apresenta `Seu vídeo já começou`;
- apresenta `Clique para ativar o som`;
- textos ficam organizados verticalmente;
- título é visualmente secundário;
- ação principal possui maior destaque;
- CTA continua usando accent color;
- pulse utiliza versão significativamente mais clara do accent;
- pulse permanece externo;
- pulse não deforma o CTA;
- reduced motion continua funcionando;
- CTA não ultrapassa containers estreitos;
- 9:16 funciona corretamente;
- 16:9 funciona corretamente;
- clique continua iniciando foreground playback;
- lógica de reprodução não é alterada;
- `pnpm typecheck` passa;
- `pnpm lint` passa;
- `pnpm build` passa.

Não implemente funcionalidades além das especificadas.