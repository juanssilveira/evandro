# Evandro Watch — Design System

## Objetivo

Este documento é a referência prescritiva para qualquer agente ou desenvolvedor construindo interfaces no Evandro Watch.

Toda nova interface deve seguir rigorosamente estas regras para garantir consistência visual, hierarquia de ações e sensação de produto técnico refinado.

O design deve transmitir:

* clareza;
* precisão;
* tecnologia;
* foco em dados;
* fisicalidade e profundidade discreta;
* consistência operacional.

O Evandro Watch é uma ferramenta de trabalho. A interface prioriza legibilidade, densidade adequada e velocidade operacional.

---

# Direção visual

A linguagem visual do Evandro Watch combina estética operacional moderna com superfícies limpas, bordas nítidas e sutis toques de profundidade física.

Referência conceitual:

```text
interface técnica operacional
+
análise e controle de vídeo
+
superfícies limpas e físicas
+
hierarquia precisa de ações
```

### Características obrigatórias:
* superfícies limpas com fundo levemente contrastante;
* separação entre fundo e cards baseada em background e bordas bem definidas;
* sombras discretas e pequenos efeitos táteis de profundidade;
* gradientes usados com moderação (principalmente em botões primários);
* roxo de marca como cor primária e destaque pontual;
* evitar aparência genérica de template SaaS.

### O que evitar estritamente:
* glassmorphism / efeitos de vidro excessivos;
* neon ou brilhos espalhados;
* gradientes pesados em grandes áreas ou cards;
* sombras pesadas ou difusas sem função de elevação real;
* elementos puramente decorativos que não tenham função operacional;
* excesso de roxo espalhado pela tela;
* componentes visualmente inconsistentes ou com alturas arbitrárias.

---

# Tema e superfícies

O tema principal é claro, estruturado sobre uma hierarquia de neutros que evita o branco puro no fundo da aplicação.

## Hierarquia de superfícies

```text
App Background     #F7F7F8   (neutro de fundo da aplicação)
Surface            #FFFFFF   (cards, modais, inputs, tabelas)
Surface Muted      #F4F4F5   (áreas secundárias, headers de tabela, tags)
Border             #E4E4E7   (bordas neutras bem definidas)
Border Subtle      #F0F0F2   (divisores internos secundários)
Foreground         #09090B   (texto principal, títulos, ícones de destaque)
Foreground Muted   #71717A   (descrições, legendas, placeholders)
```

## Regras de superfícies:
* **Fundo da aplicação**: utilizar `#F7F7F8` para garantir que cards e superfícies brancas (`#FFFFFF`) se destaquem com naturalidade.
* **Cards e containers**: percebidos pela combinação de `bg-white`, `border border-border`, `rounded-lg` e sombra muito sutil (`shadow-xs` / `shadow-sm`).
* Nunca depender de sombras fortes ou escuras para separar elementos.

---

# Cores e tokens de marca

Utilizar tokens semânticos baseados em CSS variables. Não espalhar valores hexadecimais hardcoded nos componentes.

## Cor de marca (Evandro Purple)

```text
Primary              #7C3AED   (roxo principal da marca)
Primary Hover        #6D28D9   (hover de ações primárias)
Primary Pressed      #5B21B6   (estado ativo/pressionado)
Primary Light        #8B5CF6   (highlight superior e gradiente sutil)
Primary Soft         #F5F3FF   (fundos de destaque, badges selecionados)
Primary Foreground   #FFFFFF   (texto sobre fundo primário)
```

O roxo é utilizado com critério para:
* ações primárias (`Primary Button`);
* estado ativo de toggles e seleções;
* indicadores relevantes e badges ativos;
* anel de foco (`ring-primary`).

A maior parte da interface deve permanecer neutra para preservar a hierarquia visual.

## Tokens de estado

```text
Success   #10B981   (sucesso, conclusões, ativo)
Warning   #F59E0B   (alertas, processamento, atenção)
Error     #EF4444   (erros, falhas, campos inválidos)
Destctive #DC2626   (ações destrutivas e irreversíveis)
Info      #3B82F6   (informações auxiliares)
```

Nunca utilizar cor como a única forma de comunicar um estado.

---

# Botões

O sistema possui quatro variantes oficiais de botão, além da variante destrutiva:

1. **Primary**
2. **Secondary**
3. **Ghost**
4. **Link**
5. *(Destructive)*

Nenhuma interface deve criar botões com estilos visuais arbitrários fora dessas variantes.

---

## 1. Primary Button

Ação principal da tela, fluxo ou modal.

### Uso:
* ação principal do Page Header (ex: `[Enviar vídeo]`);
* confirmação principal de modal ou dialog;
* submit principal de formulário.

### Visual e profundidade física:
* fundo roxo com gradiente vertical discreto;
* borda externa/inferior levemente mais escura para ancoragem;
* highlight interno superior muito sutil (`inset 0 1px 0 rgba(255, 255, 255, 0.2)`);
* texto branco em peso médio/semibold;
* pequena sensação tátil de profundidade física.

### Estados:
* **Default**: gradiente vertical `linear-gradient(180deg, #8B5CF6 0%, #7C3AED 100%)`, borda `1px solid #6D28D9`, leve sombra inferior (`0 1px 2px rgba(0,0,0,0.08), 0 2px 0 #6D28D9`).
* **Hover**: levemente mais claro, sem exagero na elevação.
* **Active (Pressed)**: botão parece pressionado fisicamente, reduzindo a sombra inferior e aplicando pequeno `translate-y-[1px]`.
* **Focus**: `ring-2 ring-primary/40 ring-offset-2`.
* **Disabled**: contraste reduzido, sem sombra 3D, cursor não permitido.

### Regra de hierarquia:
* **No máximo UM botão Primary por página ou contexto principal**.
* Nunca posicionar dois botões Primary lado a lado para ações concorrentes.
* Se existem duas ações: a ação principal é **Primary**, a alternativa é **Secondary**.

---

## 2. Secondary Button

Ação alternativa, secundária ou auxiliar.

### Uso:
* cancelar em modais (quando não destrutivo);
* voltar ou fechar;
* ações secundárias da página (ex: `[Filtros]`, `[Exportar]`);
* botões de configuração auxiliar.

### Visual:
* surface branca (`bg-white`);
* borda neutra bem definida (`border border-zinc-200 dark:border-zinc-800`);
* texto em `foreground` padrão;
* sensação física com sombra muito discreta (`shadow-xs` ou borda inferior sutilmente mais marcada).

### Estados:
* **Hover**: `bg-zinc-50` / `border-zinc-300`.
* **Active**: pequena sensação de pressão (`translate-y-[0.5px]`).
* **Disabled**: opacidade moderada e fundo desativado.

---

## 3. Ghost Button

Ações de baixa prioridade ou integradas a barras de ferramentas.

### Uso:
* botões dentro de toolbars ou controles de mídia;
* ações icon-only em listas e tabelas (ex: três pontos, editar item);
* navegação discreta e menus de cabeçalho.

### Visual:
* fundo transparente e sem borda visível por padrão;
* texto/ícone em `foreground` ou `foreground-muted`.

### Estados:
* **Hover**: `bg-zinc-100` (`bg-muted/80`).
* **Active**: `bg-zinc-200/80`.
* Nunca utilizar Ghost para a ação principal de um formulário ou tela.

---

## 4. Link Button

Ações textuais ou links sem container de botão.

### Uso:
* navegação textual ("Voltar para vídeos", "Ver documentação");
* ações terciárias ("Esqueci minha senha");
* links contextuais.

### Visual:
* sem container ou padding de botão;
* texto com peso médio e sublinhado no hover.

---

## 5. Destructive Button

Ações com impacto destrutivo ou irreversível.

### Uso:
* excluir vídeo;
* revogar credencial;
* apagar conta;
* cancelar permanentemente.

### Regras:
* Ações destrutivas **nunca** utilizam o roxo Primary.
* Em diálogos de confirmação destrutiva:
  * Ação de exclusão: **Destructive** (vermelho).
  * Ação de cancelar: **Secondary** ou **Ghost**.

---

# Tamanhos de botões

Todos os botões devem utilizar alturas e paddings padronizados:

| Tamanho | Altura | Padding X | Tipografia | Tamanho do Ícone |
| :--- | :--- | :--- | :--- | :--- |
| **sm** | `h-8` (32px) | `px-3` | `text-xs font-medium` | `size-3.5` |
| **default** | `h-9` (36px) | `px-4` | `text-sm font-medium` | `size-4` |
| **lg** | `h-10` (40px) | `px-5` | `text-sm font-semibold` | `size-4.5` |
| **icon** | `h-9 w-9` (quadrado) | `p-0` | — | `size-4` |

Botões da mesma área operacional devem compartilhar a mesma altura.

---

# Inputs e formulários

## Estrutura padrão de campo

Todo campo de formulário deve seguir a ordem vertical:

```text
1. Label (obrigatória quando exige identificação)
2. Input / Select / Textarea
3. Helper text ou Mensagem de Erro
```

* Placeholder **nunca** substitui a Label.
* A mensagem de erro deve aparecer imediatamente abaixo do campo correspondente sem causar quebras bruscas de layout.

## Visual dos inputs:
* surface branca (`bg-white`);
* borda neutra nítida (`border border-zinc-200`);
* altura consistente (`h-9` como padrão, igual aos botões);
* raio `rounded-md` ou `rounded-lg`;
* tipografia clara com `text-sm`.

## Estados dos inputs:
* **Default**: `bg-white border-zinc-200 text-zinc-900 placeholder:text-zinc-400`.
* **Hover**: `border-zinc-300`.
* **Focus**: `border-primary ring-2 ring-primary/20 outline-none`.
* **Disabled**: `bg-zinc-100 border-zinc-200 text-zinc-400 cursor-not-allowed`.
* **Error**: `border-destructive ring-2 ring-destructive/20 text-foreground`.

## Inputs com ícones:
* Ícones de busca, prefixos ou visibilidade de senha devem ter tamanho proporcional (`size-4`).
* Ações clicáveis dentro do input (ex: toggle de senha) devem ter área de clique confortável (`size-7` a `size-8`).

## Formulários:
* alinhamento vertical previsível;
* espaçamento consistente entre campos (`space-y-4` ou `gap-4`);
* botão de submit deve exibir spinner e feedback de loading (`isPending`), prevenindo cliques duplicados;
* **Footer de formulário**: `[Cancelar (Secondary/Ghost)]` `[Salvar/Confirmar (Primary)]`.

---

# Switch e Toggles

O switch representa uma configuração binária ou estado operacional.

### Regras:
* deve possuir `Label` clara e clicável;
* deve possuir descrição concisa sempre que o efeito não for autoexplicativo;
* estado ativo sempre utiliza a cor de marca (`bg-primary`);
* focus visível e acessível;
* quando duas opções forem mutuamente exclusivas, a ativação de uma deve desativar explicitamente a outra;
* opções dependentes devem ser desabilitadas ou exibidas em subseções com clara hierarquia.

---

# Cards e agrupamentos

Cards representam unidades de informação ou configuração coesas.

### Visual:
* `bg-white`;
* borda sutil `border border-border`;
* raio `rounded-lg`;
* sombra mínima `shadow-xs`;
* padding interno consistente (`p-4` a `p-6`).

### Regras:
* Não transformar cada linha avulsa em um card separado.
* Cards não devem ter cores chamativas ou competir visualmente com os botões primários.

---

# Hierarquia de ações e Layout

Toda tela deve possuir uma ordem hierárquica clara e inequívoca:

```text
Hierarquia:
1. Primary Action    (no máximo 1 por contexto)
2. Secondary Action  (alternativas, filtros, configurações)
3. Ghost / Icon      (ações por linha, toolbars)
4. Link              (ações terciárias, navegação textual)
```

## Page Header padrão:

```text
┌──────────────────────────────────────────────────────────┐
│ Título da Página                       [ Primary Action ]│
│ Descrição curta opcional                                 │
└──────────────────────────────────────────────────────────┘
```

Exemplo:
```text
Vídeos                                       [ Enviar vídeo ]
Gerencie sua biblioteca de vídeos e configurações.
```

## Modais e Diálogos:

```text
Fluxo padrão:      [ Cancelar (Secondary) ] [ Confirmar (Primary) ]
Fluxo destrutivo:  [ Cancelar (Secondary) ] [ Excluir (Destructive) ]
```

Nunca usar dois botões Primary no rodapé de um modal.

## Tabelas e Listagens:
* Ações em linhas de tabela devem ser discretas: botões **Ghost**, botões de **ícone** ou **Dropdown Menu**.
* Nunca repetir múltiplos botões Primary em cada linha de uma tabela.

---

# Profundidade visual física

A profundidade no Evandro Watch é **técnica, física e moderada**.

### Onde aplicar profundidade:
* **Primary Buttons**: gradiente vertical suave + borda inferior escura + highlight superior.
* **Secondary Buttons principais**: leve sensação de tecla física.
* **Modais e Popovers**: elevação nítida com `shadow-xl` e borda sutil.
* **Badges e Switches ativos**: preenchimento contrastante limpo.

### Onde NÃO aplicar profundidade:
* Em todos os cards de forma repetitiva;
* Em todos os inputs e labels;
* Em fundos de páginas inteiras.

A profundidade existe para comunicar interatividade e hierarquia, não como adorno.

---

# Tipografia

* **Fonte Principal**: `Geist Sans`
* **Fonte Monoespaçada**: `Geist Mono` (para valores técnicos, IDs, código, estatísticas numéricas quando apropriado).

### Escala tipográfica:
* **Page Title**: `text-xl font-bold tracking-tight text-foreground`
* **Section Title**: `text-base font-semibold text-foreground`
* **Card Title**: `text-sm sm:text-base font-semibold text-foreground`
* **Body / Label**: `text-sm font-medium text-foreground`
* **Secondary / Description**: `text-xs text-muted-foreground`
* **Caption / Badges**: `text-[10px] ou text-[11px] font-medium tracking-wide`

---

# Consistência e disciplina

Antes de criar qualquer elemento visual novo:
1. Verifique se o `shadcn/ui` já disponibiliza o componente base correspondente.
2. Verifique se uma variante existente (`Primary`, `Secondary`, `Ghost`, `Link`) atende ao caso.
3. Utilize sempre os tokens semânticos (`primary`, `border`, `muted`, `foreground`, etc.).

A interface deve parecer parte da mesma peça de engenharia, independentemente de quem a implementou.