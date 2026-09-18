# 039 — Video Settings Tabs Navigation

## Objetivo

Melhorar a hierarquia da página de configuração do vídeo e reduzir o crescimento vertical da interface conforme novas funcionalidades forem adicionadas.

A solução deve substituir a sequência vertical de grandes seções por uma navegação por tabs na coluna de configurações.

A identidade visual atual deve ser preservada.

Não redesenhar os cards internos.

---

# 1. Estrutura geral

Manter o layout atual em duas colunas:

```text
COLUNA ESQUERDA
- Preview do Player
- Código de Embed / Setup

COLUNA DIREITA
- Navegação por tabs
- Conteúdo da tab ativa
```

A navegação por tabs deve afetar SOMENTE a coluna direita.

---

# 2. Preview deve permanecer sempre

O `WatchMapPlayer` / Preview do Player:

- NÃO pertence a nenhuma tab;
- NÃO deve desaparecer ao trocar de tab;
- NÃO deve ser desmontado/remontado;
- NÃO deve reiniciar playback;
- NÃO deve perder `currentTime`;
- NÃO deve perder estado de autoplay/background autoplay;
- NÃO deve ser recriado com `key` diferente.

Trocar:

```text
Aparência
→ Reprodução
→ Controles
→ Progresso
```

deve alterar somente o painel de configurações da direita.

A coluna esquerda permanece intacta.

---

# 3. Estado compartilhado

O estado principal de configuração do vídeo deve continuar acima da navegação por tabs.

Exemplo conceitual:

```ts
const [config, setConfig] = useState(initialConfig)
const [activeTab, setActiveTab] = useState("appearance")
```

As tabs apenas determinam qual editor está visível.

Elas NÃO possuem cópias próprias de `config`.

Alterações realizadas em qualquer tab devem continuar refletindo imediatamente no Preview do Player.

---

# 4. Tabs iniciais

Criar as seguintes tabs:

```text
Aparência
Reprodução
Controles
Progresso
```

Mapeamento:

```text
appearance
playback
controls
progress
```

Default:

```text
appearance
```

---

# 5. Conteúdo

Cada tab exibe somente sua categoria.

## Aparência

Preservar os controles atuais:

- Formato do player;
- Cor de destaque;
- Exibir título do vídeo.

## Reprodução

Preservar:

- Background Autoplay;
- Velocidade padrão;
- Volume padrão.

## Controles

Preservar:

- Esconder controles;
- Permitir fullscreen;
- opções relacionadas a fullscreen.

## Progresso

Preservar:

- Barra de progresso inteligente;
- Altura da barra;
- demais configurações atuais da categoria.

Não alterar comportamento ou persistência dessas configurações.

---

# 6. Navegação visual

Criar uma barra compacta de tabs no topo da coluna direita.

Ela deve seguir a linguagem visual atual do WatchMap:

- fundo neutro/muted muito leve;
- borda fina;
- radius coerente com os componentes existentes;
- espaçamento compacto;
- typography atual;
- sem cores novas.

Tab ativa:

- maior contraste;
- fundo semelhante aos cards atuais;
- texto mais forte;
- borda ou sombra muito sutil;
- pequeno uso do accent atual é permitido.

Tab inativa:

- aparência neutra;
- hover discreto.

Não criar tabs grandes ou visualmente pesadas.

---

# 7. Hierarquia visual

A barra de tabs passa a ser o primeiro nível de hierarquia.

Dentro da tab:

```text
Título da categoria
Descrição curta

[ configuração ]
[ configuração ]
[ configuração ]
```

Os controles internos atuais devem continuar visualmente familiares.

Evitar sensação de:

```text
card
  dentro de card
    dentro de card
```

Se existir um wrapper externo puramente visual envolvendo toda a categoria, ele pode ser simplificado.

Preservar os cards internos de configuração.

---

# 8. Header da categoria

Dentro da tab ativa, manter:

- ícone;
- título;
- descrição;
- badge contextual atual quando fizer sentido.

Exemplos:

```text
Aparência             PERSONALIZAÇÃO
Reprodução            MODOS EXCLUSIVOS
Controles             INTERFACE & AÇÕES
Barra de progresso    TIMELINE
```

A presença da tab não elimina a identidade do header da categoria.

---

# 9. Sticky

Em desktop, a barra de tabs pode permanecer sticky no topo da coluna direita.

Utilizar offset compatível com o header global da aplicação.

Ela deve permanecer discreta e não cobrir conteúdo.

Não tornar cada card sticky.

---

# 10. Coluna esquerda

Preservar o comportamento sticky atual da coluna esquerda.

O preview deve continuar visível durante a navegação/scroll sempre que o viewport atual permitir.

Não mover o Preview do Player para dentro da navegação de tabs.

Não mover Código de Embed para uma tab.

---

# 11. Código de Embed

A área:

```text
Código de Embed
Testes e Debug
```

continua pertencendo à coluna esquerda/setup.

Ela não participa das tabs de configuração.

Não alterar seu comportamento nesta spec.

---

# 12. Troca de tab

A troca deve ser instantânea e client-side.

Não:

- navegar para outra rota;
- fazer reload;
- refetch do vídeo;
- refetch da configuração;
- recriar o player;
- salvar configuração apenas por trocar de tab.

Apenas alterar:

```text
activeTab
```

---

# 13. Persistência das configurações

Preservar exatamente a estratégia atual de persistência.

Se hoje uma alteração é salva automaticamente, continuar assim.

Se existe debounce ou Server Action existente, reutilizar.

Trocar de tab não pode descartar uma configuração recém-alterada.

---

# 14. Mobile

Em telas menores:

```text
Preview
↓
Embed / Setup
↓
Tabs
↓
Conteúdo
```

A barra de tabs deve permitir scroll horizontal quando necessário.

Exemplo:

```text
Aparência | Reprodução | Controles | Progresso →
```

Não substituir automaticamente por dropdown.

Não quebrar os labels em várias linhas.

---

# 15. Crescimento futuro

A arquitetura deve permitir novas categorias futuramente.

Exemplo:

```text
Aparência
Reprodução
Controles
Progresso
Conversão
Avançado
```

Adicionar uma nova tab no futuro não deve exigir refazer o layout da página.

Evitar condicionais espalhadas.

Preferir definição central das tabs.

Exemplo conceitual:

```ts
const SETTINGS_TABS = [
  { id: "appearance", label: "Aparência" },
  { id: "playback", label: "Reprodução" },
  { id: "controls", label: "Controles" },
  { id: "progress", label: "Progresso" },
]
```

---

# 16. Não alterar funcionalidade

Esta spec é de organização e hierarquia da interface.

Não alterar:

- lógica do player;
- playback;
- Background Autoplay;
- config schema;
- backend;
- banco;
- endpoints;
- upload;
- analytics;
- embed;
- regras de plano;
- quota.

---

# 17. Acessibilidade

Tabs devem possuir semântica apropriada:

```text
role="tablist"
role="tab"
role="tabpanel"
```

Preservar:

- navegação por teclado;
- `aria-selected`;
- associação tab/panel.

---

# Critérios de aceite

- A coluna direita possui navegação por tabs.
- Existem Aparência, Reprodução, Controles e Progresso.
- Apenas uma categoria é exibida por vez.
- O Preview do Player permanece sempre fora das tabs.
- Trocar de tab não desmonta o player.
- Trocar de tab não reinicia playback.
- Trocar de tab não perde estado do player.
- Alterações continuam refletindo imediatamente no preview.
- Código de Embed permanece fora das tabs.
- Não existe reload ou navegação de rota ao trocar tab.
- Cards internos mantêm o estilo atual.
- Hierarquia da página fica mais clara.
- Scroll vertical da coluna de configurações é significativamente reduzido.
- Tabs funcionam em desktop e mobile.
- Mobile utiliza scroll horizontal quando necessário.
- Estrutura suporta novas categorias futuramente.
- Nenhuma regra funcional do player é alterada.