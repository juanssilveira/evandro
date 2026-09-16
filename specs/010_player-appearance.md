# Spec 010 — Player Appearance

## Objetivo

Adicionar a primeira customização visual do WatchMap Player: seleção da cor de destaque.

O usuário deve escolher entre um conjunto fechado de cores pré-definidas.

Não oferecer seleção de cor customizada neste milestone.

## PlayerConfig

Adicionar a categoria:

```ts
appearance: {
  accentColor: PlayerAccentColor
}
```

Tipos permitidos:

```ts
type PlayerAccentColor =
  | "purple"
  | "blue"
  | "emerald"
  | "orange"
  | "rose"
```

Default:

```ts
appearance: {
  accentColor: "purple"
}
```

Configs já existentes que ainda não possuem `appearance` devem continuar funcionando utilizando os defaults.

## Presets

Definir os presets centralmente.

### Purple

```text
#7C3AED
```

### Blue

```text
#2563EB
```

### Emerald

```text
#059669
```

### Orange

```text
#EA580C
```

### Rose

```text
#E11D48
```

Cada preset deve possuir os tokens necessários para estados como:

- base;
- hover;
- active;
- soft;
- foreground.

Não espalhar valores hex diretamente pelos componentes do player.

## Aplicação visual

A cor selecionada deve controlar os elementos de destaque do player, incluindo quando aplicável:

- progresso assistido da timeline;
- thumb da timeline;
- volume;
- estados ativos;
- focus ring;
- controles selecionados;
- indicadores de interação.

Não alterar:

- fundo principal preto do player;
- textos que dependem de contraste neutro;
- estados destrutivos;
- elementos que não representam accent.

## Implementação

O `WatchMapPlayer` deve receber a configuração já validada através do `PlayerConfig`.

Converter o preset selecionado em tokens/CSS variables no root do player.

Exemplo conceitual:

```css
--player-accent
--player-accent-hover
--player-accent-active
--player-accent-soft
--player-accent-foreground
```

Os componentes internos devem consumir esses tokens.

Isso deve funcionar igualmente:

```text
Dashboard Preview
e
Web Component Embed
```

O Shadow DOM do embed deve receber os mesmos tokens e manter o mesmo resultado visual.

## Interface de configuração

Adicionar a categoria:

```text
Aparência
```

Configuração:

```text
Cor de destaque
```

Apresentar os presets visualmente através de swatches selecionáveis.

Cada opção deve mostrar:

- amostra da cor;
- nome;
- estado selecionado claro.

Não utilizar color picker.

Não permitir:

- HEX;
- RGB;
- HSL;
- input manual;
- cor customizada.

A mudança deve persistir utilizando a infraestrutura existente de `PlayerConfig`.

## Atualização do preview

Ao alterar a cor, o preview do player na página do vídeo deve refletir a nova configuração sem exigir reload manual.

## Runtime

A customização é exclusivamente visual.

Não alterar:

- Player Runtime;
- eventos;
- tracking;
- currentTime;
- comportamento de reprodução;
- métricas.

## Critérios de aceite

- categoria `appearance` existe no PlayerConfig;
- configs antigas continuam válidas através dos defaults;
- existem cinco presets;
- Purple é o default;
- usuário consegue selecionar e persistir um preset;
- preview atualiza corretamente;
- player utiliza a cor nos elementos de destaque;
- Dashboard Player e Web Component possuem o mesmo resultado;
- nenhuma cor customizada pode ser informada;
- Runtime permanece inalterado;
- checks obrigatórios passam.

Não implemente customizações visuais além das especificadas.