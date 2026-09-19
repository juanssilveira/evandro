# 050 — Thumbnail Play Button Visibility & Editor UI Polish

## Objetivo

Fechar um pequeno refinamento da experiência de thumbnails antes da próxima grande milestone arquitetural.

Esta spec possui dois objetivos:

```text
1. permitir escolher se thumbnails personalizadas exibem ou não o botão central de Play;

2. redesenhar a experiência de configuração das thumbnails no editor para ficar mais visual, clara e intuitiva.
```

A Spec 049 está manualmente aceita e todo seu comportamento funcional deve permanecer estável.

Esta milestone é deliberadamente pequena.

Não alterar:

```text
playback architecture
PlayerEngine
HLS ownership
startup pipeline
Background Preview
fade/crossfade
upload pipeline
storage architecture
```

---

# 1. Estado atual

Hoje existem duas experiências distintas.

## Thumbnail inicial

Quando:

```text
BG OFF
+
player ainda não iniciou
```

o player exibe sempre o botão central de Play.

Mesmo quando existe:

```text
custom startup thumbnail
```

não existe configuração para escondê-lo.

---

## Thumbnail de pausa

Quando:

```text
pauseThumbnail.enabled = true
+
customUrl existe
```

o player mostra apenas:

```text
custom pause thumbnail
```

A imagem inteira é clicável para continuar.

Não existe botão central de Play.

---

# 2. Novo comportamento

Quando existir uma thumbnail personalizada válida, o usuário poderá escolher:

```text
Mostrar botão de reprodução
ON / OFF
```

A escolha será independente para:

```text
Thumbnail inicial personalizada
Thumbnail de pausa personalizada
```

---

# 3. Regra importante — somente custom thumbnails

Essa configuração é exclusiva de thumbnails personalizadas.

Ela não deve aparecer como configuração relevante para:

```text
thumbnail automática do provider
Continue assistindo
Background Preview WebP
Thumbnail OFF
```

Portanto, no editor, a opção:

```text
Mostrar botão de reprodução
```

só aparece quando existe efetivamente uma imagem customizada naquele contexto.

---

# 4. Configuração

Evoluir:

```ts
appearance: {
  thumbnail: {
    enabled: boolean;
    source: "provider" | "custom";
    customUrl: string | null;
    customKey: string | null;
    customAspectRatio: "16:9" | "9:16" | "1:1" | null;
  };

  pauseThumbnail: {
    enabled: boolean;
    customUrl: string | null;
    customKey: string | null;
    customAspectRatio: "16:9" | "9:16" | "1:1" | null;
  };
}
```

para:

```ts
appearance: {
  thumbnail: {
    enabled: boolean;
    source: "provider" | "custom";
    customUrl: string | null;
    customKey: string | null;
    customAspectRatio: "16:9" | "9:16" | "1:1" | null;
    showPlayButton: boolean;
  };

  pauseThumbnail: {
    enabled: boolean;
    customUrl: string | null;
    customKey: string | null;
    customAspectRatio: "16:9" | "9:16" | "1:1" | null;
    showPlayButton: boolean;
  };
}
```

---

# 5. Defaults

Preservar exatamente o comportamento existente.

## Startup

Default:

```ts
showPlayButton: true
```

porque atualmente o Play sempre aparece na tela inicial.

## Pause

Default:

```ts
showPlayButton: false
```

porque atualmente a custom pause thumbnail não possui Play central.

Assim configurações antigas continuam visualmente idêntnticas depois do parse.

---

# 6. Não criar migration SQL

Continuar utilizando:

```text
video_player_settings.config
```

em JSONB.

Não criar migration.

---

# 7. Deep merge

Garantir persistência independente de:

```text
appearance.thumbnail.showPlayButton
appearance.pauseThumbnail.showPlayButton
```

Não substituir acidentalmente os demais campos dos objetos nested.

O deep merge existente deve ser preservado/verificado.

---

# 8. Validação

Atualizar os schemas utilizados pelo player e pelo Server Action para aceitar:

```text
thumbnail.showPlayButton
pauseThumbnail.showPlayButton
```

como boolean.

Configurações antigas sem esses campos devem resolver automaticamente para seus respectivos defaults.

---

# 9. Startup custom — Play ON

Quando:

```text
BG OFF
Thumbnail ON
source = custom
customUrl existe
showPlayButton = true
```

o comportamento deve continuar equivalente ao atual:

```text
Custom Thumbnail
       +
   Play Button
```

Clique:

```text
foreground playback
```

---

# 10. Startup custom — Play OFF

Quando:

```text
BG OFF
Thumbnail ON
source = custom
customUrl existe
showPlayButton = false
```

mostrar:

```text
Custom Thumbnail
```

sem botão central.

Porém a thumbnail inteira continua sendo uma superfície de interação.

Clique em qualquer área livre da imagem:

```text
foreground playback
```

Esconder o botão significa apenas:

```text
esconder a representação visual do Play
```

Nunca:

```text
desabilitar interação
```

---

# 11. Não escurecer thumbnail quando Play estiver OFF

Hoje o overlay inicial que contém o Play também aplica uma camada equivalente a:

```text
bg-black/20
```

Quando:

```text
custom thumbnail
+
showPlayButton = false
```

não manter uma camada escura apenas porque existe uma hit area invisível.

Objetivo:

```text
imagem enviada pelo usuário
→ exibida visualmente sem escurecimento artificial
```

A área clicável pode continuar existindo de forma transparente.

---

# 12. Provider thumbnail permanece como hoje

Quando:

```text
source = provider
```

o comportamento atual não muda.

O botão inicial de Play continua aparecendo.

`showPlayButton` não deve alterar a thumbnail automática do provider.

Portanto:

```text
Provider Thumbnail
→ Play atual
```

sempre continua funcionando.

Esta milestone não adiciona customização do Play para o poster automático.

---

# 13. Thumbnail OFF permanece absoluta

Quando:

```text
thumbnail.enabled = false
```

continuar seguindo as Specs 048/049.

Não mostrar:

```text
provider thumbnail
custom thumbnail
Background Preview
```

Esta nova configuração não muda esse comportamento.

---

# 14. Background Autoplay permanece independente

Quando:

```text
backgroundAutoplay = true
```

a startup thumbnail personalizada continua fora do startup.

Portanto:

```text
showPlayButton
```

da thumbnail inicial não participa do fluxo de Background Autoplay.

Continuar:

```text
Preview WebP
+
Main Video
+
CTA "Seu vídeo já começou"
```

O novo campo não controla o CTA do Background Autoplay.

---

# 15. Custom startup fallback

Se:

```text
source = custom
customUrl configurada
```

mas a imagem custom falhar e o player utilizar o poster do provider como fallback:

a preferência:

```text
showPlayButton
```

configurada para o modo custom deve continuar sendo respeitada naquele carregamento.

Não fazer o botão aparecer/desaparecer inesperadamente apenas porque o asset custom falhou.

---

# 16. Pause custom — Play OFF

Default e comportamento atual:

```text
pauseThumbnail.enabled = true
customUrl existe
showPlayButton = false
```

Resultado:

```text
Custom Pause Thumbnail
```

sem botão central.

Toda a imagem continua clicável.

Clique:

```text
resume playback
```

---

# 17. Pause custom — Play ON

Quando:

```text
pauseThumbnail.enabled = true
customUrl existe
showPlayButton = true
```

resultado:

```text
Custom Pause Thumbnail
        +
    Play Button
```

O Play deve aparecer centralizado sobre a imagem.

Clique:

```text
resume playback
```

Tanto:

```text
clicar no botão
```

quanto:

```text
clicar no restante da imagem
```

devem continuar o vídeo.

---

# 18. Visual do Play

O botão das custom thumbnails deve reutilizar a linguagem visual do Play existente no Evandro Player.

Utilizar:

```text
accent color atual do player
círculo central
ícone Play
foreground correspondente ao accent preset
shadow discreto
```

Não criar um segundo estilo visual arbitrário.

O botão da thumbnail inicial e o botão opcional da pause thumbnail devem parecer parte do mesmo player.

---

# 19. Tamanho responsivo

Preservar a adaptação atual do player.

O Play deve permanecer proporcional em:

```text
16:9
9:16
1:1
players pequenos
players grandes
```

Não utilizar tamanho fixo excessivo em player vertical ou compacto.

---

# 20. Controles continuam acima

Na pause thumbnail:

```text
custom image
+
optional Play
```

não pode bloquear os controles normais do player.

Preservar a hierarquia:

```text
Pause Thumbnail
↓
Play visual opcional
↓
Player Controls acima quando visíveis
```

---

# 21. Fallback da pause thumbnail

Se:

```text
pauseThumbnail.enabled = true
```

mas:

```text
customUrl ausente
OU
custom image falha
```

continuar utilizando:

```text
Continue assistindo
Clique para continuar
```

Neste fallback:

```text
pauseThumbnail.showPlayButton
```

não participa.

O card padrão mantém seu comportamento e seu ícone atuais.

---

# 22. Upload inicial

Quando um usuário envia sua primeira custom startup thumbnail:

```text
showPlayButton
```

deve resolver para:

```text
true
```

se ainda não existir valor explícito.

Para a primeira custom pause thumbnail:

```text
showPlayButton
```

deve resolver para:

```text
false
```

se ainda não existir valor explícito.

---

# 23. Substituição de imagem

Quando o usuário utilizar:

```text
Substituir imagem
```

preservar sua escolha atual de:

```text
showPlayButton
```

Exemplo:

```text
startup custom
showPlayButton = false
↓
Substituir imagem
↓
continua false
```

---

# 24. Alternar Automática / Personalizada

Para startup:

se existir custom thumbnail armazenada e o usuário alternar:

```text
Personalizada
→ Automática
→ Personalizada
```

preservar sua preferência de:

```text
showPlayButton
```

da custom thumbnail.

A opção é apenas ignorada enquanto:

```text
source = provider
```

---

# 25. Remover custom startup

Quando executar:

```text
Remover personalizada
```

além do comportamento atual:

```text
source = provider
customUrl = null
customKey = null
customAspectRatio = null
```

resetar:

```text
showPlayButton = true
```

para o default canônico da startup thumbnail.

---

# 26. Remover custom pause

Ao remover a Pause Thumbnail:

```text
enabled = false
customUrl = null
customKey = null
customAspectRatio = null
```

também resetar:

```text
showPlayButton = false
```

O player volta para:

```text
Continue assistindo
```

---

# 27. Redesign geral dos cards de thumbnail

O componente atual funciona, porém possui muita aparência de:

```text
card
dentro de card
dentro de bloco
+
texto técnico
+
ações pouco hierarquizadas
```

A nova interface deve priorizar:

```text
estado atual
↓
imagem
↓
comportamento
↓
ações
```

em uma leitura imediata.

Seguir rigorosamente:

```text
docs/03-DESIGN.md
```

---

# 28. Estrutura visual alvo

As duas áreas devem compartilhar a mesma linguagem visual.

Conceitualmente:

```text
┌──────────────────────────────────────────┐
│ [ícone] Thumbnail inicial       [status] │
│ Imagem exibida antes da reprodução.     │
│                                          │
│ Exibição                                 │
│ [ Automática ] [ Personalizada ]         │
│                                          │
│ ┌──────────── Preview ─────────────────┐ │
│ │                                     │ │
│ │             ▶ opcional              │ │
│ │                                     │ │
│ └─────────────────────────────────────┘ │
│                                          │
│ Imagem                                   │
│ 1280 × 720 • JPG, PNG ou WebP           │
│ [Substituir]               [Remover]     │
│                                          │
│ ───────────────────────────────────────  │
│ Botão de reprodução              [ON]    │
│ Exibe um botão central sobre a imagem.  │
└──────────────────────────────────────────┘
```

Para pause:

```text
┌──────────────────────────────────────────┐
│ [ícone] Ao pausar               [status] │
│ Escolha a experiência ao pausar.         │
│                                          │
│ [ Continue assistindo ] [ Thumbnail ]    │
│                                          │
│ ┌──────────── Preview ─────────────────┐ │
│ │                                     │ │
│ │             ▶ opcional              │ │
│ │                                     │ │
│ └─────────────────────────────────────┘ │
│                                          │
│ Imagem                                   │
│ 1280 × 720 • JPG, PNG ou WebP           │
│ [Substituir]               [Remover]     │
│                                          │
│ ───────────────────────────────────────  │
│ Botão de reprodução             [OFF]    │
│ Exibe um botão central ao pausar.        │
└──────────────────────────────────────────┘
```

Não precisa reproduzir literalmente esse wireframe.

O objetivo é a hierarquia.

---

# 29. Header dos cards

Cada seção deve possuir um header claro com:

```text
ícone semântico
nome
descrição curta
estado atual
```

Estados podem aparecer como badge discreto, por exemplo:

Startup:

```text
Ativa
Desativada
Automática
Personalizada
```

Pause:

```text
Continue assistindo
Personalizada
```

Não usar cor chamativa desnecessária.

Badges devem ser informativos, não decorativos.

---

# 30. Seletores principais

Os seletores:

```text
Automática / Personalizada
```

e:

```text
Continue assistindo / Thumbnail personalizada
```

devem parecer opções mutuamente exclusivas claras.

Manter:

```text
título
microdescrição
selected state
check visual
```

Mas melhorar:

```text
espaçamento
hierarquia
área clicável
contraste selecionado/não selecionado
```

Não criar aparência de dois botões Primary concorrentes.

---

# 31. Preview mais importante

Quando existir imagem customizada, o preview deve se tornar o elemento visual principal da subseção.

Não deixá-lo parecer apenas uma caixa técnica secundária.

O preview deve:

```text
mostrar a imagem
mostrar aspect ratio
mostrar visualmente o Play quando habilitado
```

e atualizar imediatamente ao mudar:

```text
showPlayButton
```

---

# 32. Preview respeita aspect ratio

O preview do uploader atualmente utiliza visualmente um frame horizontal fixo.

Evoluir para representar o aspect ratio atual:

```text
16:9
9:16
1:1
```

sem distorcer a imagem.

Para não tornar o card enorme em `9:16`, utilizar um container de preview com tamanho máximo adequado e centralizar o frame.

Não esticar um asset vertical para um box 16:9 apenas no painel.

---

# 33. Play no preview do editor

O preview da própria configuração deve refletir:

```text
showPlayButton = true
→ Play visível

showPlayButton = false
→ sem Play
```

Utilizar a cor de destaque atual do player quando possível.

Assim o usuário entende a configuração antes mesmo de interagir com o preview real do player.

---

# 34. Seção "Botão de reprodução"

Quando existir custom image válida, adicionar uma linha própria:

```text
Botão de reprodução                         [Switch]

Exibe um botão central sobre a thumbnail.
```

Para startup, microcopy sugerida:

```text
Exibe um botão de Play central sobre a imagem inicial.
```

Para pause:

```text
Exibe um botão de Play central sobre a imagem de pausa.
```

---

# 35. Opção só aparece quando faz sentido

Não mostrar a configuração do botão quando não existe custom image.

### Startup

Mostrar somente quando:

```text
source = custom
+
customUrl existe
```

### Pause

Mostrar somente quando:

```text
pauseThumbnail.enabled = true
+
customUrl existe
```

Antes do upload, focar a interface na ação:

```text
Enviar imagem
```

---

# 36. Área de upload vazia

Melhorar a área atual para comunicar claramente:

```text
Enviar imagem
Formato aceito
Tamanho recomendado
Limite
crop automático
```

Sem transformar tudo em vários parágrafos técnicos.

Exemplo:

```text
Enviar imagem personalizada

Arraste ou selecione uma imagem

1280 × 720 recomendado
JPG, PNG ou WebP • até 10 MB

Imagens fora da proporção serão recortadas.
```

Não é obrigatório implementar drag-and-drop se o componente atual não possui infraestrutura para isso.

Não ampliar o escopo apenas pelo texto visual.

Se não houver drag-and-drop real:

```text
não escrever "Arraste"
```

---

# 37. Informações técnicas

Consolidar:

```text
aspect ratio
recommended dimensions
format
file limit
crop behavior
```

em uma região visual secundária clara.

Evitar aparência de log técnico ou texto solto no rodapé do card.

---

# 38. Ações

Quando existir asset:

Ação principal operacional:

```text
Substituir imagem
```

Ação destrutiva/terciária:

```text
Remover
```

Seguir as variantes visuais do Design System.

Não utilizar dois botões Primary lado a lado.

---

# 39. Loading

Durante:

```text
upload
replace
remove
save showPlayButton
```

mostrar feedback correspondente sem travar partes não relacionadas da página.

Evitar:

```text
spinner sem contexto
```

Se o switch estiver salvando, o estado deve permanecer visualmente compreensível.

---

# 40. Atualização otimista

Mudança de:

```text
showPlayButton
```

deve refletir imediatamente:

```text
uploader preview
+
preview real do player
```

seguindo o fluxo otimista já utilizado por `VideoSettings`.

Se o save falhar:

```text
reverter config
+
toast error
```

como as demais configurações.

---

# 41. Embed

A configuração precisa chegar integralmente ao embed.

Atualizar tipagens intermediárias do Tiny Loader/bootstrap quando necessário para incluir:

```text
thumbnail.showPlayButton
pauseThumbnail.showPlayButton
```

Não criar request adicional.

Não alterar bootstrap API apenas para essa feature além de transportar a configuração já persistida.

---

# 42. PlayerEngine não precisa assumir essa responsabilidade

Esta configuração é visual/interativa da UI.

Não mover para o PlayerEngine:

```text
renderização do botão
```

A Engine continua responsável pelo playback.

O clique da superfície continua utilizando o fluxo de playback já existente.

Esta spec não deve antecipar a futura Full Headless Playback Engine Ownership.

---

# 43. Compatibilidade

Configs antigas:

```text
sem thumbnail.showPlayButton
sem pauseThumbnail.showPlayButton
```

devem produzir:

```text
startup → Play visível
pause → Play invisível
```

exatamente como antes.

---

# 44. Não alterar upload pipeline

Preservar:

```text
client-side crop
resize
WebP
compression
R2
versioned key
immutable cache
safe asset replacement
```

Nenhuma alteração de formato/storage é necessária.

---

# 45. Não alterar tamanho de assets

Preservar os limites e recomendações da Spec 049.

```text
16:9 → 1280 × 720
9:16 → 720 × 1280
1:1 → 1080 × 1080
```

---

# 46. Arquivos principais

Trabalhar principalmente em:

```text
src/types/player-config.ts

src/lib/validations/videos.ts
src/lib/player-settings.ts

src/app/actions/videos.ts

src/components/videos/player-thumbnail-uploader.tsx
src/components/videos/video-settings.tsx

src/components/player/evandro-player.tsx

src/components/player/embed/loader-entry.ts
```

Pode extrair pequenos componentes visuais do uploader se isso reduzir duplicação e melhorar legibilidade.

Exemplos conceituais:

```text
ThumbnailPreview
ThumbnailPlayButtonSetting
ThumbnailAssetActions
```

Não criar um mini design system paralelo.

---

# 47. Redução de duplicação

Startup e pause atualmente possuem muito markup semelhante para:

```text
upload
preview
aspect warning
replace
remove
technical info
```

É permitido aproveitar esta milestone para extrair componentes pequenos compartilhados.

Objetivo:

```text
melhor legibilidade
menos duplicação
mesmo visual
```

Não realizar refactor fora do domínio de thumbnails.

---

# 48. O que deve mudar visualmente

A área de thumbnails em:

```text
Aparência
```

deve ficar:

```text
mais visual
mais fácil de escanear
mais óbvia
mais consistente
menos parecida com vários cards aninhados
```

O usuário deve entender rapidamente:

```text
qual modo está ativo
qual imagem está configurada
como substituí-la
como removê-la
se existe botão de Play
```

---

# 49. O que NÃO deve mudar

Não alterar:

```text
HLS
source ownership
PlayerEngine
buffering
startup performance
timeline
volume
playback rate
fullscreen
fake progress

Background Autoplay
Background Preview WebP
CTA "Seu vídeo já começou"

thumbnail upload processing
R2 storage
cache policy

fade/crossfade
pause/resume semantics

tracking
quota
entitlement
```

---

# 50. Teste manual — Startup default antigo

Utilizar uma configuração antiga ou sem o novo campo.

Com:

```text
BG OFF
Thumbnail ON
source = provider
```

Esperado:

```text
provider thumbnail
+
Play visível
```

Nada muda.

---

# 51. Teste manual — Custom Startup / Play ON

Upload de startup custom.

Esperado inicialmente:

```text
showPlayButton = true
```

No preview:

```text
custom image
+
Play
```

F5.

Esperado:

```text
custom image
+
Play
```

Clique:

```text
vídeo inicia normalmente
```

---

# 52. Teste manual — Custom Startup / Play OFF

Desativar:

```text
Mostrar botão de reprodução
```

Esperado imediatamente:

```text
Play desaparece
```

Imagem continua visível sem overlay escuro artificial.

F5.

Esperado:

```text
continua sem Play
```

Clique diretamente na imagem:

```text
vídeo inicia normalmente
```

---

# 53. Teste manual — automática ignora configuração

Com custom startup configurada:

```text
showPlayButton = false
```

alterar:

```text
Personalizada
→ Automática
```

Esperado:

```text
provider thumbnail
+
Play normal
```

Voltar para:

```text
Personalizada
```

Esperado:

```text
custom thumbnail
+
sem Play
```

A preferência foi preservada.

---

# 54. Teste manual — substituir startup

Com:

```text
custom
showPlayButton = false
```

substituir a imagem.

Esperado:

```text
nova imagem
+
showPlayButton continua false
```

---

# 55. Teste manual — remover startup

Remover custom startup.

Esperado:

```text
source = provider
```

Depois subir nova custom futuramente.

Esperado default:

```text
showPlayButton = true
```

---

# 56. Teste manual — Pause default antigo

Sem novo campo:

```text
custom pause thumbnail
```

Esperado:

```text
sem Play central
```

como hoje.

---

# 57. Teste manual — Pause / Play ON

Ativar:

```text
Mostrar botão de reprodução
```

Pause.

Esperado:

```text
custom pause image
+
Play central
```

Clique no botão:

```text
resume
```

Pause novamente.

Clique fora do botão, diretamente na imagem:

```text
resume
```

---

# 58. Teste manual — Pause / Play OFF

Desativar.

Pause.

Esperado:

```text
custom pause image
sem Play
```

Imagem continua clicável.

---

# 59. Teste manual — Pause fallback

Com custom pause ativa, provocar ausência/falha da custom image.

Esperado:

```text
Continue assistindo
Clique para continuar
```

O fallback padrão continua funcional.

---

# 60. Teste manual — Aspect ratios

Testar:

```text
16:9
9:16
1:1
```

O uploader preview deve representar visualmente o formato correto.

A imagem não pode distorcer.

O botão opcional continua centralizado.

---

# 61. Teste manual — Editor vs embed

Para startup custom:

```text
showPlayButton = false
```

comparar editor e embed.

Esperado:

```text
ambos sem Play
```

Depois:

```text
showPlayButton = true
```

Esperado:

```text
ambos com Play
```

Repetir para pause thumbnail.

---

# 62. Falhou se

A milestone falhou se:

```text
configs antigas mudam visualmente

startup custom antiga perde o Play por default

pause custom antiga ganha Play por default

showPlayButton afeta provider thumbnail

showPlayButton afeta Background Autoplay CTA

esconder Play impede clicar na thumbnail

pause thumbnail deixa de ser clicável

Play aparece junto do "Continue assistindo" de forma incorreta

config desaparece após F5

substituir imagem perde a preferência do Play

editor e embed divergem

preview 9:16 continua parecendo 16:9

imagem é distorcida

custom startup sem Play continua artificialmente escurecida

redesign cria vários novos cards aninhados

ações ficam visualmente ambíguas

upload/storage sofre regressão

fade sofre regressão

playback sofre regressão
```

---

# Validação do agente

Executar:

```bash
pnpm typecheck
pnpm lint
pnpm build:embed
pnpm build
```

Não adicionar Playwright.

Não exigir browser automation.

Validar estaticamente:

```text
PlayerConfig possui ambos showPlayButton

defaults:
startup = true
pause = false

update schema aceita os dois campos

deep merge preserva os dois campos

upload/replace preserva escolha existente

remove startup reseta true

remove pause reseta false

loader/bootstrap transporta ambos os campos

provider thumbnail ignora showPlayButton

BG ON ignora startup showPlayButton

custom startup surface permanece clicável com Play OFF

custom pause surface permanece clicável com Play OFF

Continue assistindo fallback permanece intacto
```

Tiny Loader continua dentro do budget já estabelecido.

---

# Impacto no roadmap

Esta passa a ser a nova:

```text
Spec 050
```

O antigo item planejado:

```text
Full Headless Playback Engine Ownership
```

não chegou a existir como spec no repositório e deve passar a ser a próxima milestone depois desta.

A numeração futura deve ser atualizada nos documentos canônicos quando esta mudança for registrada.

Não implementar Headless Engine nesta milestone.

---

# Resultado final

## Startup custom

```text
Custom Thumbnail
       │
       ├── Play ON
       │      ↓
       │   [  ▶  ]
       │
       └── Play OFF
              ↓
           imagem limpa

qualquer caso:
clique na superfície
→ Play
```

## Pause custom

```text
Pause
  ↓
Custom Thumbnail
       │
       ├── Play ON
       │      ↓
       │   [  ▶  ]
       │
       └── Play OFF
              ↓
           imagem limpa

qualquer caso:
clique na superfície
→ Resume
```

E o editor passa a comunicar claramente:

```text
qual experiência está ativa
qual imagem está configurada
como trocar/remover
qual aspect ratio está sendo usado
se o Play será mostrado
```
