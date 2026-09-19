# 1. Nome da spec

Spec 054 — Evandro Tracker Foundation & Playback Session Telemetry

Arquivo:

specs/054_evandro-tracker-foundation-and-playback-session-telemetry.md

Status inicial:

ready for implementation


# 2. Spec em si

## Objetivo

Criar a primeira fundação real do Evandro Tracker.

O Tracker será uma camada observadora responsável por transformar os eventos já disponíveis no Evandro Player em uma sessão comportamental compacta e persistida no Evandro Watch.

Arquitetura alvo:

HTMLVideoElement
        ↓
PlayerEngine
autoridade de mídia/playback
        ↓
PlayerRuntime
eventos normalizados
        ↓
Evandro Tracker
agregação local
        ↓
telemetry endpoint
        ↓
PostgreSQL

A regra fundamental desta milestone é:

PlayerEngine controla playback.

PlayerRuntime observa o vídeo.

Evandro Tracker observa Runtime + Engine.

Tracker nunca controla playback.

==================================================
1. ESTADO ATUAL AUDITADO
==================================================

O projeto já possui uma fundação importante.

Existe PlayerRuntime com eventos tipados:

PLAYER_READY

PLAY
PLAYING
PAUSE

TIME_UPDATE

SEEK_START
SEEK_END

RATE_CHANGE
VOLUME_CHANGE

FULLSCREEN_ENTER
FULLSCREEN_EXIT

BUFFER_START
BUFFER_END

ENDED
ERROR

PLAYBACK_CONTEXT_CHANGE

Cada evento já possui snapshot com informações como:

videoId
currentTime
duration
playbackRate
paused
muted
volume
ended
timestamp
playbackMode
playbackInitiator

O Runtime já suporta:

subscribe()
unsubscribe()
destroy()

Porém, no embed público atual, esses eventos praticamente não possuem consumidor persistente.

A Spec 054 deve aproveitar esta fundação.

Não criar um segundo sistema paralelo de eventos de playback.

==================================================
2. PLAYER ENGINE CONTINUA SENDO A AUTORIDADE
==================================================

Continuam obrigatórios:

1 HTMLVideoElement
1 PlayerEngine
1 source owner
1 lifecycle HLS principal

Tracker NÃO pode:

- chamar play();
- chamar pause();
- alterar currentTime;
- alterar volume;
- alterar playbackRate;
- alterar HLS level;
- alterar ABR;
- recriar source;
- decidir Resume;
- decidir Background Autoplay;
- controlar thumbnails;
- controlar startup visuals.

Tracker é somente observador.

==================================================
3. CORRIGIR CONTEXTO DO PLAYERRUNTIME
==================================================

A auditoria identificou uma inconsistência importante.

PlayerRuntime atualmente nasce com defaults equivalentes a:

playbackMode = foreground
playbackInitiator = user

mas o PlayerEngine pode estar em:

background_autoplay
foreground/system
foreground/user

O Runtime precisa refletir o contexto real do Engine antes de ser utilizado pelo Tracker.

Na inicialização:

PlayerRuntime deve receber o contexto atual do PlayerEngine.

Depois:

quando Engine mudar experience ou playbackInitiator,
Runtime deve receber setPlaybackContext() correspondente.

Mapeamento:

Engine experience = background_autoplay
→ Runtime playbackMode = background_autoplay

Engine experience = foreground
→ Runtime playbackMode = foreground

Engine playbackInitiator deve suportar:

autoplay
user
system

Expandir o tipo do Runtime para aceitar system.

Essa sincronização é somente observacional.

Runtime não pode alterar Engine.

==================================================
4. SESSÃO CANÔNICA DO PLAYER
==================================================

Hoje existe playSessionId criado para /activate.

A 054 deve evoluir esse identificador para representar a sessão daquela instância de vídeo.

Criar um sessionId UUID por combinação:

player instance
+
videoId

Esse mesmo valor deve ser utilizado por:

Evandro Tracker
e
POST /activate

Ou seja:

sessionId do Tracker
=
playSessionId usado pela contabilização do Play

Não criar dois IDs diferentes para a mesma sessão.

Se videoId mudar na mesma instância:

gerar novo sessionId.

Reload da página:

nova sessão.

Nova aba:

nova sessão.

Novo embed:

nova sessão.

Não persistir sessionId em:

localStorage
cookie
sessionStorage

A identidade é somente daquela instância de reprodução.

==================================================
5. VIEW E PLAY CONTINUAM DIFERENTES
==================================================

Terminologia canônica:

VIEW
=
player autorizado chegou ao visitante e criou uma sessão Tracker

PLAY
=
visitante iniciou intencionalmente foreground playback

Background Autoplay:

é View

mas:

não é Play.

Abrir thumbnail e nunca clicar:

é View

mas:

não é Play.

Resume Gate exibido e fechado sem decisão:

é View

mas:

não é Play.

Não alterar a regra comercial atual de Plays.

==================================================
6. EDITOR NÃO GERA TRACKING
==================================================

Quando:

isEditor === true

não criar sessão Tracker persistida.

Não enviar telemetry endpoint.

Não criar View.

Não alterar monthlyUsage.

Não alterar playSessions.

O preview interno deve continuar isento.

==================================================
7. NOVA CAMADA EVANDRO TRACKER
==================================================

Criar estrutura equivalente a:

src/components/player/tracker/
  evandro-tracker.ts
  tracker-accumulator.ts
  tracker-transport.ts
  types.ts

A estrutura exata pode ser ajustada se houver justificativa.

Responsabilidades:

EvandroTracker
→ lifecycle e subscriptions

TrackerAccumulator
→ transforma eventos em estado agregado

TrackerTransport
→ envio assíncrono

types
→ contratos

Não adicionar biblioteca externa de analytics/event emitter.

==================================================
8. LIFECYCLE DO TRACKER
==================================================

Conceitualmente:

PlayerRuntime ready
+
PlayerEngine disponível
+
videoId
+
sessionId
↓
EvandroTracker.initialize()

Tracker deve assinar:

PlayerRuntime events

e somente sinais read-only necessários do PlayerEngine.

Destroy:

- unsubscribe Runtime;
- unsubscribe Engine;
- limpar timers;
- executar flush final best-effort;
- impedir novos envios.

Re-render React não pode criar múltiplos Trackers ativos para a mesma instância.

==================================================
9. NÃO ENVIAR EVENTO POR EVENTO AO BACKEND
==================================================

TIME_UPDATE pode ocorrer várias vezes por segundo.

Nunca implementar:

TIME_UPDATE
→ POST

BUFFER_START
→ POST

PAUSE
→ POST

SEEK
→ POST

evento por evento.

O Runtime continua emitindo eventos localmente.

Tracker agrega tudo em memória.

Backend recebe snapshots cumulativos compactos da sessão.

==================================================
10. TRACKER SESSION PERSISTIDA
==================================================

Criar tabela:

tracker_sessions

Ela representa uma View/sessão comportamental.

Não reutilizar play_sessions para armazenar toda a telemetria.

play_sessions continua sendo ledger comercial de Plays/quota.

tracker_sessions é analytics comportamental.

==================================================
11. SCHEMA TRACKER_SESSIONS
==================================================

Campos equivalentes:

id

account_id
video_id
session_id

sequence

created_at
updated_at
last_seen_at

first_foreground_at
ended_at

started_in_background_autoplay

duration_seconds
last_position_seconds
max_position_seconds

watch_time_ms
unique_watched_seconds
completion_percent

watched_ranges

pause_count
seek_count
rate_change_count
fullscreen_count

buffer_count
buffer_time_ms

started_from_resume
resume_from_seconds
resume_decision

quality_summary
performance_summary

ended

has_error
last_error_type

Restrições:

UNIQUE(video_id, session_id)

Indexes:

(account_id, created_at)

(video_id, created_at)

created_at

Não criar índices adicionais sem necessidade real.

==================================================
12. OWNERSHIP DOS DADOS
==================================================

tracker_sessions pertence à Account.

Persistir:

account_id

diretamente na sessão.

O endpoint resolve accountId através do vídeo no servidor.

Nunca confiar em accountId enviado pelo browser.

Browser envia publicId na URL.

Servidor resolve:

publicId
→ videos.id
→ videos.accountId

==================================================
13. PLAY_SESSIONS CONTINUA SEPARADA
==================================================

Não remover ou transformar:

play_sessions

Ela continua responsável por:

- idempotência de Play;
- monthlyUsage;
- quota mensal;
- analytics operacional atual de Plays.

Relacionamento conceitual:

tracker_sessions.video_id
+
tracker_sessions.session_id

corresponde quando houver Play a:

play_sessions.video_id
+
play_sessions.play_session_id

Não criar FK obrigatória entre elas.

Uma Tracker Session pode existir sem Play.

Exemplo:

View sem clique
→ tracker_session existe
→ play_session não existe

Isso é correto.

==================================================
14. WATCHED RANGES
==================================================

Tracker deve registrar trechos realmente assistidos.

Formato conceitual:

[
  [0.0, 18.4],
  [42.1, 56.8],
  [70.0, 91.2]
]

Não assumir:

maxPosition = watchedTime

Exemplo:

usuário assiste:

0 → 18

seek:

18 → 42

assiste:

42 → 56

Resultado NÃO pode ser:

0 → 56 assistido.

Resultado correto:

0 → 18
42 → 56

==================================================
15. CONDIÇÃO PARA CONSIDERAR UM TRECHO ASSISTIDO
==================================================

Somente acumular watched range quando:

experience = foreground

e:

user foreground já iniciou

e:

vídeo está reproduzindo

e:

não está buffering

e:

não está seeking

e:

document não está hidden.

Background Autoplay nunca adiciona watched ranges.

Resume preparation nunca adiciona watched ranges.

==================================================
16. DETECÇÃO DE AVANÇO REAL
==================================================

TIME_UPDATE será utilizado apenas como sinal local.

Tracker deve comparar:

posição anterior
posição atual
tempo real decorrido
playbackRate

Avanço normal:

adicionar range.

Salto incompatível com playback normal:

não adicionar intervalo atravessado.

SEEK_START:

suspender range corrente.

SEEK_END:

resetar baseline na nova posição.

Não creditar o trecho pulado.

==================================================
17. MERGE DE RANGES
==================================================

Ranges sobrepostos ou praticamente contínuos devem ser unidos.

Exemplo:

[0.0, 4.0]
[3.8, 7.0]

→

[0.0, 7.0]

Usar tolerância pequena para diferenças naturais do timeupdate.

Target aproximado:

até 0.75s de gap pode ser tratado como continuidade normal.

Não unir gaps grandes causados por seek.

==================================================
18. LIMITE DOS WATCHED RANGES
==================================================

Payload não pode crescer indefinidamente.

Limite inicial:

máximo 256 ranges.

Se atingir o limite:

- continuar permitindo extensão/merge de ranges já existentes;
- não criar ranges disjuntos ilimitados;
- preferir subcontagem a inventar trechos assistidos.

Não transformar ranges em um enorme event log.

==================================================
19. UNIQUE WATCHED SECONDS
==================================================

Calcular a soma dos ranges únicos.

Exemplo:

[0, 10]
[5, 15]

depois do merge:

[0, 15]

uniqueWatchedSeconds:

15

Não contar replay duplamente nessa métrica.

==================================================
20. WATCH TIME
==================================================

watchTimeMs representa tempo real de consumo foreground.

Exemplo:

10 segundos de vídeo assistidos em 2x

uniqueWatchedSeconds pode aumentar aproximadamente 10s

watchTimeMs aumenta aproximadamente 5s.

São métricas diferentes.

Não incrementar watchTime durante:

- pausa;
- buffering;
- seek;
- Background Autoplay;
- Resume preparation;
- tab hidden.

==================================================
21. COMPLETION
==================================================

completionPercent:

uniqueWatchedSeconds / durationSeconds * 100

Clamp:

0 → 100

Não usar maxPosition para completion.

Alguém que seekou para 95% do vídeo não deve receber 95% de completion automaticamente.

==================================================
22. MAX POSITION
==================================================

maxPositionSeconds continua útil como métrica separada.

Representa:

maior posição alcançada durante foreground playback.

Pode aumentar após seek.

Não confundir com quantidade assistida.

==================================================
23. BUFFERING
==================================================

Utilizar:

BUFFER_START
BUFFER_END

para calcular:

bufferCount
bufferTimeMs

Contar buffering comportamental somente depois do foreground real começar.

Não contar preparação inicial de mídia como rebuffer do espectador.

Não contar Background Autoplay como foreground buffering.

BUFFER_START duplicado sem BUFFER_END intermediário:

não incrementar múltiplas vezes.

==================================================
24. PAUSE
==================================================

PAUSE durante foreground incrementa:

pauseCount

Não contar pausas técnicas provocadas por:

- Resume preparation;
- Background Autoplay visibility handling;
- Engine startup;
- destroy.

Usar contexto do Engine/Runtime para distinguir.

==================================================
25. SEEK
==================================================

SEEK_START/SEEK_END foreground real incrementa:

seekCount

O seek técnico usado para preparar Persistent Resume:

não conta.

O reset técnico de "Assistir do início":

não deve ser interpretado como scrub comum.

Tracker deve reconhecer a decisão Restart e ignorar esse seek técnico para seekCount.

==================================================
26. PLAYBACK RATE
==================================================

RATE_CHANGE após foreground real:

incrementa:

rateChangeCount

Não precisa persistir cada mudança individual nesta milestone.

O Tracker pode manter:

lastPlaybackRate

internamente se necessário.

Não criar event table.

==================================================
27. FULLSCREEN
==================================================

FULLSCREEN_ENTER após sessão iniciada:

incrementa:

fullscreenCount

Não persistir cada evento individual.

==================================================
28. RESUME
==================================================

Tracker deve registrar:

startedFromResume

resumeFromSeconds

resumeDecision

Valores de resumeDecision:

none
continue
restart

Cenário:

Resume Gate aparece
usuário fecha página sem escolher

Resultado:

startedFromResume = true
resumeDecision = none

Cenário:

Continuar assistindo

resultado:

resumeDecision = continue

Cenário:

Assistir do início

resultado:

resumeDecision = restart

==================================================
29. RESUME NÃO DEPENDE DO TRACKER
==================================================

Persistent Resume continua usando seu storage atual.

Tracker apenas observa.

Falha de telemetry não pode:

- impedir Resume;
- limpar Resume;
- alterar posição salva;
- alterar Continue;
- alterar Restart.

==================================================
30. ENGINE DEVE EXPOR RESUME DECISION DE FORMA OBSERVÁVEL
==================================================

Hoje Engine conhece:

continueResume()

restartFromBeginning()

Adicionar estado read-only equivalente a:

resumeDecision:
none | continue | restart

continueResume():

resumeDecision = continue

restartFromBeginning():

resumeDecision = restart

loadSource nova geração:

resumeDecision = none

Isso permite ao Tracker observar a decisão sem UI emitir analytics manualmente.

==================================================
31. BACKGROUND AUTOPLAY
==================================================

Background Autoplay pode existir durante uma Tracker Session.

Registrar:

startedInBackgroundAutoplay = true

quando aplicável.

Mas Background Autoplay:

não cria Play

não incrementa watchTime

não adiciona watchedRanges

não incrementa pauseCount comportamental

não incrementa seekCount comportamental

não gera Resume history

Quando usuário entra em foreground:

a partir daquele momento começa tracking comportamental.

==================================================
32. QUALIDADE / ABR
==================================================

A 054 deve introduzir observação read-only de qualidade.

Não alterar algoritmo ABR.

Não selecionar quality manualmente.

Não impedir auto quality.

==================================================
33. HLS.JS QUALITY SIGNALS
==================================================

PlayerEngine já possui a instância HLS.

Manter os listeners HLS sob ownership do Engine.

Adicionar uma API read-only leve equivalente a:

engine.subscribeTelemetry(listener)

ou nome equivalente.

Ela pode emitir sinais como:

QUALITY_SAMPLE

BANDWIDTH_ESTIMATE

HLS_FATAL_ERROR

O Tracker consome esses sinais.

Tracker NÃO deve registrar listeners concorrentes que passem a controlar HLS.

==================================================
34. QUALITY SAMPLE
==================================================

Para HLS.js utilizar informações já disponíveis nos levels.

Em mudança real de level, capturar quando disponível:

level index
width
height
bitrate

Registrar também:

bandwidthEstimateBps

quando disponível.

Não armazenar playback URL.

==================================================
35. QUALITY SUMMARY
==================================================

Persistir em quality_summary JSONB um shape versionado e compacto.

Exemplo conceitual:

version: 1

source:
hlsjs | native | direct

startup:
height
bitrate

foreground:
initialHeight
currentHeight
maxHeight
switchCount

bandwidthEstimateBps

Campos indisponíveis podem ser null.

==================================================
36. BACKGROUND QUALITY X FOREGROUND QUALITY
==================================================

Background Autoplay possui cap de qualidade.

Portanto:

startup quality
≠
foreground quality

Não usar o 480p do Background Autoplay como se fosse a qualidade inicial escolhida para consumo foreground.

Ao entrar em foreground:

registrar separadamente a primeira quality sample foreground.

==================================================
37. NATIVE HLS / SAFARI
==================================================

Safari/native HLS não possui HLS.js disponível.

Não carregar HLS.js apenas para analytics.

Para native path:

usar best-effort com:

videoWidth
videoHeight

em eventos como:

loadedmetadata
canplay
playing
resize quando disponível

Bitrate pode permanecer null.

quality switch count pode ser indisponível.

Isso é aceitável.

Não degradar playback para obter telemetry.

==================================================
38. PERFORMANCE SUMMARY
==================================================

A infraestrutura atual de performance deve ser reutilizada.

Não criar um segundo sistema de timestamps concorrente sem necessidade.

Coletar quando disponível:

bootstrapDurationMs
manifestDurationMs
firstFragmentDurationMs
mediaAttachToFirstFrameMs
resumeReadyMs
clickToFirstFrameMs

Persistir em:

performance_summary JSONB

com:

version: 1

Campos indisponíveis:

null / omitidos.

==================================================
39. CLICK TO FIRST FRAME
==================================================

A primeira entrada real em foreground deve permitir medir:

user foreground intent
→ próximo frame apresentado

Sem alterar playback.

O Tracker pode detectar:

Engine:
userForegroundRequested false → true

e então usar:

requestVideoFrameCallback

ou fallback existente para observar o próximo frame.

Não atrasar play() aguardando essa medição.

==================================================
40. ERROS
==================================================

Tracker pode registrar:

hasError = true

lastErrorType

Usar valores sanitizados como:

media
network
hls_media
hls_network
hls_other

Não persistir:

playback URL
stack trace
token
provider secret
erro contendo URL completa

==================================================
41. END
==================================================

ENDED deve:

- finalizar range atual;
- finalizar watch timer;
- marcar ended = true;
- executar flush final;
- registrar endedAt server-side.

Não alterar o comportamento de clearSavedResume já existente.

==================================================
42. VISIBILITY
==================================================

Quando:

document.hidden = true

Tracker deve:

- fechar temporariamente watch accumulation;
- flush best-effort;
- não continuar somando watchTime;
- não continuar watchedRanges.

Quando voltar:

resetar baseline temporal antes de continuar.

Não pausar foreground playback apenas por causa do Tracker.

==================================================
43. ENDPOINT DE TELEMETRY
==================================================

Criar:

POST /api/embed/videos/[publicId]/telemetry

e:

OPTIONS

CORS compatível com embeds públicos.

Não exigir autenticação do espectador.

==================================================
44. PAYLOAD
==================================================

Payload conceitual:

sessionId
sequence

durationSeconds
lastPositionSeconds
maxPositionSeconds

watchTimeMs
watchedRanges

pauseCount
seekCount
rateChangeCount
fullscreenCount

bufferCount
bufferTimeMs

startedInBackgroundAutoplay

startedFromResume
resumeFromSeconds
resumeDecision

qualitySummary
performanceSummary

ended

hasError
lastErrorType

O browser NÃO envia:

accountId
internalVideoId
ownerUserId

Servidor deriva esses dados.

==================================================
45. SEQUENCE
==================================================

Cada flush da mesma sessão incrementa:

sequence

Exemplo:

1
2
3
4

Servidor persiste:

last sequence

Se request antiga chegar depois de request nova:

sequence 3 chega depois de 4

não permitir regressão dos campos de estado atual.

Isso é necessário porque requests assíncronas podem completar fora de ordem.

==================================================
46. IDEMPOTÊNCIA
==================================================

Mesmo:

videoId
+
sessionId
+
sequence

pode ser enviado novamente sem duplicar sessão.

Usar:

UPSERT

com:

UNIQUE(video_id, session_id)

A tabela deve continuar com uma linha por sessão.

==================================================
47. CAMPOS CUMULATIVOS
==================================================

Payload representa o estado cumulativo atual da sessão.

Exemplo:

primeiro flush:

watchTimeMs = 5000

segundo:

watchTimeMs = 18000

terceiro:

watchTimeMs = 32000

Não enviar somente delta que possa ser perdido.

Isso torna retry mais simples.

==================================================
48. OUT-OF-ORDER
==================================================

Campos cumulativos devem obedecer monotonicidade quando aplicável.

Exemplos:

maxPosition
watchTimeMs
pauseCount
seekCount
bufferCount
bufferTimeMs
quality switch count

Nunca regredir devido a pacote antigo.

Campos de estado como:

lastPosition

só devem aceitar payload da sequence mais nova.

==================================================
49. WATCHED RANGES NO SERVIDOR
==================================================

Validar ranges recebidos.

Cada range:

[start, end]

Regras:

start finito
end finito
start >= 0
end > start

Se duration conhecida:

clamp seguro à duração.

Máximo:

256 ranges.

Não confiar em:

uniqueWatchedSeconds
completionPercent

vindos do client.

Preferencialmente recalcular server-side a partir de watchedRanges validados.

==================================================
50. VALIDAÇÃO
==================================================

Usar Zod na fronteira HTTP.

Limitar:

sessionId
sequence
contadores
durations
JSON arrays

Rejeitar payload absurdo.

Payload inválido não pode quebrar player.

Resposta de telemetry não é consumida pelo playback.

==================================================
51. TAMANHO DO PAYLOAD
==================================================

Manter payload pequeno.

Target normal:

poucos KB.

Não enviar:

lista de TIME_UPDATE
lista de PLAY
lista de PAUSE
lista de fragments
event log bruto.

Pode rejeitar Content-Length exagerado.

Target inicial de segurança:

64 KB máximo.

==================================================
52. TRANSPORTE
==================================================

TrackerTransport deve operar fora do critical path.

Nunca await telemetry antes de:

play()
seek
Resume
HLS attach
first frame

Envios são fire-and-forget.

==================================================
53. FREQUÊNCIA
==================================================

Estratégia inicial:

- marcar estado dirty quando algo muda;
- flush periódico aproximadamente a cada 15 segundos quando dirty;
- flush em pause;
- flush em ended;
- flush em error;
- flush quando document fica hidden;
- flush em pagehide;
- flush no destroy.

Não fazer request se nada mudou.

==================================================
54. PRIMEIRA VIEW
==================================================

Tracker Session deve existir mesmo sem Play.

Para não disputar o critical path de startup:

não bloquear bootstrap/mídia para criar View.

Agendar primeiro flush fora do critical path.

Estratégia aceitável:

aproximadamente 2–3 segundos após Tracker initialization

ou antes disso se ocorrer:

foreground Play
pagehide
destroy

O primeiro flush cria tracker_session.

==================================================
55. PAGEHIDE
==================================================

Usar:

fetch(..., { keepalive: true })

para flush terminal/best-effort quando apropriado.

Não depender de resposta.

Falha pode ser ignorada.

Não implementar queue persistente offline nesta spec.

==================================================
56. FALHA DE TELEMETRY
==================================================

Se endpoint retornar:

500
timeout
network error
CORS error

resultado obrigatório:

player continua normalmente.

Não mostrar erro visual.

Não pausar.

Não destruir HLS.

Não bloquear Resume.

Não bloquear /activate.

Não bloquear quota tracking.

==================================================
57. BACKEND DO TELEMETRY
==================================================

O endpoint deve resolver somente o necessário.

Fluxo:

publicId
↓
video
↓
accountId
↓
UPSERT tracker_sessions

Não chamar:

Mux API
Bunny API

Não chamar provider.

Não reexecutar bootstrap inteiro a cada telemetry flush.

Não alterar quota.

==================================================
58. VIDEO STATUS
==================================================

Telemetry só deve persistir para vídeo existente.

Não precisa reproduzir toda a lógica comercial do bootstrap em cada flush.

O Tracker só nasce depois do bootstrap autorizado.

Servidor ainda deve resolver o vídeo pelo publicId.

Se vídeo não existir:

ignorar/rejeitar de forma segura.

==================================================
59. CORS
==================================================

Seguir padrão dos endpoints públicos do embed.

Permitir:

POST
OPTIONS

Headers necessários para JSON.

Não adicionar cookies ou credenciais cross-site desnecessárias.

==================================================
60. CACHE
==================================================

Telemetry endpoint:

no-store.

Não cachear POST.

==================================================
61. PRIVACIDADE — V1
==================================================

Nesta milestone NÃO criar:

viewerId persistente
fingerprint
device fingerprint
cookie global
cross-site identity
email tracking
IP persistido em tracker_sessions
referrer tracking
page URL tracking
campaign attribution

A sessão é anônima e efêmera.

==================================================
62. RELOAD
==================================================

Reload:

nova Tracker Session.

Persistent Resume pode encontrar progresso anterior.

Resultado:

session A encerrou/ficou com lastSeenAt anterior

session B começa nova

B pode possuir:

startedFromResume = true

Isso é correto.

==================================================
63. MULTIPLE EMBEDS
==================================================

Dois players na mesma página:

cada instância possui:

sessionId próprio
Tracker próprio
Runtime próprio
Engine próprio

Mesmo videoId em dois players:

duas Tracker Sessions.

Não compartilhar sessionId.

==================================================
64. DEBUG
==================================================

Quando:

development.debug = true

permitir logs úteis:

[Evandro Tracker] INIT
[Evandro Tracker] FLUSH sequence=...
[Evandro Tracker] FOREGROUND_START
[Evandro Tracker] RESUME continue
[Evandro Tracker] END

Pode mostrar resumo agregado:

watchTime
uniqueWatched
buffer
quality

Não imprimir TIME_UPDATE individual do Tracker.

Não poluir produção.

==================================================
65. ANALYTICS UI
==================================================

Não criar dashboard de analytics nesta milestone.

Não criar:

heatmap UI
retention chart
viewer table
session explorer
conversion insights
Evandro Intelligence UI

A 054 cria a fundação de dados.

Visualização virá em milestone posterior.

==================================================
66. NÃO CRIAR EVENT STORE BRUTO
==================================================

Não criar:

tracker_events

nesta versão.

Não persistir um row por evento.

A primeira arquitetura deve ser:

muitos eventos locais
→ um agregado de sessão

Isso mantém volume e custo previsíveis.

==================================================
67. MONTHLY USAGE
==================================================

Tracker nunca incrementa:

monthly_usage.plays

Somente o fluxo atual de:

/activate
→ recordPlaybackSession()

continua fazendo isso.

==================================================
68. PRIMEIRO PLAY
==================================================

O mesmo sessionId utilizado pelo Tracker deve chegar a:

POST /activate

como:

playSessionId

A mesma sessão:

Play
Pause
Play
Seek
Play

continua contando:

1 Play.

Não alterar a idempotência existente.

==================================================
69. ATIVAÇÃO CONTINUA ASSÍNCRONA
==================================================

/activate continua não bloqueando:

video.play()

Tracker não deve colocar uma espera adicional entre:

click
→ frame

==================================================
70. INTERAÇÃO COM SPEC 053
==================================================

Preservar integralmente:

LOAD
=
access + limits + media preparation

PLAY
=
playback imediato + tracking async

Telemetry também é async.

Novo fluxo conceitual:

LOAD
→ bootstrap autorizado
→ Engine prepara

Tracker
→ começa observação

PLAY
→ playback imediato

em paralelo:

/activate
telemetry

Nenhum deles bloqueia mídia.

==================================================
71. INTERAÇÃO COM SPEC 052
==================================================

Preservar:

Resume Gate
Continue
Restart
Fake Progress
localStorage resume
single media owner

Tracker apenas captura:

startedFromResume
resumeFrom
resumeDecision

==================================================
72. INTERAÇÃO COM BACKGROUND AUTOPLAY
==================================================

Preservar:

Background Preview
main video preparing/playing muted
480p cap atual
handoff para foreground

Tracker não pode modificar esse lifecycle.

==================================================
73. MIGRATION
==================================================

Criar migration Drizzle nova para:

tracker_sessions

Não editar migrations históricas.

Adicionar export no schema index.

Se utilizar JSONB, tipar:

watchedRanges
qualitySummary
performanceSummary

de forma explícita.

==================================================
74. NÚMEROS E PRECISÃO
==================================================

Posições/durações:

preservar casas decimais úteis.

Não arredondar para segundos inteiros.

watchTimeMs:

inteiro em milissegundos.

Contadores:

inteiros >= 0.

Percentual:

pode ser calculado com precisão decimal adequada.

==================================================
75. O QUE VOCÊ DEVE PERCEBER
==================================================

Visualmente:

nenhuma mudança.

O player deve continuar exatamente igual.

Com debug/network aberto, deve ser possível perceber:

- requests pequenos de telemetry;
- nenhum request por TIME_UPDATE;
- sessionId estável durante a sessão;
- /activate utiliza o mesmo sessionId;
- flush periódico;
- flush em pause/pagehide/ended;
- Background Autoplay não gera Play;
- telemetry nunca bloqueia reprodução.

==================================================
76. O QUE NÃO DEVE MUDAR
==================================================

Não alterar:

- player design;
- click-to-play;
- click-to-pause;
- double click fullscreen;
- thumbnails;
- Pause Thumbnail;
- Fake Progress;
- Resume card;
- Continue;
- Restart;
- Background Preview;
- Background Autoplay;
- HLS startup;
- startup ABR;
- provider delivery;
- bootstrap/access;
- quota semantics;
- R2;
- uploads;
- Mux/Bunny lifecycle.

==================================================
77. NÃO IMPLEMENTAR
==================================================

Não implementar:

- analytics dashboard;
- retention UI;
- heatmaps;
- raw events table;
- Kafka;
- queue externa;
- Redis;
- ClickHouse;
- BigQuery;
- analytics SaaS;
- cookies de tracking;
- fingerprint;
- viewer identity;
- service worker;
- retry queue persistente;
- provider analytics APIs;
- video proxy.

==================================================
78. TESTE MANUAL A — VIEW SEM PLAY
==================================================

Abrir player normal.

Não clicar Play.

Esperado:

- Tracker Session pode ser criada;
- View existe;
- /activate não ocorre;
- play_sessions não recebe Play;
- watchTimeMs = 0;
- watchedRanges vazio;
- nenhuma mudança visual.

==================================================
79. TESTE MANUAL B — PLAY NORMAL
==================================================

Abrir vídeo.

Clicar Play.

Assistir aproximadamente 20 segundos.

Pausar.

Esperado:

- /activate ocorre uma vez;
- telemetry utiliza mesmo sessionId;
- watchTime aumenta;
- watchedRanges contém trecho assistido;
- pauseCount incrementa;
- player permanece instantâneo.

==================================================
80. TESTE MANUAL C — PAUSE / PLAY REPETIDO
==================================================

Play
Pause
Play
Pause
Play

Esperado:

- continua 1 Play comercial;
- mesma Tracker Session;
- pauseCount cresce;
- watchTime continua acumulando corretamente.

==================================================
81. TESTE MANUAL D — SEEK
==================================================

Assistir:

0 → 10

seek:

10 → 40

assistir:

40 → 50

Esperado conceitualmente:

watchedRanges:

[0, ~10]
[40, ~50]

Não:

[0, 50]

seekCount:

1

==================================================
82. TESTE MANUAL E — BACKGROUND AUTOPLAY SEM CLIQUE
==================================================

Ativar Background Autoplay.

Abrir embed.

Não clicar.

Esperado:

- pode existir Tracker Session/View;
- nenhum Play;
- nenhuma /activate;
- watchedRanges vazio;
- watchTimeMs = 0;
- startedInBackgroundAutoplay = true.

==================================================
83. TESTE MANUAL F — BACKGROUND → FOREGROUND
==================================================

Background Autoplay ativo.

Esperar alguns segundos.

Clicar para iniciar foreground.

Esperado:

antes do clique:

watchTime = 0

depois:

watchTime começa a acumular

/activate:

uma vez

Não contar os segundos do loop/background como consumo assistido.

==================================================
84. TESTE MANUAL G — RESUME CONTINUE
==================================================

Criar Resume anterior.

Reabrir.

Escolher:

Continuar assistindo

Esperado:

startedFromResume = true

resumeFromSeconds ≈ posição salva

resumeDecision = continue

watchedRanges novos começam na região retomada.

Não creditar 0 → resumePosition como assistido.

==================================================
85. TESTE MANUAL H — RESUME RESTART
==================================================

Abrir Resume.

Escolher:

Assistir do início

Esperado:

startedFromResume = true

resumeDecision = restart

playback começa em 0

o reset técnico não aumenta seekCount como scrub comum.

==================================================
86. TESTE MANUAL I — FECHAR NO RESUME GATE
==================================================

Abrir Resume.

Não escolher ação.

Fechar/recarregar.

Esperado na sessão encerrada:

startedFromResume = true

resumeDecision = none

watchTime = 0

nenhum Play.

==================================================
87. TESTE MANUAL J — BUFFERING
==================================================

Usar throttling de rede suficiente para causar rebuffer real.

Depois de foreground playback iniciado:

BUFFER_START
→ BUFFER_END

Esperado:

bufferCount incrementa

bufferTimeMs acumula duração aproximada.

Spinner/UI continua utilizando comportamento atual.

==================================================
88. TESTE MANUAL K — QUALITY
==================================================

Em browser HLS.js:

alterar condições de rede.

Esperado:

qualitySummary recebe dados quando disponíveis.

Mudanças automáticas de level incrementam switchCount foreground.

Tracker não muda o level manualmente.

==================================================
89. TESTE MANUAL L — SAFARI / NATIVE HLS
==================================================

Esperado:

player continua usando native HLS.

Tracker pode registrar:

videoWidth
videoHeight

quando disponíveis.

Bitrate null é aceitável.

Não baixar hls.js apenas para tracking.

==================================================
90. TESTE MANUAL M — TELEMETRY OFFLINE
==================================================

Bloquear endpoint:

/telemetry

Esperado:

- vídeo continua;
- Play continua;
- seek continua;
- Resume continua;
- Background Autoplay continua;
- nenhum erro visual aparece.

==================================================
91. TESTE MANUAL N — EDITOR
==================================================

Abrir Preview do Player dentro do Evandro Watch.

Interagir normalmente.

Esperado:

nenhum tracker_session persistido.

Nenhuma request pública de telemetry.

==================================================
92. TESTE MANUAL O — ENDED
==================================================

Assistir até o fim.

Esperado:

ended = true

flush final ocorre

endedAt é persistido

Resume continua sendo limpo pelo fluxo atual.

==================================================
93. TESTE MANUAL P — RELOAD
==================================================

Começar sessão.

Reload.

Esperado:

novo sessionId.

Nova tracker_session.

Persistent Resume continua podendo conectar a experiência do usuário, mas as duas sessões permanecem independentes.

==================================================
94. TESTE MANUAL Q — MULTIPLE PLAYERS
==================================================

Dois embeds na mesma página.

Esperado:

sessionIds distintos.

Nenhum evento cruza entre players.

Mesmo vídeo em dois players:

duas sessões distintas.

==================================================
95. SINAIS DE REGRESSÃO
==================================================

A Spec 054 falhou se:

- Tracker chama play/pause/seek;
- cria segundo HTMLVideoElement;
- cria segundo HLS owner;
- telemetry bloqueia Play;
- telemetry bloqueia startup;
- há POST em cada TIME_UPDATE;
- Background Autoplay conta watchTime;
- Background Autoplay conta Play;
- Resume preparation vira watched range;
- seek pulado vira watched time;
- editor gera telemetry;
- sessionId muda durante pause/play da mesma instância;
- /activate recebe ID diferente do Tracker;
- falha de telemetry gera erro visual;
- Safari passa a carregar HLS.js por causa do Tracker;
- quality tracking altera ABR;
- play_sessions vira tabela gigante de analytics;
- raw tracker_events é criado;
- player visual/comportamental muda.

==================================================
96. CHECKS TÉCNICOS
==================================================

Executar:

pnpm typecheck
pnpm lint
pnpm build:embed
pnpm build

Como haverá mudança de schema:

pnpm db:generate
pnpm db:migrate

Confirmar migration nova sem editar migrations históricas.

==================================================
97. TESTES AUTOMATIZADOS
==================================================

Não introduzir infraestrutura nova de testes automatizados nesta milestone.

A decisão atual do projeto é adiar essa iniciativa.

Não instalar:

Vitest
Playwright
Jest
Cypress

apenas por causa da 054.

Fazer validação estática e manual conforme fluxo atual.

==================================================
98. CRITÉRIO DE CONCLUSÃO
==================================================

A Spec 054 estará pronta para validação manual quando:

- PlayerRuntime possui contexto sincronizado com PlayerEngine;
- existe EvandroTracker separado da autoridade do player;
- sessionId é criado por player/video instance;
- Tracker e /activate compartilham o mesmo ID;
- tracker_sessions existe;
- uma View pode existir sem Play;
- watchedRanges funcionam;
- seeks não geram consumo falso;
- Background Autoplay não soma watchTime;
- Resume é registrado sem alterar seu funcionamento;
- buffering foreground é agregado;
- HLS.js quality é observada sem controlar ABR;
- native HLS permanece native;
- telemetry é batched;
- não existe POST por TIME_UPDATE;
- endpoint usa UPSERT + sequence;
- telemetry falha de forma silenciosa;
- editor não gera dados;
- player continua visualmente e funcionalmente igual;
- todos os checks passam.

A milestone só será considerada accepted após validação manual explícita do usuário.