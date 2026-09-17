# 036 — Secure Playback and Dev Plan State

## Objetivo

Corrigir integralmente o controle de acesso ao playback e o estado de planos no painel `/dev`.

A implementação deve estabelecer uma regra definitiva:

> O WatchMap nunca resolve ou libera mídia antes de validar que a conta proprietária possui uma assinatura ativa.

A autorização deve ser dividida conceitualmente em duas fases:

FASE 1 — Identidade e autorização
FASE 2 — Disponibilidade e liberação da mídia

Essa ordem deve ser respeitada por todos os fluxos públicos de playback.

---

# 1. Regra central de autorização

O client fornece apenas:

`publicId`

O backend deve executar:

1. localizar minimamente o registro correspondente ao `publicId`;
2. obter somente o necessário para identificar a conta;
3. resolver o proprietário da conta;
4. validar a assinatura ativa desse proprietário;
5. se não existir assinatura ativa, interromper imediatamente;
6. somente depois consultar/avaliar dados relacionados à mídia;
7. validar status do vídeo;
8. validar quota;
9. registrar Play;
10. gerar autorização temporária;
11. liberar stream.

Fluxo obrigatório:

publicId
→ video.id + accountId
→ owner
→ assinatura ativa?

NÃO
→ 403
→ parar

SIM
→ verificar disponibilidade do vídeo
→ verificar quota
→ registrar Play
→ gerar URL assinada
→ retornar stream

---

# 2. Consulta mínima inicial

É inevitável consultar o vídeo pelo `publicId`, porque ele é necessário para descobrir qual conta precisa ser validada.

Essa primeira consulta deve ser considerada somente uma resolução de identidade.

Ela deve buscar apenas dados mínimos, como:

- video.id;
- video.accountId.

Opcionalmente outros campos exclusivamente necessários à resolução de autorização.

Não utilizar nessa fase:

- muxPlaybackId;
- providerPlaybackId;
- playbackUrl;
- HLS;
- poster;
- preview;
- status de mídia;
- qualquer informação utilizada para reprodução.

A existência do registro não significa autorização para consumir sua mídia.

---

# 3. Fonte única da regra de plano

Reutilizar a regra central existente de assinatura ativa.

Uma subscription é válida somente quando:

status = active

E:

expiresAt IS NULL
OU
expiresAt > now

Não criar uma definição paralela para embeds ou playback.

Plano:

- inexistente;
- inactive;
- removido;
- expirado;

deve resultar em:

403 Forbidden

---

# 4. Ordem obrigatória

A implementação NÃO pode fazer:

publicId
→ verificar status ready
→ verificar playback ID
→ depois verificar plano

O fluxo correto é:

publicId
→ resolver conta
→ resolver owner
→ validar plano
→ somente então verificar status/mídia

Essa regra vale para:

- bootstrap do embed;
- `/activate`;
- preview interno;
- futuros providers;
- futuras APIs de mídia.

---

# 5. Serviço central de autorização

Criar/reutilizar uma camada central de autorização de playback.

Exemplo conceitual:

resolvePlaybackEntitlement(publicId)

Responsabilidades:

- resolver registro mínimo do vídeo;
- resolver accountId;
- resolver owner;
- validar assinatura ativa;
- retornar contexto autorizado mínimo.

Exemplo conceitual de retorno:

{
  videoId,
  accountId,
  ownerUserId,
  activePlan
}

Essa função NÃO deve retornar:

- playback URL;
- playback ID;
- provider media ID;
- manifest;
- token.

A autorização de mídia acontece posteriormente.

---

# 6. Separação em duas fases

## Fase 1 — Entitlement

Responsável somente por:

publicId
→ conta
→ owner
→ plano ativo

Falha:

→ 403
→ nenhum processamento de mídia posterior.

## Fase 2 — Playback

Só pode começar após sucesso da Fase 1.

Responsável por:

- carregar registro completo do vídeo se necessário;
- verificar status ready;
- verificar provider;
- verificar playback ID;
- validar quota;
- registrar Play;
- gerar autorização temporária;
- retornar stream.

---

# 7. Bootstrap público

Endpoint:

GET /api/embed/videos/[publicId]

Também deve executar primeiro a Fase 1.

Fluxo:

publicId
→ identidade mínima
→ owner
→ plano ativo

Sem plano:

403

e interromper.

Não retornar:

- título;
- config;
- poster;
- preview;
- duração;
- HLS;
- playback ID;
- detalhes da conta.

Mensagem pública genérica:

`Este vídeo está temporariamente indisponível.`

---

# 8. Bootstrap autorizado

Somente após assinatura válida, o bootstrap pode carregar informações visuais:

- publicId;
- title;
- duration;
- config;
- posterUrl;
- backgroundPreviewUrl.

Mesmo quando autorizado, NÃO retornar:

- playbackUrl;
- playback.url;
- muxPlaybackId;
- providerPlaybackId;
- manifest HLS.

O bootstrap nunca libera o vídeo completo.

---

# 9. Cache

O bootstrap deve continuar utilizando:

Cache-Control: private, no-cache, no-store, must-revalidate

Nenhuma decisão de autorização de plano deve ficar presa em cache público.

Após remoção do plano, um novo request deve perceber imediatamente a mudança.

---

# 10. UX do embed sem plano

Quando o bootstrap retornar 403:

mostrar estado neutro:

`Este vídeo está temporariamente indisponível.`

Não revelar:

- ausência de plano;
- cobrança;
- quota;
- vencimento;
- dados da conta.

---

# 11. Player público sem HLS inicial

O player não recebe mais HLS no bootstrap.

Fluxo:

bootstrap autorizado
→ renderiza poster/preview/config
→ nenhum HLS conectado
→ usuário solicita reprodução
→ chama `/activate`
→ aguarda autorização
→ recebe signed playback URL
→ conecta HLS
→ reproduz.

Não:

- preload do HLS;
- buffering antecipado;
- attach antecipado;
- `video.src` antecipado.

---

# 12. Background Autoplay

Preservar o efeito visual atual de Background Autoplay utilizando:

- derived background preview;
- poster;
- R2 asset;
- imagem/preview autorizado.

Não utilizar o vídeo completo como background antes da autorização.

Background Autoplay visual não equivale a Playback autorizado.

---

# 13. Remover ativação fire-and-forget

Eliminar o fluxo onde:

- o player já possui HLS;
- inicia reprodução;
- chama `/activate` apenas como relatório.

`/activate` não é analytics.

`/activate` é autorização.

Playback depende obrigatoriamente de resposta positiva desse endpoint.

---

# 14. Autorização client-side única

Criar uma abstração equivalente a:

authorizePlaybackOnce()

Responsabilidades:

- gerar ou reutilizar playSessionId;
- disparar `/activate`;
- aguardar;
- impedir requests concorrentes duplicados;
- validar resposta;
- armazenar a URL temporária retornada;
- devolver a URL ao player.

Se falhar:

- não anexar mídia;
- não tocar;
- limpar Promise pendente;
- permitir Retry.

---

# 15. Play Session ID

Manter um único:

playSessionId

por jornada/instância do player.

Retries reutilizam o mesmo ID.

Isso mantém:

- idempotência;
- quota correta;
- preparação para Analytics futuro.

---

# 16. Endpoint `/activate`

Endpoint:

POST /api/embed/videos/[publicId]/activate

Fluxo obrigatório:

FASE 1

1. validar publicId;
2. buscar video.id + accountId;
3. resolver owner;
4. validar assinatura ativa.

Se falhar:

→ 403
→ parar imediatamente.

FASE 2

5. carregar informações necessárias da mídia;
6. validar status ready;
7. validar provider/playback ID;
8. validar quota;
9. registrar Play;
10. gerar autorização temporária;
11. retornar signed playback URL.

Não inverter essa ordem.

---

# 17. Ausência de vídeo

Se nenhum registro puder ser resolvido pelo `publicId`, retornar resposta apropriada de indisponibilidade/404.

Entretanto, não expor informações adicionais que permitam enumerar estado de assinatura ou infraestrutura.

---

# 18. Preview do editor

O editor também segue:

publicId
→ conta
→ owner
→ plano ativo

SEM plano:

→ bloqueado.

COM plano:

→ validar que usuário autenticado tem acesso à conta;
→ permitir playback;
→ isentar quota.

A exceção do editor vale somente para quota.

Ela NÃO ignora plano.

---

# 19. `isEditor` não é confiança

Nunca confiar apenas em:

isEditor: true

Validar server-side:

- sessão Better Auth;
- usuário;
- account membership;
- vídeo pertencente à conta.

Um visitante não autenticado não pode falsificar preview interno.

---

# 20. Quota

Depois da autorização de plano:

- consultar limite de Plays;
- registrar `play_sessions`;
- atualizar `monthly_usage`.

Preservar atomicidade e idempotência existente.

O mesmo:

videoId + playSessionId

não pode consumir dois Plays.

---

# 21. Mux Signed Playback

Vídeos Mux devem utilizar:

signed playback policy

Não utilizar `public` para novos uploads.

Adicionar:

MUX_SIGNING_KEY_ID
MUX_SIGNING_PRIVATE_KEY

Opcional:

MUX_PLAYBACK_TOKEN_TTL_SECONDS

Atualizar `.env.example`.

Signing credentials são exclusivamente server-side.

---

# 22. Novos uploads Mux

Direct Uploads novos devem gerar assets com:

signed playback policy.

Quando o asset ficar ready, salvar somente um Playback ID com:

policy = signed

Não utilizar:

public || primeiro ID

como fallback.

---

# 23. Signed playback URL

Após todas as validações, criar:

getMuxSignedPlaybackUrl(...)

Forma conceitual:

https://stream.mux.com/{playbackId}.m3u8?token={JWT}

Utilizar helper oficial do SDK Mux instalado sempre que possível.

Token deve possuir:

- audience correto;
- expiration;
- claims necessários.

Nunca criar JWT no browser.

---

# 24. TTL

Utilizar TTL limitada.

Default sugerido:

3600 segundos.

Pode ser configurável por env.

Não criar token sem vencimento.

Uma autorização emitida antes da remoção do plano pode permanecer válida somente até seu `exp`.

Isso é aceitável.

Novas autorizações devem ser bloqueadas imediatamente.

---

# 25. Thumbnails assinados

Playback IDs signed também afetam recursos de:

image.mux.com

Auditar:

- Library;
- Folder view;
- VideoCard;
- página de detalhes;
- embed bootstrap;
- poster;
- background preview generation.

Não construir URLs diretamente no client através de:

video.muxPlaybackId.

Criar helpers server-side para URLs/token de thumbnail.

---

# 26. Poster no bootstrap

Somente após a Fase 1 autorizada o bootstrap pode gerar poster.

Sem plano:

nenhum poster/token deve ser retornado.

Thumbnail authorization é independente da autorização de Video Playback.

---

# 27. Background preview

Preservar R2.

Assets já armazenados no R2 continuam válidos.

Ao gerar novos background previews a partir de Mux signed playback IDs:

- utilizar autenticação apropriada para imagens;
- nunca criar Playback ID público somente para preview.

Falha no preview não deve impedir vídeo ready.

---

# 28. Preview da página autenticada

A página:

`/videos/[videoId]`

não deve enviar HLS direto para o client.

O preview interno deve chamar o mesmo `/activate`.

Se necessário, manter:

videoId
→ ID interno do runtime/app

playbackPublicId
→ publicId utilizado para autorização.

Não misturar esses dois conceitos.

---

# 29. Migração de assets existentes

Criar:

scripts/secure-mux-playback.mjs

Comando:

pnpm mux:secure-playback

Suportar:

--dry-run

Para cada vídeo Mux existente:

1. localizar Asset;
2. verificar signed Playback ID;
3. criar signed ID se necessário;
4. persistir signed ID no DB;
5. confirmar persistência;
6. remover todos os public Playback IDs;
7. confirmar ausência de public IDs.

---

# 30. Segurança da migração

Nunca remover public playback antes de confirmar:

- signed playback criado;
- signed ID persistido no DB.

Não:

- reuploadar;
- recriar asset;
- deletar vídeo.

Script deve ser idempotente.

Se algum asset terminar ainda público por erro:

- reportar;
- exit code não-zero.

---

# 31. Auditoria de URLs

Buscar globalmente:

stream.mux.com
image.mux.com
getHlsPlaybackUrl
muxPlaybackId
playbackUrl

Nenhum client público deve receber uma URL HLS não autorizada.

---

# 32. Bundle público

Nunca incluir:

- MUX_SIGNING_PRIVATE_KEY;
- MUX_TOKEN_SECRET;
- funções server-side de assinatura.

Após alteração:

pnpm build:embed

Regenerar:

public/embed/v1/watchmap-player.js

---

# 33. Painel `/dev`

Corrigir o modal "Configurar Plano do Usuário".

Estado inicial:

sem plano ativo
→ none

Pro ativo sem vencimento
→ pro_permanent

Pro ativo com vencimento
→ pro_temporary

O estado default local também deve ser:

none

Nunca assumir Pro como fallback.

---

# 34. Reset do modal

Ao abrir o modal:

resetar:

planMode = none
temporaryType = days
durationDays = 30
expirationDate = ""

Depois preencher o estado real daquele usuário.

Isso impede vazamento de estado do usuário anteriormente selecionado.

---

# 35. Salvar plano

Após salvar:

- fechar modal;
- revalidar `/dev`;
- atualizar listagem;
- usar router.refresh() se necessário.

Reabrir imediatamente deve refletir o novo estado persistido.

---

# 36. Backend do Dev Panel

Preservar a lógica existente:

Sem plano:

- marcar subscription ativa como inactive;
- preencher endedAt;
- não criar nova subscription.

Não apagar histórico.

---

# 37. Cenário — Plano ativo

Conta possui Pro ativo.

Bootstrap:

→ entitlement autorizado
→ retorna visual/config
→ NÃO retorna HLS.

Play:

→ activate
→ entitlement autorizado
→ vídeo ready
→ quota disponível
→ registra Play
→ gera signed URL
→ toca.

---

# 38. Cenário — Remoção do plano

Conta possui Pro.

Vídeo funciona.

Admin remove plano.

A partir daí:

GET bootstrap
→ resolve conta
→ owner
→ sem assinatura
→ 403

POST activate
→ resolve conta
→ owner
→ sem assinatura
→ 403

Nenhum status de mídia ou playback URL precisa ser processado depois disso.

---

# 39. Cenário — Plano expirado

subscription.status = active

mas:

expiresAt <= now

Resultado:

→ entitlement falha;
→ bootstrap 403;
→ activate 403.

---

# 40. Cenário — Vídeo não ready, conta sem plano

Esse caso valida especificamente a ordem.

Conta sem plano.

Vídeo processing/errored/not ready.

Resultado:

→ plano é validado antes de status de mídia;
→ request para playback termina na autorização;
→ não processar provider/playback ID.

---

# 41. Cenário — Vídeo não ready, conta com plano

Conta possui plano.

Depois da autorização:

→ consultar status;
→ vídeo indisponível;
→ retornar estado de mídia apropriado.

---

# 42. Cenário — Quota esgotada

Conta possui plano ativo.

Bootstrap pode carregar.

No Play:

→ plano validado;
→ vídeo ready;
→ quota excedida;
→ activate bloqueia;
→ nenhum signed HLS é retornado.

---

# 43. Cenário — Editor

Plano ativo + editor autorizado:

→ playback permitido;
→ quota não incrementa.

Sem plano + editor:

→ entitlement falha;
→ playback bloqueado.

---

# 44. Cenário — URL direta

Signed Playback ID sem JWT:

→ Mux recusa.

URL signed válida:

→ funciona até expiração.

---

# 45. Cenário — URL pública antiga

Após migração:

- public Playback IDs não existem mais no Asset;
- URLs públicas antigas deixam de reproduzir.

---

# 46. Cenário — Dev Panel sem plano

1. usuário Pro;
2. remover plano;
3. salvar;
4. tabela mostra Sem plano;
5. abrir modal novamente;
6. `Sem plano` está selecionado.

---

# Critérios de aceite

- A resolução de conta acontece antes da consulta de mídia.
- Owner é resolvido antes da consulta de mídia.
- Plano ativo é validado antes de status ready.
- Plano ativo é validado antes de playback ID.
- Plano ativo é validado antes de quota.
- Plano ativo é validado antes de geração de token.
- Falha de entitlement interrompe imediatamente o fluxo.
- Bootstrap não retorna HLS.
- Bootstrap sem plano retorna 403.
- `/activate` sem plano retorna 403.
- Nenhum HLS é anexado antes da autorização.
- Player depende da resposta do `/activate`.
- Não existe ativação fire-and-forget.
- Editor não ignora plano.
- Editor autenticado pode ser isento de quota.
- Novos vídeos Mux usam signed policy.
- Existing assets podem ser migrados para signed.
- Public playback IDs são removidos.
- Signed playback sem JWT falha.
- Signing secrets não aparecem no client.
- Thumbnails continuam funcionando.
- Background preview continua funcionando.
- Preview interno utiliza autorização.
- Play continua idempotente.
- Quota continua funcional.
- Plano expirado bloqueia mídia.
- Modal `/dev` reflete corretamente `none`, permanent e temporary.
- Reabrir modal após remover plano continua mostrando `Sem plano`.