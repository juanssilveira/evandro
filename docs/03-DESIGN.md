# WatchMap — Design System

## Objetivo

Este documento define a linguagem visual padrão da interface do WatchMap.

Toda nova interface deve seguir estas regras, salvo quando uma spec definir explicitamente uma exceção.

O design deve transmitir:

* clareza;
* precisão;
* tecnologia;
* foco em dados;
* simplicidade;
* aparência profissional sem excesso visual.

O WatchMap é uma ferramenta de trabalho. A interface deve priorizar legibilidade e velocidade de uso.

---

# Direção visual

O produto deve possuir aparência:

* limpa;
* moderna;
* minimalista;
* densa o suficiente para dashboards;
* sem aparência genérica de template SaaS;
* sem excesso de gradients;
* sem glassmorphism;
* sem sombras pesadas;
* sem elementos decorativos sem função.

Referência conceitual:

```text
produto técnico
+
analytics
+
vídeo
+
interface operacional
```

---

# Tema

O tema principal inicial será claro.

Dark mode não faz parte da implementação inicial, mas os componentes devem evitar decisões que impossibilitem sua adição futuramente.

---

# Cores

Utilizar CSS variables e tokens semânticos.

Não espalhar cores hardcoded pelos componentes.

## Cor de marca

A cor principal do WatchMap é roxo.

```text
Primary        #7C3AED
Primary Hover  #6D28D9
Primary Soft   #F5F3FF
Primary Text   #FFFFFF
```

A cor deve ser representada através de tokens semânticos do design system e não aplicada diretamente de forma repetida nos componentes.

O roxo é utilizado principalmente para:

* ações primárias;
* links importantes;
* estado ativo;
* seleção;
* foco;
* indicadores relevantes;
* elementos de identidade do WatchMap.

Não utilizar o roxo indiscriminadamente em grandes áreas da interface.

A maior parte da aplicação deve permanecer neutra para que a cor de marca preserve hierarquia visual.

No sistema baseado em shadcn/ui, utilizar a cor de marca principalmente através de:

```text
--primary
--primary-foreground
--ring
```

O token semântico `--accent` do shadcn/ui não deve ser confundido obrigatoriamente com a cor de marca; ele pode continuar sendo utilizado para superfícies e estados secundários do sistema.

## Base

```text
background
surface
surface-muted
border
foreground
foreground-muted
```

## Marca

O WatchMap deve possuir uma cor de destaque única utilizada principalmente para:

* ações primárias;
* estado ativo;
* links importantes;
* indicadores selecionados;
* elementos de marca.

A cor exata poderá evoluir, mas deve ser centralizada em tokens.

## Estados

Utilizar tokens próprios para:

```text
success
warning
error
info
```

Não utilizar cor como única forma de comunicar estado.

---

# Tipografia

Utilizar:

```text
Geist Sans
```

como fonte principal da interface.

Para valores técnicos, IDs ou conteúdo monoespaçado quando necessário:

```text
Geist Mono
```

## Hierarquia

Evitar quantidade excessiva de tamanhos.

Utilizar uma escala consistente para:

```text
page title
section title
card title
body
secondary text
caption
```

Títulos devem ser fortes, mas não excessivamente grandes.

Interfaces internas não devem parecer landing pages.

---

# Espaçamento

Utilizar a escala padrão do Tailwind.

Preferir consistência a valores personalizados.

Layout deve possuir bastante clareza visual, mas evitar espaços exagerados que diminuam a densidade de informação.

---

# Radius

Utilizar radius moderado.

Padrão:

```text
rounded-lg
```

Cards, inputs e elementos relacionados devem compartilhar linguagem consistente.

Evitar elementos excessivamente arredondados sem necessidade.

---

# Bordas e sombras

Utilizar bordas sutis como principal mecanismo de separação.

Sombras devem ser discretas e utilizadas apenas quando ajudarem na hierarquia.

Preferir:

```text
border
```

a:

```text
shadow-xl
```

---

# Layout da aplicação

A aplicação autenticada deve seguir inicialmente:

```text
┌──────────────┬─────────────────────────────┐
│              │                             │
│   Sidebar    │        Main Content         │
│              │                             │
│              │                             │
└──────────────┴─────────────────────────────┘
```

## Sidebar

Responsável pela navegação principal.

Deve:

* permanecer simples;
* possuir hierarquia clara;
* destacar a rota atual;
* evitar excesso de itens;
* suportar evolução futura.

## Conteúdo

Cada página deve possuir uma área principal consistente.

Estrutura padrão:

```text
Page Header

Content
```

O header pode conter:

```text
título
descrição curta
ações da página
```

---

# Largura

Dashboards e páginas de gerenciamento podem utilizar a largura disponível da aplicação.

Evitar limitar todas as páginas a containers estreitos típicos de sites institucionais.

Conteúdo textual específico pode utilizar largura reduzida quando necessário.

---

# Cards

Cards devem representar agrupamentos reais de informação.

Padrão:

* background de superfície;
* border sutil;
* radius consistente;
* padding consistente;
* pouca ou nenhuma sombra.

Não transformar todo elemento da interface em card.

---

# Botões

Utilizar os componentes do shadcn/ui como base.

Hierarquia principal:

```text
Primary
Secondary
Ghost
Destructive
```

Cada tela deve possuir uma ação primária visualmente evidente quando existir uma ação principal.

Evitar múltiplos botões competindo pela atenção.

---

# Inputs

Inputs devem possuir:

* label explícita quando necessária;
* estado de foco claro;
* mensagem de erro próxima;
* disabled state evidente;
* tamanho consistente.

Placeholder não substitui label.

---

# Tabelas e listas

Dados operacionais devem favorecer leitura rápida.

Utilizar:

* alinhamento consistente;
* headers discretos;
* separação visual leve;
* ações secundárias pouco intrusivas;
* estados hover apenas quando tiverem função.

---

# Empty states

Toda listagem que possa estar vazia deve possuir estado vazio específico.

Estrutura preferida:

```text
ícone simples
título
explicação curta
ação principal, quando existir
```

Não utilizar ilustrações decorativas complexas por padrão.

---

# Loading

Preferir skeletons para conteúdo que possui estrutura previsível.

Evitar spinners em páginas inteiras quando skeleton puder representar melhor o conteúdo esperado.

---

# Feedback

Ações do usuário devem possuir feedback claro.

Exemplos:

```text
loading
success
error
disabled
```

Evitar ações aparentemente silenciosas.

---

# Ícones

Utilizar Lucide Icons.

Regras:

* mesmo estilo visual;
* tamanhos consistentes;
* ícones devem complementar texto;
* não usar ícones apenas como decoração.

---

# Responsividade

Desktop é a principal superfície operacional do WatchMap, mas todas as interfaces devem continuar funcionais em telas menores.

Evitar layouts que dependam de largura fixa.

Componentes devem degradar de forma previsível em mobile.

---

# Motion

Animações devem possuir função.

Utilizar apenas para:

* transições;
* feedback;
* abertura e fechamento;
* mudanças de estado.

Evitar animações decorativas ou demoradas.

---

# Componentização

Antes de criar um componente visual novo:

1. verificar se shadcn/ui já oferece uma base adequada;
2. verificar se já existe componente equivalente no projeto;
3. adaptar antes de duplicar.

Componentes recorrentes devem ser reutilizáveis.

---

# Regra principal

Consistência é mais importante que criatividade isolada.

Uma nova tela deve parecer parte do mesmo produto sem depender de instruções adicionais no prompt.