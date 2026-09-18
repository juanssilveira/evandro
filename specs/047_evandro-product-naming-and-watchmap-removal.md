# 047 — Evandro Product Naming & Complete WatchMap Removal

## Objetivo

Migrar definitivamente toda a nomenclatura ativa do projeto de `WatchMap` para a família oficial de produtos Evandro.

Esta milestone parte do estado sincronizado da Spec 046 e não precisa preservar compatibilidade com contratos WatchMap.

O produto ainda não possui usuários externos nem integração pública em produção que dependa desses nomes antigos.

Portanto:

```text
WatchMap
não é deprecated
não é alias
não é legacy suportado

WatchMap
é removido do código ativo
```

Ao final desta milestone, todo código novo e toda superfície ativa devem utilizar exclusivamente os nomes Evandro.

---

# 1. Família oficial de produtos

A nomenclatura oficial passa a ser:

```text
Evandro Watch
→ aplicação / plataforma

Evandro Player
→ player inteligente de vídeo

Evandro Tracker
→ tracking avançado de comportamento e playback

Evandro Intelligence
→ analytics, interpretação e inteligência baseada nos dados
```

Esses papéis devem permanecer semanticamente distintos.

---

# 2. Assinatura visual da aplicação

O logo atual:

```text
WatchMap
by Evandro Engine
```

passa a ser:

```text
Evandro Watch
by Evandro Intelligence
```

Essa alteração deve ocorrer no componente oficial de marca.

Arquivo atual relevante:

```text
src/components/brand/logo.tsx
```

A assinatura:

```text
by Evandro Intelligence
```

é uma decisão de branding.

Ela NÃO significa que as funcionalidades futuras completas do Evandro Intelligence já estejam implementadas.

Não alterar layout, tipografia, tamanhos ou estrutura visual do logo além do necessário para acomodar os novos textos.

---

# 3. O que esta spec muda

Esta spec altera:

```text
marca visual
nomes exibidos ao usuário
metadata
assets de marca
componentes TypeScript
nomes de arquivos
Custom Element do player
loader público
globais do embed
eventos públicos
performance marks
sessionStorage keys
logs
CSS/data attributes específicos da antiga marca
MIME types internos específicos da antiga marca
documentação ativa
AGENTS.md
package name
snippets de embed
```

---

# 4. O que esta spec NÃO muda

Não modificar nesta milestone:

```text
arquitetura de playback
Background Autoplay
preview
HLS lifecycle
Startup ABR
PlaybackController
PlayerRuntime
MediaLoadingStateManager
bootstrap
access/entitlement
tracking operacional
quota
provider Mux/Bunny
banco de dados, exceto se for encontrado identificador puramente nominal WatchMap realmente ativo
player UI
cores
design
fluxos de upload
fluxos de autenticação
planos
```

A próxima milestone tratará a nova Headless Player Engine.

Esta spec precisa permanecer funcionalmente neutra.

---

# 5. Regra de migração

NÃO executar substituição global cega.

A nomenclatura depende do domínio.

## Aplicação

Usar:

```text
Evandro Watch
evandro-watch
evandroWatch
EVANDRO_WATCH
```

quando o identificador representar a aplicação/plataforma.

## Player

Usar:

```text
Evandro Player
evandro-player
evandroPlayer
EVANDRO_PLAYER
ep:
```

quando o identificador representar player, embed, playback ou performance do player.

## Tracking avançado

Usar:

```text
Evandro Tracker
```

somente quando estiver se referindo conceitualmente ao produto futuro de tracking avançado.

O tracking operacional atual de quota/play NÃO deve ser renomeado conceitualmente como Evandro Tracker.

## Analytics/inteligência

Usar:

```text
Evandro Intelligence
```

para o produto/camada conceitual de analytics e inteligência.

Não descrever features ainda inexistentes como implementadas.

---

# 6. Prefixo `wm:`

O prefixo ativo:

```text
wm:
```

é removido.

Para métricas/eventos internos especificamente relacionados ao player utilizar:

```text
ep:
```

Exemplos:

```text
wm:loader:start
→ ep:loader:start

wm:bootstrap:start
→ ep:bootstrap:start

wm:manifest:parsed
→ ep:manifest:parsed

wm:first-frame
→ ep:first-frame
```

Não preservar dupla emissão.

Não emitir simultaneamente `wm:*` e `ep:*`.

---

# 7. Formas `watchmap_*`, `watch_map`, `watchmap-` e similares

Todo identificador ativo deve ser analisado semanticamente.

Exemplos de mapeamento:

```text
watchmap_player
→ evandro_player

watchmap-player
→ evandro-player

WatchMapPlayer
→ EvandroPlayer

WATCHMAP_PLAYER
→ EVANDRO_PLAYER

watchmap_video
→ evandro_watch_video
```

Não transformar nomes relacionados ao player em `evandro_watch_player`.

O nome oficial do player é:

```text
Evandro Player
```

---

# 8. Auditoria residual obrigatória

Antes de modificar código, executar localmente buscas case-insensitive por pelo menos:

```bash
rg -n -i \
  'watchmap|watch_map|watch-map|watchmap_|__watchmap|wm:|wm-|wm_|data-wm|x-watchmap' \
  . \
  --glob '!node_modules/**' \
  --glob '!.next/**' \
  --glob '!public/embed/v1/assets/**'
```

Mapear todas as ocorrências antes de iniciar a substituição.

Ao final, executar novamente.

Fora das specs históricas `001–046`, o objetivo é:

```text
0 ocorrências ativas de nomenclatura WatchMap
```

Exceção somente para nome REAL de infraestrutura externa que ainda exista oficialmente com esse nome e que não possa ser alterado apenas por código.

Nesse caso, documentar explicitamente a exceção.

---

# 9. Specs históricas

NÃO editar:

```text
specs/001_...
...
specs/046_...
```

apenas para trocar nomenclatura.

Esses arquivos representam o histórico do produto na época em que ainda se chamava WatchMap.

A Spec 047 passa a ser a autoridade para nomenclatura posterior.

Toda spec criada após a 047 utiliza apenas Evandro.

---

# 10. Player principal

Arquivo atual:

```text
src/components/player/watchmap-player.tsx
```

deve ser renomeado para:

```text
src/components/player/evandro-player.tsx
```

Renomear:

```ts
WatchMapPlayer
→ EvandroPlayer

WatchMapPlayerProps
→ EvandroPlayerProps
```

Todos os imports internos da aplicação devem ser atualizados.

NÃO criar:

```text
watchmap-player.tsx
```

como alias.

NÃO manter:

```ts
export const WatchMapPlayer = EvandroPlayer;
```

Não precisamos de compatibilidade.

---

# 11. Web Component

Arquivo atual:

```text
src/components/player/embed/watchmap-player-element.tsx
```

deve se tornar:

```text
src/components/player/embed/evandro-player-element.tsx
```

O Custom Element oficial passa de:

```html
<watchmap-player>
```

para:

```html
<evandro-player>
```

Remover completamente o registro:

```ts
customElements.define("watchmap-player", ...)
```

Apenas:

```ts
customElements.define("evandro-player", ...)
```

deve existir.

---

# 12. Loader público

Atualmente o build gera:

```text
public/embed/v1/watchmap-player.js
```

A partir desta spec deve gerar apenas:

```text
public/embed/v1/evandro-player.js
```

Modificar:

```text
scripts/build-embed.mjs
```

para utilizar o novo filename.

Remover do repositório:

```text
public/embed/v1/watchmap-player.js
```

O build não pode recriá-lo.

Se necessário, o build pode remover explicitamente output antigo para impedir artifact stale no workspace.

---

# 13. Snippet oficial de embed

Todo snippet gerado pela aplicação deve utilizar exclusivamente:

```html
<script src="https://cdn.evandro.watch/embed/v1/evandro-player.js"></script>
<evandro-player video-id="..."></evandro-player>
```

Nunca gerar:

```text
watchmap-player.js
<watchmap-player>
```

Atualizar especialmente:

```text
src/components/videos/video-embed-card.tsx
```

e quaisquer outros geradores de snippet encontrados na auditoria.

---

# 14. Loader compile-time globals

Renomear:

```text
__WATCHMAP_API_BASE__
→ __EVANDRO_PLAYER_API_BASE__

__WATCHMAP_CORE_FILENAME__
→ __EVANDRO_PLAYER_CORE_FILENAME__

__WATCHMAP_HLS_FILENAME__
→ __EVANDRO_PLAYER_HLS_FILENAME__
```

Atualizar tanto o código do loader quanto:

```text
scripts/build-embed.mjs
```

Nenhuma global `__WATCHMAP_*` deve permanecer ativa.

---

# 15. Runtime globals

Renomear registries ativos equivalentes a:

```text
window.__WATCHMAP_BOOTSTRAP__
→ window.__EVANDRO_PLAYER_BOOTSTRAP__

window.__WATCHMAP_CORE__
→ window.__EVANDRO_PLAYER_CORE__
```

E respectivos tipos:

```text
WatchMapBootstrapRegistry
→ EvandroPlayerBootstrapRegistry

WatchMapCoreRegistry
→ EvandroPlayerCoreRegistry
```

Não manter registries duplicados.

Não manter aliases.

---

# 16. Core mount

Arquivo:

```text
src/components/player/embed/player-core-entry.tsx
```

Renomear:

```ts
mountWatchMapPlayer
→ mountEvandroPlayer
```

E:

```ts
WatchMapCoreRegistry
→ EvandroPlayerCoreRegistry
```

O evento:

```text
watchmap:core-loaded
```

passa a ser:

```text
evandro-player:core-loaded
```

Não emitir os dois.

---

# 17. Bootstrap registry

Todo acesso atual equivalente a:

```ts
window.__WATCHMAP_BOOTSTRAP__
```

deve utilizar:

```ts
window.__EVANDRO_PLAYER_BOOTSTRAP__
```

Atualizar:

```text
loader-entry.ts
embed-player.tsx
```

e demais consumidores encontrados.

---

# 18. Eventos públicos do player

Eventos WatchMap existentes devem ser substituídos.

Exemplo:

```text
watchmap:performance
→ evandro-player:performance

watchmap:core-loaded
→ evandro-player:core-loaded
```

Para novos eventos futuros, manter o padrão:

```text
evandro-player:<event>
```

Não preservar aliases antigos.

---

# 19. Performance marks

Arquivo principal:

```text
src/components/player/embed/performance-timing.ts
```

Migrar todos:

```text
wm:*
```

para:

```text
ep:*
```

Incluindo tipos TypeScript.

Exemplos:

```text
wm:loader:start
→ ep:loader:start

wm:bootstrap:start
→ ep:bootstrap:start

wm:bootstrap:end
→ ep:bootstrap:end

wm:core:start
→ ep:core:start

wm:core:ready
→ ep:core:ready

wm:hls-engine:start
→ ep:hls-engine:start

wm:hls-engine:ready
→ ep:hls-engine:ready

wm:media:attach
→ ep:media:attach

wm:manifest:start
→ ep:manifest:start

wm:manifest:parsed
→ ep:manifest:parsed

wm:first-frag:start
→ ep:first-frag:start

wm:first-frag:loaded
→ ep:first-frag:loaded

wm:first-frag:buffered
→ ep:first-frag:buffered

wm:canplay
→ ep:canplay

wm:first-frame
→ ep:first-frame

wm:user-play
→ ep:user-play

wm:user-play-first-frame
→ ep:user-play-first-frame
```

Atualizar todos os callers.

---

# 20. Performance event

Em:

```text
performance-timing.ts
```

renomear:

```text
watchmap:performance
```

para:

```text
evandro-player:performance
```

Debug report:

```text
[WatchMap Performance]
```

passa a:

```text
[Evandro Player Performance]
```

---

# 21. Server-Timing

Procurar por identifiers como:

```text
wm-db
wm-bootstrap
```

ou equivalentes.

Se existirem, migrar para:

```text
ep-db
ep-bootstrap
```

Não manter aliases.

---

# 22. Startup ABR storage

Arquivo:

```text
src/components/player/embed/startup-abr.ts
```

Migrar:

```ts
BANDWIDTH_STORAGE_PREFIX =
"watchmap:hls-bandwidth:v1:"
```

para:

```ts
BANDWIDTH_STORAGE_PREFIX =
"evandro-player:hls-bandwidth:v1:"
```

Não ler a chave antiga como fallback.

Ainda não temos usuários externos para preservar esse estado.

O helper interno atualmente utiliza:

```text
https://watchmap.local
```

como base fictícia para `URL`.

Migrar para:

```text
https://evandro-player.local
```

ou base equivalente claramente interna.

---

# 23. Logs

Migrar logs ativos.

Exemplos:

```text
[WatchMap Player]
→ [Evandro Player]

[WatchMap HLS]
→ [Evandro Player HLS]

[WatchMap Embed]
→ [Evandro Player Embed]

[WatchMap Performance]
→ [Evandro Player Performance]

[WatchMap Player Runtime]
→ [Evandro Player Runtime]
```

Logs da aplicação, quando existirem, podem utilizar:

```text
[Evandro Watch]
```

Nenhum log novo deve ser criado apenas pela mudança de marca.

---

# 24. CSS e atributos internos

Auditar especialmente:

```text
src/components/player/embed/embed.css
src/components/player/embed/embed-styles.generated.css
src/components/player/watchmap-player.tsx
src/components/player/embed/loader-entry.ts
src/components/player/embed/player-core-entry.tsx
```

Migrar identificadores como:

```text
watchmap-*
wm-*
data-wm-*
```

para:

```text
evandro-player-*
data-evandro-player-*
```

Exemplos:

```text
watchmap-embed-root
→ evandro-player-embed-root

data-wm-shell
→ data-evandro-player-shell

data-wm-styles
→ data-evandro-player-styles
```

Para keyframes/class names relacionadas ao player, preferir:

```text
evandro-player-...
```

Não manter classes duplicadas.

Não alterar resultado visual.

---

# 25. CSS gerado

`embed-styles.generated.css` é artifact gerado.

Alterar a fonte correta e regenerar pelo pipeline existente.

Não fazer manutenção manual de longa duração no CSS gerado.

Depois de:

```bash
pnpm build:embed
```

o artifact deve refletir a nova nomenclatura.

---

# 26. Ícone da aplicação

Arquivo atual:

```text
src/components/brand/watchmap-icon.tsx
```

renomear para:

```text
src/components/brand/evandro-watch-icon.tsx
```

Componente:

```ts
WatchMapIcon
→ EvandroWatchIcon

WatchMapIconProps
→ EvandroWatchIconProps
```

Preservar o desenho atual nesta spec.

Não gerar novo símbolo.

---

# 27. Asset SVG

Renomear:

```text
public/brand/watchmap-icon.svg
```

para:

```text
public/brand/evandro-watch-icon.svg
```

Atualizar todos os consumidores:

```text
favicon
shortcut
apple icon
metadata
```

Não manter o asset antigo por compatibilidade.

---

# 28. Componente Logo

Arquivo:

```text
src/components/brand/logo.tsx
```

Atualizar import:

```ts
WatchMapIcon
→ EvandroWatchIcon
```

Título:

```text
WatchMap
→ Evandro Watch
```

Subtítulo:

```text
by Evandro Engine
→ by Evandro Intelligence
```

`aria-label`:

```text
WatchMap — Página Inicial
→ Evandro Watch — Página Inicial
```

Preservar:

```text
size API
showSubtitle API
href API
layout
tipografia
cores
ícone
```

---

# 29. Metadata

Arquivo:

```text
src/app/layout.tsx
```

Migrar:

```text
default title
title template
applicationName
Open Graph siteName
Open Graph title
Twitter title
icons
```

para:

```text
Evandro Watch
```

Exemplo:

```ts
title: {
  default: "Evandro Watch",
  template: "%s | Evandro Watch",
}
```

Não transformar todo texto da descrição em marketing novo nesta spec.

A descrição atual pode ser mantida se semanticamente correta.

---

# 30. Auth e aplicação

Auditar todos os textos visíveis em:

```text
src/app/(auth)/
src/components/auth/
src/components/app-header.tsx
src/components/settings/
src/components/videos/
src/app/dev/
src/components/dev/
```

Qualquer referência a:

```text
WatchMap
Evandro Engine
```

deve ser atualizada para o produto correto.

Não alterar textos sem relação com branding.

---

# 31. Página /dev

O painel `/dev` também deve apresentar a nova marca.

Não alterar funcionalidades administrativas.

Logs ou labels internos devem diferenciar:

```text
Evandro Watch
Evandro Player
```

conforme o contexto.

---

# 32. MIME types específicos da aplicação

Auditar por tipos equivalentes a:

```text
application/x-watchmap-video
```

Se existirem, migrar para:

```text
application/x-evandro-watch-video
```

Não aceitar o MIME antigo.

Não manter compatibilidade.

---

# 33. Identificadores `watchmap_` e `watch_map`

Qualquer:

```text
watchmap_
watch_map
```

encontrado no código ativo deve ser avaliado.

Se representar player:

```text
→ evandro_player
```

Se representar aplicação:

```text
→ evandro_watch
```

Não substituir por simplesmente:

```text
evandro_
```

quando isso remover contexto útil.

---

# 34. Database / schema

Não esperamos migration de banco nesta milestone.

Porém a auditoria deve procurar:

```text
watchmap
watch_map
watchmap_
```

dentro de:

```text
src/db/
drizzle/
```

Se houver apenas nomes de indexes, constraints ou labels internos não necessários para a mudança de produto, NÃO criar migration só por estética sem justificar.

Se houver algum valor persistido ou identifier funcional que faça parte diretamente do contrato ativo WatchMap, reportar antes de alterar schema.

A intenção desta spec é branding + código ativo, não uma migration cosmética do banco.

---

# 35. Package

Migrar em:

```text
package.json
```

de:

```json
"name": "watchmap-beta"
```

para:

```json
"name": "evandro-watch"
```

Atualizar lockfile conforme o package manager fizer necessário.

Não alterar versão.

---

# 36. Build report

Em:

```text
scripts/build-embed.mjs
```

migrar:

```text
WATCHMAP PLAYER EMBED BUILD REPORT
```

para:

```text
EVANDRO PLAYER EMBED BUILD REPORT
```

Também migrar qualquer log semelhante.

---

# 37. Build output

Resultado esperado:

```text
public/embed/v1/
├── evandro-player.js
└── assets/
    ├── player-core-[hash].js
    └── HLS chunk(s)
```

Não deve existir:

```text
watchmap-player.js
```

depois de build limpo.

---

# 38. Tiny Loader

O Tiny Loader continua com budget:

```text
<= 25 KB
```

A mudança de nomenclatura não pode quebrar o split atual:

```text
Tiny Loader
Player Core
HLS.js chunk
```

Não trazer HLS.js ou React para dentro do loader.

---

# 39. Embed architecture

Não mudar funcionamento introduzido pelas Specs 045 e 046.

Continuar:

```text
loader pequeno
bootstrap antecipado
Core separado
HLS separado
HLS.js warmed cedo em browsers MSE
Native HLS no Safari
Startup ABR
bandwidth memory
```

Apenas nomes mudam.

---

# 40. Player behavior

Background Autoplay deve continuar exatamente como está na Spec 046.

NÃO tentar corrigir nesta spec:

```text
thumbnail → preview
startup visual
preview latency
arquitetura headless
```

Esses problemas serão tratados na próxima milestone.

Isso é proposital para isolarmos regressões da migração de nome.

---

# 41. Tracking operacional

Preservar completamente:

```text
/api/embed/videos/[publicId]/activate
play_sessions
monthly_usage
quota
isEditor exemption
```

Não renomear esse sistema para:

```text
Evandro Tracker
```

O Evandro Tracker representa nosso tracking avançado futuro.

---

# 42. Evandro Tracker

Atualizar documentação conceitual para definir:

```text
Evandro Tracker
=
sistema futuro de tracking avançado de comportamento
```

Ele poderá futuramente consumir eventos produzidos pelo Evandro Player.

Não implementar nesta spec.

Não criar:

```text
tracker runtime
tracker endpoint
tracker tables
```

---

# 43. Evandro Intelligence

Atualizar documentação conceitual para definir:

```text
Evandro Intelligence
=
camada futura de analytics, interpretação e inteligência sobre os dados
```

Ela poderá futuramente consumir os dados coletados pelo Evandro Tracker.

Não implementar nesta spec.

A utilização visual:

```text
Evandro Watch
by Evandro Intelligence
```

é branding e não deve criar arquitetura inexistente.

---

# 44. Arquitetura conceitual da família

Atualizar `docs/00-PRODUCT.md` para algo conceitualmente equivalente a:

```text
EVANDRO WATCH
│
├── Aplicação
│   ├── contas
│   ├── vídeos
│   ├── configurações
│   └── gestão
│
├── EVANDRO PLAYER
│   └── reprodução inteligente
│
├── EVANDRO TRACKER
│   └── tracking avançado
│       [planejado]
│
└── EVANDRO INTELLIGENCE
    └── analytics + inteligência
        [planejado]
```

Deixar explícito o que já existe e o que ainda é planejado.

---

# 45. Documentação ativa

Auditar integralmente os documentos existentes atualmente:

```text
docs/00-PRODUCT.md
docs/01-ARCHITECTURE.md
docs/02-MODEL.md
docs/03-DESIGN.md
docs/DATABASE.md
docs/DEPLOYMENT-CDN.md
docs/ENVIRONMENTS.md
docs/WORKFLOW.md
```

Atualizar nomenclatura ativa quando aplicável.

Não inventar novos subsistemas.

---

# 46. `AGENTS.md`

Atualizar:

```text
# WatchMap — Agent Instructions
```

para:

```text
# Evandro Watch — Agent Instructions
```

E toda instrução ativa que trate o produto como WatchMap.

Adicionar uma seção curta com a nomenclatura oficial:

```text
Evandro Watch
Evandro Player
Evandro Tracker
Evandro Intelligence
```

Orientar agentes futuros a não introduzirem novamente:

```text
WatchMap
wm:
watchmap_
watch_map
```

em código novo.

---

# 47. Infraestrutura externa

Não renomear automaticamente recursos remotos nesta spec.

Domínios atuais já permanecem:

```text
app.evandro.watch
cdn.evandro.watch
```

Se algum projeto externo real ainda possuir nome WatchMap, como projeto Vercel antigo, não fazer alteração externa automaticamente.

No código/documentação, mencionar o nome real apenas quando necessário para operação.

A mudança de branding não deve quebrar infraestrutura funcionando.

---

# 48. Repositório

O repositório:

```text
juanssilveira/evandro.watch
```

já utiliza nomenclatura correta.

Não alterá-lo.

---

# 49. APIs públicas

Rotas como:

```text
/api/embed/videos/...
```

não precisam de rename porque não carregam WatchMap no path.

Não alterar URLs neutras.

---

# 50. Configuração PlayerConfig

Não alterar schema/configuração apenas por essa migração se os campos forem neutros.

Exemplo:

```text
backgroundAutoplay
defaultVolume
defaultPlaybackRate
```

permanecem iguais.

---

# 51. Nomes genéricos permanecem genéricos

Não transformar:

```text
PlayerRuntime
PlaybackController
PlayerConfig
EmbedPlayer
```

em nomes com Evandro apenas por branding quando já são claros dentro do módulo.

Renomear apenas identifiers WatchMap-specific.

Evitar mudanças cosméticas sem ganho.

---

# 52. Testes automáticos / CLI

Não exigir navegador.

Não adicionar framework de browser.

Executar as validações normais do projeto:

```bash
pnpm typecheck
pnpm lint
pnpm build:embed
pnpm build
```

Além disso, executar auditoria residual com `rg`.

---

# 53. Validação do build embed

Após:

```bash
pnpm build:embed
```

confirmar:

```text
public/embed/v1/evandro-player.js existe
public/embed/v1/watchmap-player.js NÃO existe
```

Confirmar que o loader continua:

```text
<= 25 KB
```

Registrar no walkthrough:

```text
Tiny Loader size
Player Core size
HLS chunk size
```

---

# 54. Validação estrutural do loader

Confirmar por inspeção estática que:

```text
<evandro-player>
```

é registrado.

Confirmar ausência de:

```text
<watchmap-player>
```

no runtime ativo.

Confirmar que:

```text
__EVANDRO_PLAYER_BOOTSTRAP__
__EVANDRO_PLAYER_CORE__
```

são os registries utilizados.

---

# 55. Validação dos performance marks

Confirmar ausência ativa de:

```text
wm:
```

fora das specs históricas.

Confirmar existência de:

```text
ep:
```

nos mesmos pontos instrumentados anteriormente.

---

# 56. Validação da bandwidth memory

Confirmar que:

```text
evandro-player:hls-bandwidth:v1:
```

é a única chave utilizada pelo Startup ABR.

Não carregar chave WatchMap antiga.

---

# 57. Seu resultado visual esperado

Depois de implementar esta spec, você deve perceber:

```text
ANTES

[ícone] WatchMap
        by Evandro Engine
```

virando:

```text
DEPOIS

[mesmo ícone] Evandro Watch
              by Evandro Intelligence
```

Isso deve aparecer de forma consistente em:

```text
login
cadastro
header da aplicação
demais lugares que reutilizam o Logo
metadata/título da aba
```

O visual do produto deve continuar praticamente idêntico.

---

# 58. O que visualmente NÃO deve mudar

Não deve mudar:

```text
ícone
paleta
tipografia
espaçamento geral
header
cards
biblioteca
editor
player
controles do player
background autoplay
thumbnail
preview
loading
progress bar
settings
```

Qualquer alteração significativa de layout ou comportamento é regressão desta spec.

---

# 59. Seu critério manual de teste

Após o agente concluir:

## Teste 1 — Login

Abrir:

```text
/login
```

Esperado:

```text
Evandro Watch
by Evandro Intelligence
```

Não pode existir `WatchMap`.

---

## Teste 2 — Cadastro

Abrir:

```text
/signup
```

Mesmo branding.

---

## Teste 3 — Aplicação

Entrar na plataforma.

Header deve exibir:

```text
Evandro Watch
by Evandro Intelligence
```

Navegação deve funcionar exatamente como antes.

---

## Teste 4 — Aba do navegador

Título deve utilizar:

```text
Evandro Watch
```

e não:

```text
WatchMap
```

---

## Teste 5 — Player no editor

Abrir um vídeo.

Esperado:

```text
player visualmente igual à Spec 046
playback igual
autoplay igual
controles iguais
```

Essa spec NÃO deve corrigir ainda o problema thumbnail → preview.

---

## Teste 6 — Código de embed

Abrir a área onde copiamos o embed.

Esperado:

```html
<script src=".../embed/v1/evandro-player.js"></script>
<evandro-player video-id="..."></evandro-player>
```

Não pode existir:

```text
watchmap-player.js
<watchmap-player>
```

---

## Teste 7 — Embed

Utilizar o novo snippet.

O player deve carregar e reproduzir exatamente como carregava antes da migração.

---

## Teste 8 — Console com debug

Quando debug estiver ativo, logs devem utilizar:

```text
Evandro Player
```

Exemplos:

```text
[Evandro Player HLS]
[Evandro Player Performance]
```

Não:

```text
[WatchMap ...]
```

---

# 60. Falhou se

A milestone falhou se qualquer um destes casos ocorrer:

```text
WatchMap aparece na interface ativa

"by Evandro Engine" ainda aparece

watchmap-player.js ainda é gerado

snippet ainda usa <watchmap-player>

player deixa de carregar

embed quebra

HLS deixa de funcionar

Background Autoplay muda de comportamento

Startup ABR muda de comportamento

tracking/quota muda

layout sofre alteração perceptível sem necessidade

wm:* continua sendo emitido pelo runtime ativo

globals __WATCHMAP_* permanecem no runtime ativo

sessionStorage continua gravando watchmap:hls-bandwidth

aliases WatchMap são preservados sem necessidade
```

---

# 61. Resultado técnico esperado

Antes:

```text
WatchMap
├── WatchMapPlayer
├── <watchmap-player>
├── watchmap-player.js
├── __WATCHMAP_*
├── window.__WATCHMAP_*
├── watchmap:*
├── wm:*
├── watchmap:hls-bandwidth
└── WatchMapIcon
```

Depois:

```text
Evandro Watch
├── Evandro Player
│   ├── EvandroPlayer
│   ├── <evandro-player>
│   ├── evandro-player.js
│   ├── __EVANDRO_PLAYER_*
│   ├── window.__EVANDRO_PLAYER_*
│   ├── evandro-player:*
│   ├── ep:*
│   └── evandro-player:hls-bandwidth
│
├── Evandro Tracker
│   └── planned
│
└── Evandro Intelligence
    └── planned
```

---

# 62. Commit

Após implementação e validação:

```text
spec(047): canonicalize Evandro product naming
```

Push somente:

```text
origin development
```

Não promover para `main`.

---

# Critérios de aceite

* [ ] Aplicação apresentada como `Evandro Watch`.
* [ ] Player apresentado como `Evandro Player`.
* [ ] Logo mostra `Evandro Watch`.
* [ ] Logo mostra subtítulo `by Evandro Intelligence`.
* [ ] Ícone visual foi preservado.
* [ ] `WatchMapPlayer` foi substituído por `EvandroPlayer`.
* [ ] `watchmap-player.tsx` não existe mais no código ativo.
* [ ] `watchmap-player-element.tsx` não existe mais.
* [ ] `<evandro-player>` é o único Custom Element oficial.
* [ ] `<watchmap-player>` não é registrado.
* [ ] `/embed/v1/evandro-player.js` é o único loader oficial.
* [ ] `/embed/v1/watchmap-player.js` não é mais produzido.
* [ ] Snippet da UI utiliza apenas o novo contrato.
* [ ] `__WATCHMAP_*` não existe mais no runtime ativo.
* [ ] `window.__WATCHMAP_*` não existe mais no runtime ativo.
* [ ] `watchmap:*` não existe mais no runtime ativo.
* [ ] `wm:*` foi substituído por `ep:*`.
* [ ] `watchmap:hls-bandwidth:v1:` foi substituído por `evandro-player:hls-bandwidth:v1:`.
* [ ] `WatchMapIcon` virou `EvandroWatchIcon`.
* [ ] `/brand/watchmap-icon.svg` foi removido.
* [ ] `/brand/evandro-watch-icon.svg` existe.
* [ ] Metadata utiliza `Evandro Watch`.
* [ ] Package chama-se `evandro-watch`.
* [ ] Logs utilizam `Evandro Watch` ou `Evandro Player` conforme o contexto.
* [ ] CSS/data attributes WatchMap específicos foram removidos.
* [ ] MIME types WatchMap específicos foram removidos quando encontrados.
* [ ] `Evandro Tracker` está documentado como futuro tracking avançado.
* [ ] tracking operacional atual NÃO foi rotulado como Evandro Tracker.
* [ ] `Evandro Intelligence` está documentado corretamente.
* [ ] assinatura visual `by Evandro Intelligence` não é apresentada como claim técnico de feature implementada.
* [ ] Specs históricas 001–046 não foram reescritas.
* [ ] AGENTS.md foi atualizado.
* [ ] documentação ativa foi atualizada.
* [ ] não houve mudança funcional de player.
* [ ] não houve mudança de banco desnecessária.
* [ ] Tiny Loader permanece `<= 25 KB`.
* [ ] Core/HLS continuam separados.
* [ ] `pnpm typecheck` passa.
* [ ] `pnpm lint` passa.
* [ ] `pnpm build:embed` passa.
* [ ] `pnpm build` passa.
* [ ] busca residual não encontra nomenclatura WatchMap ativa fora do histórico/exceções justificadas.
