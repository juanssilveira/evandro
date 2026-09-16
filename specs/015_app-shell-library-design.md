# Spec 015 — App Shell & Video Library Design

## Objetivo

Refinar a estrutura visual principal do WatchMap e a página `/videos`.

O objetivo é fazer a aplicação parecer mais coesa e profissional sem adicionar complexidade desnecessária.

Este milestone deve melhorar:

- header principal;
- largura e organização da área de conteúdo;
- page header da biblioteca;
- empty state;
- apresentação da biblioteca quando houver vídeos;
- responsividade.

Não alterar funcionalidades existentes.

## Header

Manter header horizontal.

Estrutura conceitual:

```text
┌─────────────────────────────────────────────────────────────────┐
│ WatchMap       Vídeos                         Usuário ▾          │
└─────────────────────────────────────────────────────────────────┘
```

O conteúdo do header deve utilizar o mesmo alinhamento horizontal e largura máxima da área principal da aplicação.

### Esquerda

Exibir:

- logo/ícone atual do WatchMap;
- nome `WatchMap`;
- navegação principal.

Adicionar inicialmente:

```text
Vídeos
```

como item de navegação ativo em `/videos` e páginas relacionadas a vídeo.

Não criar sidebar neste milestone.

### Direita

Substituir:

```text
email + botão Sair
```

por um menu compacto de usuário.

Trigger conceitual:

```text
[avatar/iniciais] Nome do usuário ▾
```

Menu:

```text
Nome do usuário
email

──────────

Sair
```

O logout existente deve continuar sendo reutilizado.

Não implementar página de perfil ou configurações de conta.

## Aparência do header

Utilizar:

- aproximadamente 64px de altura;
- background `surface`;
- border inferior sutil;
- sem sombra pesada;
- espaçamento consistente;
- navegação ativa claramente identificável;
- comportamento responsivo.

O header deve parecer parte da aplicação, não uma barra independente colada às bordas da viewport.

## Container principal

Aumentar a largura da área principal.

Utilizar aproximadamente:

```css
max-width: 1240px;
```

com:

```text
width: 100%
padding horizontal responsivo
margin auto
```

O conteúdo não deve continuar excessivamente estreito em telas desktop grandes.

## Page Header

Reestruturar o topo de `/videos`.

Desktop:

```text
Vídeos                                      [Enviar vídeo]
Gerencie e configure seus vídeos.
```

O botão `Enviar vídeo` é a ação Primary principal da página.

Remover a exibição:

```text
Conta: {account.name}
```

do Page Header.

A identidade do usuário/conta não precisa competir com a função principal da página.

## Empty State

Redesenhar o estado vazio para ser mais compacto e intencional.

Estrutura:

```text
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│                       [video icon]                           │
│                                                              │
│                    Nenhum vídeo ainda                        │
│                                                              │
│     Envie seu primeiro vídeo para começar a configurar       │
│           o player e acompanhar seus dados.                  │
│                                                              │
│                      [Enviar vídeo]                           │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

Visual:

- surface branca;
- border sutil;
- radius consistente;
- altura menor que o empty state atual;
- ícone Lucide apropriado;
- ícone dentro de uma surface `primary-soft`;
- texto centralizado;
- espaçamento confortável sem ocupar área excessiva da viewport.

O botão central pode repetir a ação `Enviar vídeo` enquanto a biblioteca estiver vazia.

Essa repetição contextual é permitida no empty state.

## Biblioteca com vídeos

Quando houver vídeos, utilizar apresentação operacional e compacta.

Preferir lista/cards horizontais em vez de cards grandes em grid.

Estrutura conceitual:

```text
┌─────────────────────────────────────────────────────────────┐
│ [preview/icon]  Título do vídeo                         ⋯   │
│                 arquivo.mp4                                 │
│                 35 MB • 16/09/2026                         │
└─────────────────────────────────────────────────────────────┘
```

Cada item deve priorizar:

- título;
- nome original;
- tamanho;
- data;
- menu contextual existente.

Não utilizar botão Primary dentro de cada item.

A ação principal continua sendo `Enviar vídeo` no Page Header.

## Hierarquia visual

Utilizar o design system existente.

A página deve possuir hierarquia clara:

```text
App Header
    ↓
Page Header
    ↓
Library Content
```

Evitar:

- excesso de linhas divisórias;
- sombras grandes;
- cards dentro de cards sem necessidade;
- grandes áreas vazias;
- informações repetidas.

## Background e superfícies

Preservar a direção visual definida em `docs/DESIGN.md`.

Estrutura esperada:

```text
App background      → neutro
Header              → surface branca
Cards / Empty State → surface branca
```

A diferença entre superfícies deve vir principalmente de:

- background;
- border;
- spacing;
- radius;
- sombra mínima.

## Responsividade

### Desktop

- container amplo;
- Page Header em linha;
- navegação e user menu completos.

### Tablet

- reduzir gaps e padding;
- preservar estrutura sempre que houver espaço.

### Mobile

Page Header:

```text
Vídeos
Descrição

[Enviar vídeo]
```

O header deve adaptar navegação e menu sem overflow.

A biblioteca deve ocupar toda a largura disponível.

## Reutilização

Se necessário, criar ou refatorar componentes compartilhados como:

```text
AppHeader
PageHeader
UserMenu
EmptyState
VideoListItem
```

Evitar implementar o mesmo padrão visual diretamente em múltiplas páginas.

Não criar abstrações desnecessárias caso um componente seja usado apenas uma vez.

## Preservação funcional

Não alterar:

- autenticação;
- Account;
- upload;
- edição;
- exclusão;
- Cloudflare R2;
- PlayerConfig;
- WatchMap Player;
- Runtime;
- Web Component.

Todas as funcionalidades existentes da biblioteca devem continuar funcionando.

## Critérios de aceite

- header utiliza o mesmo alinhamento da aplicação;
- navegação `Vídeos` existe e possui estado ativo;
- email solto + botão Sair foram substituídos por user menu;
- logout continua funcionando;
- container principal está perceptivelmente mais amplo;
- `/videos` possui Page Header estruturado;
- `Conta: ...` foi removido do Page Header;
- `Enviar vídeo` é a ação Primary principal;
- empty state está mais compacto e refinado;
- biblioteca com vídeos utiliza apresentação consistente e operacional;
- menu de edição/exclusão continua funcionando;
- desktop e mobile permanecem funcionais;
- nenhuma regra de negócio foi alterada;
- checks obrigatórios passam.

Não implemente funcionalidades além das especificadas.