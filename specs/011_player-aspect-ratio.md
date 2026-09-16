# Spec 011 — Player Aspect Ratio

## Objetivo

Permitir configurar o formato visual do WatchMap Player entre:

- Horizontal — 16:9
- Vertical — 9:16

O player deve adaptar seu container ao aspect ratio escolhido sem utilizar dimensões rígidas que prejudiquem o embed responsivo.

## PlayerConfig

Adicionar em:

```ts
appearance: {
  accentColor: PlayerAccentColor
  aspectRatio: PlayerAspectRatio
}
```

Tipo:

```ts
type PlayerAspectRatio =
  | "16:9"
  | "9:16"
```

Default:

```ts
appearance: {
  aspectRatio: "16:9"
}
```

Configs antigas devem continuar válidas através dos defaults existentes.

## Comportamento de layout

O aspect ratio deve controlar a proporção do container principal do player.

### Horizontal — 16:9

Proporção:

```text
16 / 9
```

Largura visual padrão:

```text
680px
```

### Vertical — 9:16

Proporção:

```text
9 / 16
```

Largura visual padrão:

```text
480px
```

A altura nunca deve ser definida manualmente.

Ela deve ser derivada automaticamente através de `aspect-ratio`.

Exemplo conceitual:

```css
aspect-ratio: 16 / 9;
```

ou:

```css
aspect-ratio: 9 / 16;
```

## Responsividade

Os valores de 680px e 480px representam apenas o tamanho padrão inicial do player.

Eles NÃO devem funcionar como dimensões rígidas permanentes.

O player precisa poder:

- diminuir quando o container pai for menor;
- aumentar quando o integrador definir uma largura maior;
- ocupar corretamente uma div responsiva;
- nunca ultrapassar a largura disponível do container pai;
- preservar sempre o aspect ratio escolhido.

Exemplo esperado:

```html
<div style="width: 420px">
  <watchmap-player ... />
</div>
```

O player horizontal deve se ajustar para aproximadamente:

```text
420 x 236
```

mantendo 16:9.

Se o integrador utilizar:

```html
<div style="width: 1000px">
  <watchmap-player ... />
</div>
```

e explicitamente permitir/definir que o Web Component utilize essa largura, o player deve poder crescer além dos 680px padrão mantendo 16:9.

Portanto:

```text
680px / 480px = preferência inicial
aspect-ratio = regra estrutural
container pai = limite real disponível
```

Não utilizar `width` e `height` fixos em conjunto.

## Web Component

O Web Component deve possuir comportamento responsivo por padrão.

O elemento host deve:

- funcionar como bloco;
- respeitar a largura disponível;
- preservar o aspect ratio;
- permitir que CSS externo controle sua largura;
- nunca depender da largura da viewport diretamente.

A página hospedeira deve conseguir fazer:

```css
watchmap-player {
  width: 100%;
}
```

ou:

```css
watchmap-player {
  width: 900px;
}
```

sem quebrar a proporção interna.

Estilos externos podem controlar o tamanho do elemento host, mas não devem conseguir quebrar os estilos internos do player no Shadow DOM.

## Dashboard Preview

O preview dentro do WatchMap deve utilizar o mesmo comportamento estrutural do embed.

Ao selecionar:

```text
Horizontal
```

o preview assume 16:9.

Ao selecionar:

```text
Vertical
```

o preview assume 9:16.

A mudança deve ser percebida imediatamente, sem reload manual.

## Vídeo

O `HTMLVideoElement` deve preencher o container mantendo o conteúdo visível.

Utilizar comportamento equivalente a:

```css
width: 100%;
height: 100%;
object-fit: contain;
```

Não cortar o vídeo apenas para preencher o aspect ratio selecionado.

O aspect ratio é configuração do container do player, não transformação do arquivo original.

## Interface de configuração

Dentro da categoria:

```text
Aparência
```

adicionar:

```text
Formato do player
```

Não utilizar um select HTML tradicional.

Criar um seletor visual com duas opções.

### Horizontal

Mostrar uma ilustração simples representando um retângulo 16:9.

```text
┌───────────────┐
│               │
│      ▶        │
│               │
└───────────────┘

Horizontal
16:9
```

### Vertical

Mostrar uma ilustração simples representando um retângulo 9:16.

```text
┌───────┐
│       │
│       │
│   ▶   │
│       │
│       │
└───────┘

Vertical
9:16
```

As ilustrações devem ser construídas com CSS/componentes simples.

Não utilizar imagens ou assets externos.

## Estado selecionado

A opção selecionada deve possuir:

- border utilizando o accent do WatchMap;
- fundo primary-soft discreto;
- indicador visual de seleção;
- contraste claro em relação à opção não selecionada.

As opções devem ser clicáveis como um único controle.

O comportamento deve ser acessível via teclado.

## Persistência

A seleção deve utilizar a infraestrutura existente de PlayerConfig.

Fluxo:

```text
selecionar formato
      ↓
persistir config
      ↓
atualizar preview
      ↓
embed passa a utilizar o novo formato
```

Não criar nova coluna específica no banco.

## Runtime

Aspect ratio é exclusivamente apresentação.

Não alterar:

- Player Runtime;
- eventos;
- currentTime;
- playback;
- tracking;
- Evandro.

## Critérios de aceite

- `appearance.aspectRatio` existe no PlayerConfig;
- default é `16:9`;
- usuário pode escolher Horizontal 16:9;
- usuário pode escolher Vertical 9:16;
- seletor utiliza ilustrações simples das proporções;
- preview responde imediatamente;
- horizontal possui largura inicial aproximada de 680px;
- vertical possui largura inicial aproximada de 480px;
- altura deriva do aspect ratio;
- player diminui corretamente em containers menores;
- player pode aumentar quando sua largura é definida externamente;
- embed respeita o tamanho do container pai;
- Shadow DOM continua isolado;
- vídeo utiliza `object-fit: contain`;
- dashboard e Web Component utilizam a mesma configuração;
- Runtime permanece inalterado;
- checks obrigatórios passam.

Não implemente customizações além das especificadas.