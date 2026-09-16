# Spec 017 — Background Autoplay Overlay

## Objetivo

Melhorar a experiência visual do modo `background_autoplay` do WatchMap Player.

Quando o vídeo estiver reproduzindo automaticamente sem som:

- aplicar um filtro visual sobre o vídeo;
- destacar melhor a ação para ativar o som;
- tornar o CTA responsivo ao tamanho do player;
- adicionar um efeito de pulse sutil;
- preservar o comportamento atual de iniciar a reprodução foreground ao clicar.

Não alterar a lógica do Playback Controller nesta spec.

---

## Estado

As alterações desta spec existem somente enquanto:

```text
playbackMode === "background_autoplay"
```

Ao entrar em reprodução foreground, overlay, filtro e CTA devem desaparecer imediatamente.

---

## Filtro sobre o vídeo

Enquanto `background_autoplay` estiver ativo, aplicar uma camada visual sobre toda a área do vídeo.

Objetivo:

```text
vídeo continua visível e em movimento
+
conteúdo perde destaque
+
CTA passa a ser o foco principal
```

Utilizar uma camada escura translúcida.

Referência visual:

```text
black com aproximadamente 30–40% de opacidade
```

Pode utilizar gradiente sutil se melhorar o resultado, por exemplo:

```text
topo      → mais escuro
centro    → levemente mais claro
base      → mais escuro
```

Não aplicar blur pesado sobre o vídeo.

O filtro deve:

- cobrir exatamente o viewport do player;
- respeitar border radius;
- não alterar o `<video>` permanentemente;
- desaparecer junto com o modo `background_autoplay`;
- continuar permitindo clique na área para ativar o som.

---

## CTA de ativação de som

Manter a ação:

```text
Ativar som e assistir do início
```

com ícone de volume.

O CTA deve continuar utilizando:

```text
var(--player-accent)
```

como cor principal.

### Responsividade

O CTA não deve depender de dimensões fixas que façam o conteúdo ficar apertado em players pequenos.

Deve se adaptar à largura disponível do próprio player através das container queries já utilizadas pelo WatchMap Player.

Comportamento esperado:

### Players estreitos

```text
largura máxima próxima das bordas
texto pode ocupar 2 linhas
padding horizontal menor
ícone permanece visível
```

Manter pelo menos um pequeno respiro lateral:

```text
~12–16px de cada lado
```

O CTA nunca deve ultrapassar o viewport do player.

### Players médios/grandes

O CTA pode utilizar largura automática baseada no conteúdo.

Não transformar desnecessariamente o CTA em botão de largura total.

---

## Tipografia e composição

O conteúdo deve permanecer centralizado.

Estrutura:

```text
[ícone]  Ativar som e
         assistir do início
```

ou em uma linha quando houver espaço suficiente.

Regras:

- ícone não deve encolher;
- texto centralizado;
- quebra de linha natural;
- preferencialmente no máximo 2 linhas;
- line-height compacto;
- peso semibold;
- tamanho adaptativo ao container;
- área clicável confortável em mobile.

Evitar texto espremido ou botão excessivamente alto.

---

## Pulse

Adicionar um efeito de `pulse` ao CTA enquanto `background_autoplay` estiver ativo.

O efeito deve chamar atenção sem fazer o próprio conteúdo do botão ficar constantemente aumentando e diminuindo.

Preferir uma camada/ring externa animada.

Comportamento conceitual:

```text
CTA principal
     ↓
anel externo surge
     ↓
expande levemente
     ↓
perde opacidade
     ↓
reinicia
```

Referência:

```text
duração aproximada: 1.6s–2.2s
loop infinito
ease-out
```

O ring deve utilizar a cor:

```text
var(--player-accent)
```

com transparência.

Não utilizar animação agressiva.

O CTA principal pode possuir apenas microinterações normais:

```text
hover → leve scale
active → leve redução
```

---

## Reduced Motion

Respeitar:

```css
@media (prefers-reduced-motion: reduce)
```

Quando redução de movimento estiver ativa:

- desabilitar o pulse contínuo;
- manter o CTA totalmente funcional;
- preservar somente transições essenciais ou instantâneas.

---

## Hierarquia visual

Durante `background_autoplay`:

```text
vídeo
↓
filtro escuro
↓
CTA + pulse
```

Loading e Error Overlay continuam possuindo prioridade quando aplicáveis.

Não deixar o pulse ser cortado incorretamente pelo próprio botão.

---

## Interação

Clicar:

```text
CTA
```

ou na área clicável do overlay deve continuar executando:

```text
startForegroundPlayback(...)
```

Preservar o comportamento atual:

```text
ativar áudio
+
reiniciar conforme regra existente do Playback Controller
+
entrar em foreground playback
```

Não duplicar essa lógica dentro da camada visual.

---

## Compatibilidade

A solução deve funcionar igualmente em:

```text
16:9
9:16
player incorporado
player dentro da aplicação
fullscreen quando aplicável
```

A adaptação deve considerar a largura real do player, não apenas o viewport do navegador.

---

## Critérios de aceite

- filtro visual aparece somente em `background_autoplay`;
- vídeo continua visível e reproduzindo atrás do filtro;
- filtro cobre toda a área do vídeo;
- CTA utiliza `var(--player-accent)`;
- CTA não ultrapassa os limites do player;
- CTA se adapta corretamente a players estreitos;
- texto pode quebrar em até 2 linhas quando necessário;
- ícone permanece corretamente dimensionado;
- CTA possui pulse externo sutil;
- pulse não fica deformando continuamente o conteúdo principal;
- `prefers-reduced-motion` desabilita a animação contínua;
- clique no CTA inicia foreground playback;
- clique no overlay mantém o comportamento atual;
- 16:9 e 9:16 funcionam corretamente;
- Player Runtime não é alterado;
- Playback Controller não recebe nova lógica;
- `pnpm typecheck` passa;
- `pnpm lint` passa;
- `pnpm build` passa.

Não implemente funcionalidades além das especificadas.