# Spec 012 — Video Settings Layout

## Objetivo

Reestruturar a página individual do vídeo para funcionar como um ambiente de edição e preview do WatchMap Player.

A página deve possuir:

- área maior de trabalho;
- duas colunas no desktop;
- preview + código de embed na coluna esquerda;
- configurações na coluna direita;
- coluna de preview fixa durante o scroll;
- canvas de preview com dimensões estáveis;
- player interno adaptando seu aspect ratio sem alterar o tamanho do canvas.

Esta spec altera somente layout e apresentação da página.

## Container principal

Aumentar a largura máxima da área de conteúdo da página.

Utilizar aproximadamente:

```css
max-width: 1440px;
```

com largura fluida e padding responsivo.

A página não deve ficar excessivamente estreita em telas desktop grandes.

## Estrutura desktop

Organizar o conteúdo em duas colunas:

```text
┌──────────────────────────────────────────────────────────────┐
│ Header do vídeo                                              │
├───────────────────────────────┬──────────────────────────────┤
│                               │                              │
│       PREVIEW CANVAS          │       CONFIGURAÇÕES          │
│                               │                              │
│                               │       Aparência              │
│                               │       Reprodução             │
│                               │       Controles              │
│                               │       Progresso              │
│                               │       Desenvolvimento        │
│                               │                              │
├───────────────────────────────┤                              │
│ Código de embed               │                              │
│                               │                              │
└───────────────────────────────┴──────────────────────────────┘
```

A coluna esquerda deve possuir mais espaço visual que a coluna de configurações.

Sugestão estrutural:

```css
grid-template-columns: minmax(0, 1fr) minmax(380px, 460px);
```

A implementação pode ajustar os valores se necessário para melhor equilíbrio visual.

## Coluna esquerda

A coluna esquerda contém:

1. Preview Canvas;
2. Código de embed.

Ela deve permanecer visível durante o scroll das configurações.

Utilizar comportamento sticky:

```css
position: sticky;
top: <offset adequado ao header>;
align-self: start;
```

O sticky deve funcionar apenas quando houver espaço vertical suficiente e não deve quebrar layouts menores.

## Preview Canvas

Criar um container visual estável que represente a área de preview.

O canvas NÃO deve alterar suas dimensões quando o usuário alternar entre:

```text
16:9
9:16
```

O canvas deve funcionar como uma área neutra onde o player é apresentado.

Exemplo conceitual:

```text
CANVAS FIXO

┌─────────────────────────────────────┐
│                                     │
│     ┌─────────────────────────┐     │
│     │      PLAYER 16:9        │     │
│     └─────────────────────────┘     │
│                                     │
└─────────────────────────────────────┘
```

Ao trocar para vertical:

```text
CANVAS CONTINUA IGUAL

┌─────────────────────────────────────┐
│              ┌───────┐              │
│              │       │              │
│              │ 9:16  │              │
│              │       │              │
│              └───────┘              │
└─────────────────────────────────────┘
```

O objetivo é impedir que toda a página pule ou mude drasticamente de tamanho ao trocar o aspect ratio.

## Comportamento do player dentro do canvas

O player interno deve:

- respeitar o `appearance.aspectRatio`;
- manter a proporção correta;
- ficar centralizado horizontal e verticalmente;
- usar o máximo de espaço disponível sem ultrapassar o canvas;
- nunca distorcer o vídeo.

O preview deve utilizar comportamento equivalente a `contain`.

A lógica deve considerar simultaneamente:

```text
largura disponível
altura disponível
aspect ratio
```

para determinar o maior player possível dentro do canvas.

Não utilizar apenas `width: 100%`, pois isso faria o player 9:16 ultrapassar verticalmente o canvas.

## Importante: Preview ≠ Embed

O tamanho do player exibido dentro do canvas é apenas uma representação visual dentro do dashboard.

Ele NÃO altera os tamanhos padrão definidos para o embed:

```text
16:9 → aproximadamente 680px de largura padrão
9:16 → aproximadamente 480px de largura padrão
```

O Web Component continua responsivo e controlável pelo container externo conforme definido na Spec 011.

A lógica do Preview Canvas não deve contaminar o comportamento do embed real.

## Canvas visual

O canvas deve possuir aparência claramente distinta da página:

- surface neutra;
- border;
- radius;
- área interna limpa;
- player centralizado.

Evitar que pareça apenas “um player solto na página”.

Pode utilizar fundo levemente diferente para reforçar a ideia de área de preview.

## Código de embed

Logo abaixo do Preview Canvas, adicionar/manter uma seção:

```text
Código de embed
```

Exibir o snippet atual do Web Component.

A seção deve permitir copiar o código através de uma ação clara.

A ação de copiar deve utilizar hierarquia visual Secondary ou Ghost, não Primary.

Não alterar o formato funcional do embed nesta spec.

## Coluna direita

Mover todas as categorias de configuração do player para a coluna direita.

Exemplos atuais/futuros:

```text
Aparência
Reprodução
Controles e interação
Progresso
Desenvolvimento
```

As categorias continuam separadas conforme o design system.

A coluna direita é a área que naturalmente cresce verticalmente conforme novas configurações forem adicionadas.

## Header

Manter acima das duas colunas:

- voltar para biblioteca;
- título do vídeo;
- informações essenciais da conta quando necessário.

Evitar ocupar espaço horizontal excessivo.

## Responsividade

### Desktop

Duas colunas.

Preview sticky.

### Tablet / largura insuficiente

Reduzir os tamanhos progressivamente.

Quando duas colunas deixarem de ser confortáveis, migrar para coluna única.

### Mobile

Ordem:

```text
Header
Preview Canvas
Código de embed
Configurações
```

Desabilitar comportamento sticky.

O canvas deve ocupar a largura disponível.

## Player Runtime

Não alterar comportamento do Runtime.

A mudança de layout não pode afetar:

- eventos;
- fullscreen;
- debug;
- playback;
- PlayerConfig;
- Web Component.

## Critérios de aceite

- área principal da página está perceptivelmente mais larga;
- desktop utiliza duas colunas;
- player e embed ficam na coluna esquerda;
- configurações ficam na coluna direita;
- coluna esquerda permanece sticky durante scroll;
- Preview Canvas mantém tamanho estável ao alternar 16:9 e 9:16;
- apenas o player interno muda de proporção;
- player fica centralizado e completamente visível dentro do canvas;
- trocar aspect ratio não causa salto significativo no layout;
- comportamento do embed real permanece inalterado;
- código de embed continua copiável;
- layout degrada corretamente para uma coluna em telas menores;
- Runtime e funcionalidades existentes permanecem intactos;
- checks obrigatórios passam.

Não implemente funcionalidades além das especificadas.