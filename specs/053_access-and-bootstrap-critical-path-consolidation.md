# 1. Nome da spec

Spec 053 — Access & Bootstrap Critical Path Consolidation

Arquivo sugerido:

053_access-and-bootstrap-critical-path-consolidation.md

Status inicial:

awaiting manual validation


# 2. Spec em si

## Objetivo

Consolidar e simplificar o caminho crítico entre:

<evandro-player>
→ Tiny Loader
→ GET /api/embed/videos/:publicId
→ decisão de acesso
→ descriptor do player
→ PlayerEngine
→ provider CDN
→ mídia

sem enfraquecer as regras atuais de acesso e sem reintroduzir autorização no clique de Play.

A Spec 053 não parte da premissa de que o bootstrap atual está ruim.

A auditoria do código atual confirmou que várias otimizações planejadas historicamente já foram implementadas:

- existe apenas um bootstrap request por carga normal;
- o bootstrap utiliza uma query DB consolidada;
- o public bootstrap não chama Mux/Bunny API;
- playbackUrl é derivada localmente;
- Tiny Loader inicia bootstrap antecipadamente;
- Player Core e PlayerEngine carregam em paralelo;
- /activate não bloqueia o playback;
- mídia continua entregue diretamente pelo provider.

Portanto esta milestone deve consolidar a arquitetura existente, remover complexidade histórica residual e garantir que existe apenas um caminho canônico de access/startup.

==================================================
1. REGRA ARQUITETURAL CENTRAL
==================================================

A regra continua sendo:

LOAD
=
access
+
limits
+
media preparation

PLAY
=
video.play()
+
tracking assíncrono

Nunca voltar para:

Play
→ backend
→ autorização
→ esperar playback URL
→ attach HLS
→ tocar

O primeiro Play não pode depender de round-trip para o backend.

==================================================
2. ESTADO ATUAL DO BOOTSTRAP
==================================================

O endpoint público atual é:

GET /api/embed/videos/[publicId]

e utiliza:

resolveEmbedBootstrap(publicId)

O resolver atual executa uma query consolidada envolvendo:

- vídeo;
- account;
- owner;
- subscription;
- monthly usage;
- player settings.

Depois valida:

- vídeo existe;
- account está ativa;
- owner existe;
- subscription está ativa;
- subscription não expirou;
- quota mensal ainda permite novo player;
- vídeo está ready;
- playback URL pode ser derivada.

Somente depois retorna:

- videoId público;
- title;
- duration;
- playbackUrl;
- playback descriptor;
- posterUrl;
- backgroundPreviewUrl;
- config.

Esse fluxo é a base desta spec.

==================================================
3. AUTORIDADE CANÔNICA
==================================================

Depois da 053 deve existir uma resposta clara para:

"Quem decide se o embed pode receber o descriptor necessário para preparar mídia?"

Resposta:

resolveEmbedBootstrap()

ou uma abstração equivalente única e canônica.

Não devem existir múltiplos caminhos internos concorrendo pela mesma decisão de access.

Auditar especialmente helpers históricos em:

src/lib/plans/playback.ts

como:

- resolvePlaybackEntitlement
- canLoadPlayback
- validateAndActivatePlayback
- recordPlaybackSession

Para cada helper:

1. localizar callers reais;
2. identificar se ainda participa de algum fluxo ativo;
3. remover se estiver comprovadamente sem uso;
4. se houver caller, migrar/consolidar antes de remover.

Não remover apenas porque parece legado.

Resultado desejado:

public embed access
→ uma autoridade canônica

first Play tracking
→ uma autoridade canônica

==================================================
4. BOOTSTRAP CONTINUA SENDO O ACCESS GATE
==================================================

Antes de liberar playbackUrl, continuar validando:

video
→ account ativa
→ owner
→ subscription ativa e não expirada
→ quota disponível
→ video ready
→ playback descriptor válido

Não remover nenhuma dessas regras nesta spec.

Em especial:

quota continua sendo gate de LOAD.

A arquitetura aceita da Spec 038 define:

playsThisMonth < maxPlaysPerMonth

antes da liberação da mídia.

A 053 não deve alterar essa semântica comercial como efeito colateral de uma otimização.

Se essa regra mudar futuramente, deve existir decisão explícita para isso.

==================================================
5. NÃO CRIAR SEGUNDA FASE HTTP
==================================================

Não transformar o fluxo em:

GET /access
→ GET /media
→ HLS

ou qualquer variação equivalente.

Isso adicionaria outro RTT antes da preparação da mídia.

A separação conceitual pode existir internamente no backend, mas para o browser o fluxo deve continuar sendo:

1 request HTTP
→ resultado completo autorizado

==================================================
6. HAPPY PATH
==================================================

Target arquitetural:

1 bootstrap HTTP
1 query DB principal
0 chamadas Mux/Bunny API
1 descriptor autorizado
→ PlayerEngine

Não sacrificar esse modelo.

==================================================
7. QUERY CONSOLIDADA
==================================================

Preservar o modelo atual de query consolidada.

Não voltar para:

query video
→ query account
→ query owner
→ query subscription
→ query usage
→ query config

sequencialmente.

A query pode ser refinada se houver melhoria clara de:

- legibilidade;
- correção;
- plano de execução;
- redução de campos desnecessários.

Não fazer micro-otimização SQL sem evidência.

==================================================
8. ÍNDICES
==================================================

Auditar os índices utilizados no bootstrap.

Já existem índices relevantes como:

videos.public_id
account_members.account_id
subscriptions(user_id, status)
monthly_usage(user_id, period_key)
video_player_settings.video_id

Adicionar migration/index somente se existir gap real.

Não criar índices redundantes apenas "por segurança".

Se schema mudar:

pnpm db:generate
pnpm db:migrate

==================================================
9. SUBSCRIPTION
==================================================

Preservar a semântica atual:

status = active

e:

expiresAt IS NULL
ou
expiresAt > now

Quando existirem múltiplas subscriptions válidas/históricas, preservar a escolha da subscription ativa mais recente conforme regra atual.

Não permitir que uma subscription expirada ou antiga seja escolhida acidentalmente.

==================================================
10. QUOTA
==================================================

Quota no bootstrap continua read-only.

Bootstrap NÃO deve:

- criar play session;
- incrementar monthly_usage;
- reservar quota;
- adquirir lock;
- registrar Play.

Regra:

currentPlays < maxPlays

A pequena race já aceita continua aceita.

Exemplo:

4999 / 5000

duas páginas carregam quase simultaneamente

ambas podem passar

Esse caso não deve gerar arquitetura de reservation/locking nesta spec.

==================================================
11. PLAY TRACKING
==================================================

POST /api/embed/videos/[publicId]/activate

continua existindo.

Conceitualmente ele é tracking de primeiro Play.

Responsabilidades:

- registrar playSession;
- incrementar monthly usage quando aplicável;
- manter idempotência;
- respeitar isenção válida do editor.

Não deve:

- fornecer a única playback URL;
- bloquear video.play();
- controlar HLS attach;
- decidir se mídia pode começar;
- reconstruir o entitlement do LOAD no caminho crítico do clique.

Falha no tracking não pode parar playback já autorizado.

==================================================
12. NOME /activate
==================================================

Não é necessário renomear endpoint nesta spec.

Mesmo que semanticamente hoje ele represente mais "record play" do que "activate playback", mudar endpoint público agora adicionaria churn sem ganho relevante.

Pode manter o nome atual.

Documentar sua responsabilidade real.

==================================================
13. PROVIDER API
==================================================

Public bootstrap nunca deve chamar:

- Mux API;
- Bunny API.

Video status/provider IDs necessários devem estar persistidos no DB antes do espectador chegar.

Landing page do espectador nunca deve ser mecanismo de sync de provider.

==================================================
14. PLAYBACK URL
==================================================

Continuar derivando a URL localmente através do provider adapter.

Mux:

https://stream.mux.com/{playbackId}.m3u8

Bunny:

usar helper/provider atual correspondente.

Nenhuma chamada externa deve ser necessária para montar a URL.

==================================================
15. PROVIDER NEUTRALITY
==================================================

A arquitetura de access deve ser independente do provider.

Não criar:

if provider === "mux"
→ regra de acesso A

if provider === "bunny"
→ regra de acesso B

Access é responsabilidade do Evandro Watch.

O provider adapter cuida somente de:

- playback URL;
- poster;
- background preview;
- operações administrativas de vídeo.

==================================================
16. NÃO REINTRODUZIR SIGNED PLAYBACK
==================================================

A decisão histórica atual continua válida.

Não adicionar:

- Mux Signed Playback;
- JWT;
- playback token;
- signing key;
- token TTL;
- thumbnail token.

A arquitetura atual aceita application-level access control.

Essa limitação é consciente.

Depois que um visitante autorizado recebe uma URL pública do provider, a URL não possui proteção criptográfica CDN-level.

Não tentar resolver isso nesta spec.

==================================================
17. ENTREGA DIRETA
==================================================

Continuar:

browser
→ Mux/Bunny CDN

Não:

browser
→ Evandro Watch
→ proxy de bytes
→ provider

Evandro não deve proxyar:

- manifests;
- segments;
- vídeos;
- bytes HLS.

==================================================
18. CACHE DO BOOTSTRAP
==================================================

Bootstrap depende de dados mutáveis:

- account status;
- subscription;
- expiration;
- quota;
- video status;
- player config.

Continuar retornando:

Cache-Control:
private, no-cache, no-store, must-revalidate

Não adicionar:

- CDN cache público;
- Redis entitlement cache;
- KV entitlement cache;
- localStorage de autorização;
- service worker de autorização;
- stale access cache.

==================================================
19. CACHE DA MESMA PÁGINA
==================================================

O registry em memória:

window.__EVANDRO_PLAYER_BOOTSTRAP__

continua permitido.

Preservar:

map
resolved

Ele serve apenas para deduplicar trabalho dentro da mesma carga de página.

Isso não é cache persistente de autorização.

==================================================
20. RETRY
==================================================

Auditar comportamento de Promise rejeitada no registry.

Uma falha de bootstrap não pode deixar:

map[cacheKey] = rejectedPromise

de forma permanente.

Retry precisa gerar uma nova request real.

Garantir fluxo equivalente a:

bootstrap falha
→ cache rejeitado é removido ou ignorado no Retry
→ usuário clica Tentar novamente
→ novo GET ocorre

Não reutilizar indefinidamente Promise rejeitada.

==================================================
21. TINY LOADER X CORE
==================================================

Parte da lógica existe tanto no Tiny Loader quanto no React Core.

Exemplos:

- bootstrap handling;
- erro 403/404;
- provider preconnect;
- visual preload;
- parsing do payload.

A 053 deve reduzir divergência conceitual quando possível.

Porém:

não aumentar significativamente o Tiny Loader apenas para ficar "DRY".

Regra:

Tiny Loader
→ somente critical path

Core
→ UI / fallback / retry / rendering

Performance tem prioridade sobre abstração estética.

==================================================
22. CONTRATO DE BOOTSTRAP
==================================================

Hoje existem shapes semelhantes em vários locais.

Exemplos:

BootstrapVideoData
BootstrapResponsePayload
EmbedBootstrapResolution.data

Criar, se tecnicamente leve, um contrato compartilhado equivalente a:

EmbedBootstrapPayload

Campos canônicos:

- videoId;
- title;
- duration;
- playbackUrl ou playback;
- posterUrl;
- backgroundPreviewUrl;
- config.

Não puxar dependências pesadas para o Tiny Loader.

Pode ser um módulo somente de tipos extremamente leve.

==================================================
23. VIDEO ID PÚBLICO
==================================================

Preservar distinção entre:

videos.id
=
UUID interno

e:

videos.publicId
=
ID utilizado pelo embed

O payload público não deve vazar UUID interno sem necessidade.

Se o campo chamado videoId continuar representando publicId por compatibilidade, documentar isso claramente.

==================================================
24. PAYLOAD
==================================================

Auditar campos realmente usados pelo Loader/Core.

Pode remover campo sem uso somente se:

- não existe consumer ativo;
- não quebra embed legado;
- não gera segundo request posteriormente.

Não otimizar poucos bytes de JSON criando complexidade.

==================================================
25. R2 E CUSTOM ASSETS
==================================================

Preservar resolução server-side de URLs absolutas para:

- custom startup thumbnail;
- custom pause thumbnail;
- background preview derivado.

Não criar outro endpoint para obter essas URLs.

Não alterar upload para R2 nesta spec.

==================================================
26. SERVER TIMING
==================================================

Preservar:

Server-Timing

atual com:

ep-db
ep-bootstrap

Pode melhorar breakdown se for barato e útil.

Exemplo opcional:

ep-access
ep-payload

Somente se isso não introduzir trabalho adicional relevante.

Não criar telemetry remota.

==================================================
27. PERFORMANCE MARKS
==================================================

Preservar:

ep:bootstrap:start
ep:bootstrap:end

e integração atual com Performance API.

Não quebrar o relatório de performance existente do player.

==================================================
28. DADOS SENSÍVEIS
==================================================

Não expor em logs do browser ou resposta pública:

- ownerUserId;
- subscription ID;
- subscription expiration;
- quota utilizada;
- max quota;
- account internal ID;
- provider credentials.

==================================================
29. ERROR SEMANTICS
==================================================

Falhas comerciais devem continuar usando resposta genérica.

Exemplo:

"Este vídeo está temporariamente indisponível."

Não revelar ao visitante:

- sua assinatura expirou;
- quota esgotada;
- account desativada;
- plano inexistente.

==================================================
30. VÍDEO NÃO ENCONTRADO
==================================================

Vídeo inexistente pode continuar retornando 404 apropriado.

Vídeo processing/not ready pode continuar retornando indisponibilidade conforme comportamento atual.

Não revelar IDs/provider internals.

==================================================
31. PERSISTENT RESUME
==================================================

Persistent Resume nunca é autorização.

Fluxo correto:

saved resume local
+
bootstrap autorizado
→ Engine recebe playbackUrl + resumePosition

Se:

saved resume existe
+
bootstrap retorna 403

Resultado:

- nenhuma mídia é anexada;
- Resume não toca;
- localStorage não bypassa access.

Preservar integralmente a Spec 052.

==================================================
32. BACKGROUND AUTOPLAY
==================================================

Background Autoplay continua dependendo do bootstrap autorizado.

Fluxo:

bootstrap
→ descriptor
→ Engine
→ background autoplay

Não adicionar segunda request entre bootstrap e background autoplay.

==================================================
33. STARTUP THUMBNAILS
==================================================

Thumbnail e Background Preview continuam vindo do mesmo bootstrap autorizado.

Não criar endpoint visual separado.

Não alterar lifecycle das Specs 051/052.

==================================================
34. PLAYER ENGINE
==================================================

Não alterar o modelo de ownership.

Continuam obrigatórios:

1 HTMLVideoElement
1 PlayerEngine
1 source owner
1 lifecycle principal HLS

A 053 não é uma spec de PlayerEngine.

==================================================
35. O QUE DEVE MUDAR
==================================================

Esperado nesta milestone:

- tornar resolveEmbedBootstrap explicitamente a autoridade canônica do LOAD access;
- auditar e remover helpers históricos comprovadamente sem uso;
- consolidar access e tracking em responsabilidades claras;
- reduzir duplicação de contratos TypeScript de bootstrap quando leve;
- corrigir handling de Promise rejeitada/retry se necessário;
- auditar índices reais;
- manter/melhorar Server-Timing;
- documentar definitivamente:

LOAD = access + media preparation

PLAY = playback + tracking async

==================================================
36. O QUE NÃO DEVE MUDAR
==================================================

Não alterar:

- visual do player;
- Persistent Resume;
- Resume Overlay;
- Fake Progress;
- Startup Thumbnail;
- Pause Thumbnail;
- play button;
- Background Autoplay;
- HLS ABR;
- PlayerEngine;
- provider selection;
- uploads;
- R2;
- Mux/Bunny admin lifecycle;
- plan catalog;
- quota limits;
- definição de Play;
- account ownership;
- billing;
- Delivery/Edge;
- Tracker.

==================================================
37. PROIBIDO NESTA SPEC
==================================================

Não implementar:

- Redis;
- KV;
- edge entitlement cache;
- CDN bootstrap cache;
- signed playback;
- JWT;
- HLS proxy;
- service worker;
- endpoint /access;
- endpoint /media;
- GraphQL;
- tRPC;
- queue;
- background worker;
- nova state library.

==================================================
38. CENÁRIO A — PLANO ATIVO + READY
==================================================

Esperado:

GET bootstrap
→ 200
→ descriptor completo
→ PlayerEngine prepara mídia
→ primeiro Play imediato

Apenas um bootstrap.

==================================================
39. CENÁRIO B — SEM PLANO
==================================================

Esperado:

bootstrap
→ 403
→ nenhuma playbackUrl
→ nenhuma conexão HLS

==================================================
40. CENÁRIO C — PLANO EXPIRADO
==================================================

Esperado:

403

Nenhuma mídia.

==================================================
41. CENÁRIO D — ACCOUNT DISABLED
==================================================

Esperado:

403

Nenhuma mídia.

==================================================
42. CENÁRIO E — QUOTA ESGOTADA
==================================================

Esperado:

bootstrap
→ 403
→ nenhuma playbackUrl
→ nenhum attach HLS

==================================================
43. CENÁRIO F — VIDEO PROCESSING
==================================================

Com plano válido:

bootstrap
→ vídeo indisponível/not ready
→ nenhuma mídia

Sem plano:

bootstrap
→ continua bloqueado comercialmente
→ nenhuma mídia

Não expor motivo comercial específico.

==================================================
44. CENÁRIO G — MUX
==================================================

Confirmar:

- bootstrap não chama Mux API;
- URL é derivada localmente;
- browser acessa Mux diretamente.

==================================================
45. CENÁRIO H — BUNNY
==================================================

Confirmar:

- bootstrap não chama Bunny API;
- URL é derivada localmente;
- browser acessa Bunny diretamente.

==================================================
46. CENÁRIO I — PRIMEIRO PLAY
==================================================

Com player já autorizado:

click
→ video.play()

Não deve existir backend request bloqueando o início visual.

POST /activate pode acontecer em background.

==================================================
47. CENÁRIO J — TRACKING FALHA
==================================================

Simular falha em /activate.

Esperado:

- playback continua;
- usuário não é interrompido;
- HLS não é destruído;
- source não muda.

==================================================
48. CENÁRIO K — RETRY
==================================================

Forçar bootstrap a falhar.

Clicar:

Tentar novamente

Esperado:

- nova request GET;
- Promise rejeitada antiga não é reutilizada;
- player pode recuperar.

==================================================
49. CENÁRIO L — RESUME
==================================================

Histórico válido + acesso válido:

Resume funciona normalmente.

Histórico válido + bootstrap 403:

- Resume não toca mídia;
- nenhuma playbackUrl;
- nenhum bypass.

==================================================
50. CENÁRIO M — BACKGROUND AUTOPLAY
==================================================

Plano ativo:

background autoplay continua normal.

Plano inválido:

nenhuma mídia inicia.

==================================================
51. CENÁRIO N — MULTIPLE PLAYERS
==================================================

Com dois embeds na mesma página:

- Player Core compartilhado;
- HLS module compartilhado quando aplicável;
- um bootstrap por videoId;
- nenhum resultado de vídeo A utilizado pelo vídeo B;
- nenhuma duplicação de global runtime desnecessária.

==================================================
52. FAILURE SIGNALS
==================================================

A Spec 053 falhou se:

- Play começa a esperar backend;
- existe segunda autorização no Play;
- public bootstrap começa a chamar Mux/Bunny;
- existem dois requests bootstrap no fluxo normal;
- query DB volta a ficar sequencial sem motivo;
- quota deixa de bloquear LOAD sem decisão explícita;
- Resume bypassa bootstrap;
- Promise rejeitada quebra Retry;
- signed playback reaparece;
- HLS passa pelo backend Evandro;
- Mux e Bunny usam regras de acesso diferentes;
- Tiny Loader cresce significativamente por abstração desnecessária;
- PlayerEngine ownership é alterado;
- alguma regressão visual aparece no player.

==================================================
53. CHECKS TÉCNICOS
==================================================

Executar:

pnpm typecheck
pnpm lint
pnpm build:embed
pnpm build

Se schema mudar:

pnpm db:generate
pnpm db:migrate

Todos devem passar.

==================================================
54. CRITÉRIO DE CONCLUSÃO
==================================================

A 053 estará pronta para validação manual quando:

- existe uma autoridade canônica clara de bootstrap/access;
- código legacy não utilizado foi removido ou justificado;
- continua existindo um bootstrap request;
- happy path continua usando uma query DB principal;
- nenhuma chamada Mux/Bunny entra no public bootstrap;
- nenhum backend request bloqueia o primeiro Play;
- quota continua sendo gate do LOAD;
- Persistent Resume continua subordinado ao access;
- Mux e Bunny continuam provider-neutral;
- tracking continua assíncrono;
- Tiny Loader continua dentro do budget atual;
- checks técnicos passam.

A milestone somente será considerada aceita após validação manual explícita do usuário.


# 3. Prompt de instruções

Implemente a Spec 053 — Access & Bootstrap Critical Path Consolidation no repositório:

juanssilveira/evandro.watch

Trabalhe exclusivamente na branch:

development

Não trabalhar em main.
Não promover para produção.

Antes de alterar código:

1. Leia AGENTS.md integralmente.
2. Leia:
   - docs/00-PRODUCT.md
   - docs/01-ARCHITECTURE.md
   - docs/02-MODEL.md
   - docs/ENVIRONMENTS.md
   - docs/WORKFLOW.md
   - docs/DEPLOYMENT-CDN.md
3. Leia integralmente:
   - specs/037_simplify-playback-gate-and-restore-autoplay.md
   - specs/038_preloaded-playback-authorization.md
   - specs/045_player-loading-performance.md
   - specs/046_video-startup-and-adaptive-delivery.md
   - specs/051_full-headless-playback-engine-ownership.md
   - specs/052_persistent-resume-and-return-playback-gate.md
   - specs/053_access-and-bootstrap-critical-path-consolidation.md
4. Inspecione o código atual antes de remover qualquer helper.

Considere como estado atual:

- resolveEmbedBootstrap já utiliza query DB consolidada;
- public bootstrap não chama Mux/Bunny API;
- playbackUrl é derivada localmente;
- Tiny Loader inicia bootstrap cedo;
- Core consome bootstrap compartilhado;
- PlayerEngine prepara mídia antes do clique;
- /activate é tracking assíncrono;
- Persistent Resume já está implementado;
- PlayerEngine possui ownership único da mídia.

Objetivo:

Consolidar o public embed bootstrap/access como caminho canônico único, removendo complexidade histórica sem alterar regras comerciais e sem adicionar latência.

Regra obrigatória:

LOAD = access + limits + media preparation

PLAY = playback imediato + tracking assíncrono

Preservar no LOAD:

- vídeo existente;
- account ativa;
- owner;
- subscription ativa;
- subscription não expirada;
- quota disponível;
- video ready;
- playback descriptor válido.

Não mover essas verificações para o clique.

Manter:

- 1 request HTTP de bootstrap;
- 1 query DB principal no happy path;
- 0 chamadas de provider API no public bootstrap.

Auditar:

src/lib/plans/playback.ts

Especialmente:

- resolvePlaybackEntitlement;
- canLoadPlayback;
- validateAndActivatePlayback;
- recordPlaybackSession.

Para cada helper:

- localizar todos os callers;
- não assumir que é dead code;
- remover apenas se comprovadamente não utilizado;
- migrar callers antes de remover quando necessário.

Resultado desejado:

public embed access
→ resolveEmbedBootstrap ou equivalente único

first Play tracking
→ recordPlaybackSession ou equivalente único

Não manter duas autoridades para a mesma decisão.

Auditar os tipos duplicados de bootstrap:

- BootstrapVideoData;
- BootstrapResponsePayload;
- EmbedBootstrapResolution.data.

Criar contrato compartilhado leve se isso reduzir divergência sem aumentar significativamente o Tiny Loader.

Não adicionar dependências pesadas ao Loader.

Auditar bootstrap registry.

Garantir que Promise rejeitada não fique permanentemente cacheada impedindo Retry.

Não criar cache persistente de authorization.

Proibido:

- Redis;
- KV;
- CDN entitlement cache;
- localStorage entitlement;
- signed playback;
- JWT;
- HLS proxy;
- /access separado;
- /media separado;
- provider API no critical path.

Preservar:

Cache-Control:
private, no-cache, no-store, must-revalidate

Preservar mensagens públicas genéricas para falhas comerciais.

Não expor:

- motivo da subscription;
- quota;
- account state;
- IDs internos;
- provider internals.

Persistent Resume:

histórico local nunca bypassa bootstrap.

Se bootstrap negar acesso:

- não anexar mídia;
- não tocar Resume;
- não usar playback URL antiga.

Background Autoplay:

continua dependendo apenas do bootstrap autorizado.

Não criar outra request antes dele.

Provider neutrality:

Mux e Bunny devem seguir exatamente a mesma arquitetura de access.

Não adicionar branch de autorização específica por provider.

Não alterar arquitetura de upload.

Não alterar upload para R2.

Não alterar player design.

Não alterar Fake Progress.

Não alterar Resume UI.

Não alterar thumbnails.

Não alterar Pause Thumbnail.

Não alterar PlayerEngine ownership.

Auditar índices DB.

Criar migration apenas se existir gap real.

Se migration for necessária:

pnpm db:generate
pnpm db:migrate

Instrumentation:

preservar Server-Timing existente.

Pode melhorar timings somente se isso não adicionar trabalho relevante.

Não criar analytics remoto.

Executar obrigatoriamente:

pnpm typecheck
pnpm lint
pnpm build:embed
pnpm build

Após implementação, revisar estaticamente:

- um bootstrap por player/video no fluxo normal;
- nenhuma request backend bloqueia Play;
- nenhuma chamada Mux/Bunny no resolver público;
- access negado nunca retorna playbackUrl;
- Resume não bypassa access;
- /activate permanece não-bloqueante;
- Tiny Loader permanece dentro do budget existente.

Criar o arquivo da Spec 053 no repositório.

Manter o status como aguardando validação manual.

Commit final:

spec(053): consolidate embed access and startup pipeline

Push somente para:

origin development

Não avançar para Spec 054.

A Spec 053 só é aceita depois da validação manual explícita do usuário.