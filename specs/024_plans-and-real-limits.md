# Spec 024 — Plans and Real Limits

## Objetivo

Implementar a fundação real de planos do Evandro.

Inicialmente existe apenas:

```text
Pro
```

Limites do Pro:

```text
10 vídeos ativos
5.000 Plays por mês
20 minutos por vídeo
até 1080p
```

Esses limites devem ser aplicados de verdade pelo servidor.

Não confiar no frontend.

Uma conta nova NÃO recebe Pro automaticamente.

Fluxo obrigatório:

```text
criou conta
↓
autenticou
↓
nenhum plano ativo
↓
acesso bloqueado
```

Tela:

```text
Você não tem nenhum plano ativo.
```

Somente uma conta com plano ativo pode usar a plataforma.

---

## 1. Regra de autorização

Autenticação e autorização são coisas diferentes.

```text
sessão válida
≠
acesso ao Evandro
```

A regra passa a ser:

```text
sessão válida
+
plano ativo
=
acesso
```

Sem plano ativo:

```text
acesso negado
```

Isso deve ser validado server-side.

---

## 2. Plano Pro

Criar catálogo central de planos.

Exemplo conceitual:

```ts
PRO = {
  code: "pro",
  name: "Pro",

  limits: {
    maxVideos: 10,
    maxPlaysPerMonth: 5000,
    maxVideoDurationSeconds: 1200,
    maxPlaybackResolution: 1080,
  }
}
```

Uma única fonte de verdade.

Não espalhar:

```text
10
5000
1200
1080
```

pelo código.

---

## 3. Views ≠ Plays

Preservar a terminologia oficial:

### View

O player foi renderizado para o visitante.

```text
player renderizado
→ View
```

### Play

O visitante iniciou intencionalmente o playback principal.

Exemplos:

```text
clicou Play
→ Play

clicou no CTA que ativa/inicia o vídeo principal
→ Play
```

Não contam como Play:

```text
player renderizado
background preview
background autoplay
loop do background
poster
```

Não utilizar Views para controlar o limite do plano.

O limite do Pro é:

```text
5.000 Plays/mês
```

---

# PLANO E ACESSO

## 4. Persistência

Criar estrutura persistida para assinatura.

Conceitualmente:

```text
subscriptions
```

Campos mínimos:

```text
id
userId
planCode
status
startedAt
endedAt
createdAt
updatedAt
```

Status mínimo:

```text
active
inactive
```

Somente:

```text
active
```

autoriza uso da plataforma.

---

## 5. Conta nova

Ao criar usuário:

NÃO:

```text
atribuir Pro
criar subscription ativa
assumir plano padrão
```

Resultado:

```text
plan = null
```

---

## 6. Guard central

Criar camada server-side centralizada.

Exemplo:

```text
src/lib/plans/access.ts
```

Com funções equivalentes a:

```text
getActivePlanForUser(userId)

requireActivePlanForUser(userId)

requireActivePlan()
```

`requireActivePlan()` deve:

```text
resolver sessão
↓
resolver assinatura
↓
resolver catálogo do plano
↓
retornar plano + limites
```

Se não existir:

```text
NO_ACTIVE_PLAN
```

---

## 7. Tela sem plano

Criar:

```text
/no-plan
```

Renderização server-side.

Conteúdo principal:

```text
Você não tem nenhum plano ativo.
```

Pode possuir:

```text
Sair da conta
```

Não mostrar funcionalidades da plataforma.

---

## 8. Proteção do App

Fluxo:

```text
sem sessão
→ login

com sessão + sem plano
→ /no-plan

com sessão + plano ativo
→ aplicação
```

O layout privado deve validar isso no servidor.

---

## 9. Layout não é segurança

Não basta bloquear páginas.

Toda operação privada deve validar plano server-side.

Incluindo:

```text
vídeos
upload
Mux Direct Upload
configuração
delete
sync
analytics privados
preview real
demais ações autenticadas
```

Usuário sem plano chamando API manualmente:

```text
403 / erro equivalente
```

---

# LIMITE REAL DE VÍDEOS

## 10. Limite

Pro:

```text
10 vídeos
```

Contam como ocupando slot:

```text
waiting_upload
uploading
processing
ready
```

Vídeo removido:

```text
não conta
```

Erro cujo asset já foi limpo:

```text
não deve ocupar slot permanentemente
```

---

## 11. Enforcement

A validação deve acontecer ANTES de criar Direct Upload Mux.

Fluxo:

```text
criar vídeo
↓
requireActivePlan
↓
reservar slot
↓
se disponível
    criar registro
    criar Direct Upload Mux

se indisponível
    bloquear
```

Erro:

```text
VIDEO_LIMIT_REACHED
```

---

## 12. Concorrência

Esse limite precisa funcionar mesmo com requests simultâneas.

Cenário obrigatório:

```text
usuário possui 9 vídeos

request A
request B

as duas chegam simultaneamente
```

Resultado correto:

```text
uma cria o 10º
outra é bloqueada
```

NUNCA:

```text
11 vídeos
```

---

## 13. Reserva atômica do slot

Implementar reserva do slot dentro de transaction PostgreSQL.

Uma estratégia válida:

```text
BEGIN

lock da subscription/owner
↓
COUNT vídeos que ocupam slot
↓
se count >= maxVideos
    abortar

criar registro reservado/waiting_upload

COMMIT
```

Depois da reserva:

```text
criar Direct Upload Mux
```

Não manter transaction aberta durante chamada externa ao Mux.

Se criação no Mux falhar:

```text
limpar/liberar registro reservado
```

---

# LIMITE DE DURAÇÃO

## 14. Duração

Pro:

```text
20 minutos
```

ou:

```text
1200 segundos
```

Validação client-side pode existir apenas para feedback rápido.

Validação definitiva:

```text
Mux Asset.duration
```

---

## 15. Vídeo acima do limite

Se:

```text
duration > 1200
```

então:

```text
não disponibilizar playback
remover Asset Mux
marcar erro apropriado
liberar slot de vídeo
```

Mensagem para o proprietário:

```text
Este vídeo ultrapassa o limite de 20 minutos do seu plano.
```

---

# QUALIDADE

## 16. 1080p

Pro permite:

```text
até 1080p
```

O source original pode possuir resolução superior.

O playback não deve precisar exceder 1080p.

Adaptar configuração Mux existente conforme capacidade da integração atual.

Não implementar seletor manual de qualidade.

---

# LIMITE REAL DE PLAYS

## 17. Usage mensal

Criar persistência mensal.

Exemplo:

```text
monthlyUsage
```

Campos mínimos:

```text
id
userId
periodKey
plays
createdAt
updatedAt
```

Unique:

```text
userId + periodKey
```

`periodKey`:

```text
YYYY-MM
```

calculado server-side em UTC.

---

## 18. Reset

Não criar cron para zerar Plays.

Exemplo:

```text
2026-09
plays = 4921

2026-10
plays = 0
```

Cada mês possui seu próprio registro.

---

## 19. Play Session

Cada instância pública de playback deve possuir:

```text
playSessionId
```

Esse identificador permanece durante aquela sessão.

Exemplo:

```text
Play
Pause
Play
Seek
Pause
Play
```

continua:

```text
1 Play
```

---

## 20. Idempotência

Criar persistência para sessões contabilizadas.

Exemplo:

```text
playSessions
```

Campos:

```text
id
videoId
ownerUserId
playSessionId
createdAt
```

Unique:

```text
videoId + playSessionId
```

A mesma sessão nunca pode cobrar dois Plays.

---

## 21. Primeiro Play

Quando o visitante inicia intencionalmente o vídeo principal:

```text
player
↓
servidor
↓
validate playback
```

Servidor:

```text
vídeo existe?
↓
owner possui plano ativo?
↓
playSession já contabilizada?
↓
quota disponível?
↓
registrar Play
↓
autorizar HLS
```

---

## 22. HLS protegido pelo limite

O bootstrap público NÃO deve entregar antecipadamente a URL HLS principal.

Antes do Play pode entregar:

```text
PlayerConfig
poster
backgroundPreviewUrl
metadata pública necessária
```

A URL do playback principal só deve ser entregue após autorização server-side.

Isso é obrigatório para o limite funcionar de verdade.

---

## 23. Endpoint de ativação

Criar operação pública equivalente a:

```text
POST /api/public/videos/{id}/activate
```

ou arquitetura equivalente existente.

Input mínimo:

```text
playSessionId
```

O servidor resolve o restante.

Não aceitar do navegador:

```text
userId
planCode
playLimit
currentUsage
muxPlaybackId arbitrário
```

---

## 24. Incremento atômico

Para nova sessão:

```text
registrar sessão
+
incrementar Plays
+
validar limite
```

deve acontecer em transaction.

Não implementar:

```text
SELECT plays
↓
if plays < 5000
↓
UPDATE
```

sem proteção contra concorrência.

---

## 25. Estratégia recomendada

Conceitualmente:

```text
BEGIN

garantir monthlyUsage row

INSERT playSession
ON CONFLICT DO NOTHING
RETURNING id
```

Se sessão já existe:

```text
não incrementar novamente
autorizar sessão já aceita
```

Se sessão é nova:

```text
UPDATE monthlyUsage
SET plays = plays + 1
WHERE
  userId = ?
  AND periodKey = ?
  AND plays < maxPlays
RETURNING plays
```

Se UPDATE não retornar registro:

```text
quota esgotada
ROLLBACK
```

Se funcionar:

```text
COMMIT
autorizar playback
```

Adapte ao Drizzle/PostgreSQL real.

---

## 26. 4.999 → 5.000

Obrigatório:

```text
plays = 4999
```

Nova sessão:

```text
plays = 5000
playback autorizado
```

Próxima nova sessão:

```text
bloqueada
```

Nunca permitir:

```text
5001
```

mesmo com requests concorrentes.

---

## 27. Retry

Se o browser repetir a mesma activation request:

```text
mesmo playSessionId
```

resultado:

```text
não incrementar
```

A sessão já autorizada pode continuar recebendo a autorização necessária.

---

## 28. Background Autoplay

Background preview:

```text
View
```

mas:

```text
0 Plays
```

O HLS principal NÃO deve carregar durante background preview.

Quando houver uma ação intencional que inicia o vídeo principal:

```text
activate playback
↓
Play
```

---

## 29. Preview interno

Editor:

```text
0 Plays
```

"Testar reprodução":

```text
0 Plays
```

O administrador testando o próprio vídeo não consome quota.

Essa exclusão deve existir server-side.

---

## 30. Limite esgotado

Owner:

```text
5.000 / 5.000 Plays
```

Novo visitante tentando iniciar:

```text
playback negado
```

Não entregar HLS.

Mensagem pública neutra:

```text
Este vídeo está temporariamente indisponível.
```

Não mencionar cobrança/quota ao visitante.

---

# PLANO INATIVO

## 31. Player público

Se proprietário não possui plano ativo:

```text
player pode renderizar estado público mínimo
```

mas:

```text
playback principal NÃO pode ser autorizado
```

Mensagem:

```text
Este vídeo está temporariamente indisponível.
```

---

## 32. Revogação imediata

Se Pro for revogado:

```text
próxima request privada
→ bloqueada

nova ativação pública
→ bloqueada
```

Não depender de logout.

---

# PAINEL

## 33. Usage

Expor dados server-side:

```text
Plano
Pro

Vídeos
6 / 10

Plays
2847 / 5000
```

Views podem continuar existindo como métrica analítica separada.

Não misturar:

```text
Views
Plays
```

---

# ATRIBUIÇÃO MANUAL

## 34. Sem billing ainda

Não existe checkout nesta spec.

Criar mecanismo administrativo local/server-side.

Exemplo:

```text
pnpm plan:grant-pro email@dominio.com
```

e:

```text
pnpm plan:revoke email@dominio.com
```

Não criar endpoint público para isso.

---

## 35. Grant

Grant deve:

```text
buscar usuário
↓
encerrar subscription ativa incompatível se necessário
↓
criar/ativar Pro
```

Operação idempotente.

Executar duas vezes:

```text
continua apenas um Pro ativo
```

---

## 36. Revoke

Revoke:

```text
status → inactive
endedAt → now
```

Depois disso:

```text
acesso negado imediatamente em novas requests
```

---

# BANCO

## 37. Migration

Criar migration Drizzle nova.

Não editar migrations históricas.

Adicionar estruturas necessárias para:

```text
subscriptions
monthlyUsage
playSessions
```

Com:

```text
FKs
unique constraints
indexes
```

---

# TESTES OBRIGATÓRIOS

## 38. Nova conta

```text
signup
↓
login
↓
/no-plan
```

Texto:

```text
Você não tem nenhum plano ativo.
```

---

## 39. Bypass de URL

Sem plano:

```text
/dashboard
/videos
/config
```

Resultado:

```text
bloqueado server-side
```

---

## 40. Bypass de API

Sem plano:

chamar APIs manualmente.

Resultado:

```text
negado
```

---

## 41. Grant Pro

```text
grant
↓
refresh
↓
acesso
```

---

## 42. Vídeos

Testar:

```text
9 vídeos
→ criação permitida

10 vídeos
→ criação negada
```

Teste também duas criações simultâneas partindo de 9.

Resultado:

```text
máximo final = 10
```

---

## 43. Plays

Testar:

```text
abrir player
→ 0

background preview
→ 0

primeiro foreground intencional
→ 1

pause
→ play
→ continua 1

retry activation
→ continua 1

nova sessão
→ +1
```

---

## 44. Concorrência de Plays

Com:

```text
4999 Plays
```

disparar duas novas sessões simultaneamente.

Resultado obrigatório:

```text
uma autorizada
uma bloqueada

usage final = 5000
```

Nunca:

```text
5001
```

---

## 45. Quota esgotada

Com:

```text
5000 / 5000
```

nova sessão:

```text
nenhum HLS
nenhum incremento
playback negado
```

---

## 46. Duração

```text
19:59
→ permitido

20:00
→ permitido

20:01
→ rejeitado
```

---

## 47. Revoke

Com usuário logado:

```text
revoke Pro
```

Na próxima request:

```text
/no-plan
```

Player público:

```text
novo Play negado
```

---

## 48. Validação técnica

Executar:

```text
pnpm typecheck
pnpm lint
pnpm build
pnpm build:embed
```

---

## Critérios de aceite

A feature só está concluída se:

```text
1. conta nova não recebe plano;
2. sem plano não entra na aplicação;
3. proteção existe no servidor;
4. Pro pode ser concedido manualmente;
5. 10 vídeos é limite real;
6. concorrência não permite 11 vídeos;
7. 5.000 Plays é limite real;
8. concorrência não permite 5.001 Plays;
9. mesma playSession não conta duas vezes;
10. HLS só é entregue depois da autorização;
11. Background Preview não conta Play;
12. preview interno não conta Play;
13. 20 minutos é validado;
14. Pro revogado bloqueia novas requests;
15. Views e Plays permanecem conceitos separados.
```

Não implemente funcionalidades além das especificadas.