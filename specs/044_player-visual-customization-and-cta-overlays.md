# 044 — Player Visual Customization and CTA Overlays

## Objetivo

Adicionar quatro melhorias ao player sem alterar sua arquitetura de playback:

1. customização do border radius do player;
2. customização independente da cor da Fake Progress Bar;
3. redesign do CTA de Background Autoplay;
4. novo CTA “Continue assistindo” quando o usuário pausa um vídeo que já começou.

Não alterar fluxo de HLS, tracking, entitlement, autoplay ou providers.

---

# 1. Border Radius do Player

Adicionar à configuração:

```ts
appearance: {
  borderRadius: number
}
```

Default:

```ts
12
```

Limites:

```text
0px → 32px
```

Step:

```text
2px
```

Atualizar:

- `PlayerConfig`;
- Zod schema;
- `DEFAULT_PLAYER_CONFIG`;
- validation da Server Action;
- merge/persistência existente.

Config antiga sem o campo deve assumir:

```text
12px
```

---

# 2. UI do Border Radius

Na tab:

```text
Aparência
```

adicionar bloco:

```text
Arredondamento do player
```

Descrição curta:

```text
Define o arredondamento dos cantos do vídeo.
```

Controle:

```text
slider 0 → 32px
```

Mostrar valor atual:

```text
12px
```

A alteração deve refletir imediatamente no Preview.

Não adicionar:

- border color;
- border width;
- border style.

A personalização é somente radius.

---

# 3. Aplicação do Radius

Hoje o `WatchMapPlayer` utiliza:

```text
rounded-xl
```

fixo.

Substituir pelo valor configurado:

```ts
borderRadius: `${effectiveConfig.appearance.borderRadius}px`
```

Aplicar no container principal do player.

Todo conteúdo interno continua respeitando:

```text
overflow-hidden
```

Em fullscreen:

```text
borderRadius = 0
```

independentemente da configuração.

Ao sair do fullscreen, restaurar o valor configurado.

---

# 4. Cor independente da Fake Progress Bar

Adicionar:

```ts
progress.fake.color
```

Valores:

```text
accent
purple
blue
emerald
orange
rose
black
white
gray
```

Default:

```text
accent
```

`accent` significa:

```text
usar a Cor de destaque do player
```

Isso preserva exatamente o comportamento atual dos vídeos existentes.

---

# 5. UI da cor da Fake Bar

Na tab:

```text
Progresso
```

quando a Fake Progress Bar estiver habilitada, adicionar:

```text
Cor da barra
```

Usar o mesmo sistema visual refinado do color picker já existente.

Primeira opção:

```text
Cor principal
```

representando:

```text
accent
```

Depois:

```text
Roxo
Azul
Esmeralda
Laranja
Rosa
Preto
Branco
Cinza
```

Não duplicar componentes desnecessariamente.

Se fizer sentido, extrair o picker existente para um componente reutilizável.

---

# 6. Render da Fake Bar

Hoje a Fake Bar usa:

```css
var(--player-accent)
```

diretamente.

Alterar para resolver:

```text
fake.color = accent
→ var(--player-accent)

fake.color = preset
→ PLAYER_ACCENT_PRESETS[preset].tokens.base
```

Somente a Fake Progress Bar utiliza essa cor independente.

Não alterar:

- botão de play;
- volume;
- controles;
- progress bar normal;
- accent principal do player.

---

# 7. Redesign — “Seu vídeo já começou”

O overlay atual de Background Autoplay está visualmente fraco e possui um pulse inadequado.

Refazer o CTA mantendo a mesma função:

```text
Seu vídeo já começou
Clique para ativar o som
```

Mas melhorar significativamente:

- hierarquia;
- proporção;
- legibilidade;
- microinteração;
- aparência do CTA.

Não criar algo exagerado ou publicitário.

Deve parecer parte nativa de um player moderno de VSL.

---

# 8. Ícone correto

O CTA deve representar que o vídeo está SEM SOM.

Trocar o ícone atual:

```text
Volume2
```

por:

```text
VolumeX
```

ou equivalente visual de áudio desativado.

O significado deve ser imediatamente claro:

```text
vídeo tocando
+
som desligado
+
clique para ativar
```

---

# 9. Ondas no ícone

Remover o pulse externo atual:

```text
wm-pulse-ring
```

A animação principal deve acontecer ao redor do ÍCONE de áudio.

Estrutura conceitual:

```text
      onda 2
    (       )

      onda 1
     (     )

      [ VolumeX ]
```

Criar 2 ou 3 ondas concêntricas que:

- começam próximas ao círculo do ícone;
- expandem suavemente;
- perdem opacidade;
- possuem delays diferentes;
- repetem continuamente;
- não alteram layout;
- não deformam o CTA.

Animação deve parecer:

```text
wave / sonar
```

e não:

```text
elemento crescendo e encolhendo
```

---

# 10. Qualidade da animação

As ondas devem utilizar apenas:

```text
transform
opacity
```

para animação fluida.

Exemplo conceitual:

```css
@keyframes wm-sound-wave {
  0% {
    transform: scale(0.75);
    opacity: 0;
  }

  20% {
    opacity: 0.45;
  }

  100% {
    transform: scale(1.8);
    opacity: 0;
  }
}
```

Não copiar literalmente se outro timing ficar visualmente melhor.

Objetivo:

```text
suave
contínuo
orgânico
sem flicker
```

---

# 11. Estrutura visual do CTA

Evitar que todo o botão seja apenas um grande bloco sólido da accent color.

Preferir algo mais refinado:

```text
container escuro / glass
+
ícone com accent
+
texto branco
+
accent usado como detalhe
```

ou solução equivalente coerente com o player.

O accent continua presente, mas não precisa dominar 100% do CTA.

A prioridade é:

```text
ícone
↓
ação principal
↓
contexto
```

---

# 12. Responsividade do CTA

O overlay precisa funcionar bem em:

```text
16:9
9:16
1:1
```

e em players pequenos.

Não deixar:

- texto quebrar de forma feia;
- CTA ficar gigante;
- ondas serem cortadas;
- overlay cobrir praticamente todo o vídeo.

Usar container queries já existentes.

---

# 13. Reduced Motion

Respeitar:

```css
@media (prefers-reduced-motion: reduce)
```

Nesse caso:

- remover ondas;
- manter CTA estático e funcional.

---

# 14. Novo estado de Pause

Hoje qualquer estado pausado em foreground exibe apenas o grande botão circular de Play.

Separar dois casos:

```text
ANTES DO PRIMEIRO PLAY
→ botão Play normal
```

```text
VÍDEO JÁ COMEÇOU + usuário pausou
→ CTA “Continue assistindo”
```

Não confundir os estados.

---

# 15. Como identificar “já começou”

Usar o estado já existente:

```text
hasStartedPlayingForeground
```

ou fonte equivalente já confiável.

CTA “Continue assistindo” só aparece quando:

```text
foreground
AND
!isPlaying
AND
!isLoading
AND
!hasError
AND
hasStartedPlayingForeground
AND
vídeo não terminou
```

Não usar apenas:

```text
currentTime > 0
```

se já houver estado melhor disponível.

---

# 16. Initial Play continua simples

Antes do usuário iniciar o vídeo pela primeira vez:

```text
!hasStartedPlayingForeground
```

manter o botão Play inicial existente.

Não mostrar:

```text
Continue assistindo
```

antes de o vídeo realmente ter começado.

---

# 17. CTA “Continue assistindo”

Ao pausar depois de já ter iniciado:

mostrar no centro:

```text
[ Play ]

Continue assistindo
```

Pode conter uma microcopy secundária discreta como:

```text
Clique para continuar
```

se visualmente ajudar.

Não adicionar texto excessivo.

---

# 18. Visual do Continue Assistindo

Seguir a mesma família visual do CTA:

```text
Seu vídeo já começou
```

para criar consistência.

Mas não precisa ser idêntico.

Direção:

```text
card compacto
glass/dark
ícone Play destacado
texto forte
accent utilizado como detalhe
```

---

# 19. Pulse do Continue Assistindo

Pode existir um pulse, mas NÃO reutilizar o pulse malformado atual.

Preferir uma animação extremamente sutil no círculo do Play:

```text
halo
→ expande poucos pixels
→ desaparece
```

ou:

```text
soft glow breathing
```

Não animar o card inteiro.

Não deformar largura/altura.

Não usar scale agressivo.

---

# 20. Interação

Clique em qualquer parte do CTA:

```text
→ retoma reprodução imediatamente
```

Não:

- reiniciar vídeo;
- fazer seek para 0;
- recriar HLS;
- chamar autorização;
- mudar playback mode.

Continue exatamente do `currentTime` atual.

---

# 21. Background Autoplay continua diferente

No Background Autoplay:

```text
click
→ foreground
→ currentTime = 0
→ ativa áudio
```

Preservar comportamento atual.

No Pause CTA:

```text
click
→ video.play()
→ continua do ponto atual
```

São ações diferentes.

Não misturar.

---

# 22. Vídeo terminado

Quando:

```text
video.ended === true
```

não mostrar:

```text
Continue assistindo
```

Preservar comportamento existente ou replay apropriado atual.

Não tratar término como pause.

---

# 23. Controles

O novo CTA central não substitui os controles inferiores.

Se controles estiverem habilitados:

```text
pause
→ Continue assistindo central
+
controles inferiores continuam disponíveis
```

Clicar no botão Play dos controles também continua funcionando normalmente.

---

# 24. Z-index

Garantir prioridade correta:

```text
Error
Loading
Background Autoplay CTA
Pause CTA
Controls
Fake Bar
Video
```

Não permitir sobreposição quebrada entre:

```text
Continue assistindo
Background CTA
Loading
Error
```

---

# 25. Não alterar playback

Esta spec NÃO deve alterar:

- `PlaybackController` além do mínimo necessário para UI;
- preload;
- HLS;
- Background Autoplay logic;
- tracking;
- play session;
- quota;
- provider;
- embed bootstrap.

São mudanças de configuração visual e overlays.

---

# 26. Config completa esperada

Conceitualmente:

```ts
appearance: {
  accentColor: "purple",
  aspectRatio: "16:9",
  showTitle: true,
  borderRadius: 12
},

progress: {
  fake: {
    enabled: false,
    height: 4,
    color: "accent"
  }
}
```

---

# 27. Compatibilidade

Configs antigas devem continuar válidas.

Ausência:

```text
appearance.borderRadius
```

→ `12`

Ausência:

```text
progress.fake.color
```

→ `accent`

Não exigir migration do JSON armazenado.

O parser deve aplicar defaults.

---

# 28. Embed

Todas essas configurações devem funcionar igualmente em:

```text
Preview interno
Embed real
```

Não implementar somente no editor.

O bundle final deve receber e aplicar as configurações normalmente.

---

# 29. Build

Ao final:

```text
pnpm typecheck
pnpm lint
pnpm build:embed
```

Regenerar:

```text
public/embed/v1/watchmap-player.js
```

---

# Critérios de aceite

- Existe controle de border radius.
- Radius varia de 0 a 32px.
- Radius atualiza o Preview em tempo real.
- Fullscreen sempre usa radius 0.
- Fake Bar possui cor independente.
- Default da Fake Bar continua usando accent.
- Fake Bar aceita todos os presets atuais.
- Configs antigas continuam válidas.
- “Seu vídeo já começou” foi redesenhado.
- CTA usa ícone de som desativado.
- Ícone possui animação de ondas suave.
- Pulse externo antigo foi removido.
- Reduced Motion é respeitado.
- Antes do primeiro Play continua existindo Play normal.
- Pause após reprodução mostra “Continue assistindo”.
- Continue Assistindo possui pulse sutil e bem acabado.
- Pulse não deforma o card.
- Continue Assistindo retoma do ponto atual.
- Background Autoplay continua reiniciando para 0 ao ativar áudio.
- Vídeo terminado não mostra Continue Assistindo.
- Funciona em 16:9, 9:16 e 1:1.
- Funciona no Preview e no Embed.
- Nenhuma lógica de autorização/playback é alterada.