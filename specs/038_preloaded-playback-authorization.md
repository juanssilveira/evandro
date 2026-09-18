# 038 — Preloaded Playback Authorization

## Objetivo

Garantir que toda decisão sobre permitir ou bloquear o player aconteça no carregamento da página.

Regra definitiva:

```text
LOAD = autorização + limites + preparação da mídia
PLAY = reprodução + tracking
```

Nenhuma verificação de plano, quota ou autorização pode acontecer no clique do usuário.

---

# 1. Fluxo definitivo

Ao carregar:

```text
publicId
↓
resolver vídeo/account/owner
↓
assinatura ativa?
↓
limites disponíveis?
↓
vídeo ready?
↓
playbackId disponível?
↓
SIM
↓
retornar playbackUrl
↓
anexar HLS
↓
player preparado
```

Se assinatura inválida:

```text
403
→ não entrega stream
```

Se limites já estiverem esgotados:

```text
403
→ não entrega stream
```

Depois que o player foi liberado:

```text
click
↓
video.play() imediatamente
↓
tracking em background
```

---

# 2. Bootstrap é a única barreira

Endpoint:

```text
GET /api/embed/videos/[publicId]
```

Deve:

1. validar `publicId`;
2. resolver `video.id + accountId`;
3. resolver owner;
4. verificar assinatura ativa;
5. verificar uso atual do plano;
6. bloquear se algum limite relevante já estiver esgotado;
7. carregar o vídeo;
8. validar `status === ready`;
9. validar `muxPlaybackId`;
10. montar playback URL pública;
11. retornar player completo.

Não registrar Play durante esse processo.

---

# 3. Verificação de limites

Criar/reutilizar função somente de consulta, equivalente a:

```ts
canLoadPlayback(ownerUserId, activePlan)
```

Ela verifica o uso atual sem alterar dados.

Para Plays:

```text
monthly_usage.plays < maxPlaysPerMonth
```

Se:

```text
plays >= maxPlaysPerMonth
```

o player não é liberado.

Não:

- reservar quota;
- incrementar contador;
- criar playSession;
- criar locks.

---

# 4. Race condition aceita

É aceitável que duas páginas carregadas quase simultaneamente passem pela verificação quando existir apenas uma unidade de quota restante.

Exemplo:

```text
4999 / 5000
↓
duas páginas carregam simultaneamente
↓
ambas podem ser liberadas
```

Não adicionar complexidade para impedir esse caso.

Essa pequena diferença de contabilização é aceita nesta versão.

---

# 5. Bootstrap autorizado

Resposta:

```json
{
  "videoId": "...",
  "title": "...",
  "duration": 123,
  "playbackUrl": "https://stream.mux.com/PLAYBACK_ID.m3u8",
  "playback": {
    "type": "hls",
    "url": "https://stream.mux.com/PLAYBACK_ID.m3u8"
  },
  "posterUrl": "...",
  "backgroundPreviewUrl": "...",
  "config": {}
}
```

O stream já vem liberado no carregamento.

---

# 6. EmbedPlayer

`EmbedVideoData` deve possuir:

```ts
playbackUrl?: string | null
```

Resolver:

```ts
json.playback?.url || json.playbackUrl || null
```

Passar imediatamente:

```tsx
<WatchMapPlayer
  src={data.playbackUrl || undefined}
  ...
/>
```

Não existe segunda autorização para obter `src`.

---

# 7. Preparação do player

Quando `src` chegar:

```text
attachMediaSource(src)
↓
Hls.loadSource(src)
↓
Hls.attachMedia(video)
↓
manifest
↓
metadata/buffer
```

Isso acontece durante o carregamento.

O player deve chegar ao primeiro clique já preparado.

---

# 8. Primeiro Play

O clique não consulta backend para decidir se pode tocar.

Fluxo:

```text
video.play()
```

imediatamente.

Depois:

```text
recordPlayOnce()
```

em background.

Nunca:

```text
click
→ await backend
→ verificar plano
→ verificar quota
→ receber autorização
→ play
```

---

# 9. Tracking não é autorização

O endpoint atualmente chamado `/activate` deixa de ser um endpoint de autorização.

Ele passa a ser exclusivamente de:

- tracking;
- registro de `play_session`;
- incremento de `monthly_usage`.

Pode ser mantido com o nome atual temporariamente para evitar refactor desnecessário.

Mas conceitualmente:

```text
/activate = record Play
```

e NÃO:

```text
/activate = autorizar playback
```

---

# 10. Nenhuma verificação no Play

O endpoint de registro de Play NÃO deve:

- verificar assinatura ativa;
- verificar quota disponível;
- bloquear reprodução;
- retornar playbackUrl;
- gerar autorização;
- decidir se o vídeo pode tocar.

A decisão já foi tomada pelo bootstrap.

---

# 11. Registro do Play

No primeiro Play:

```text
video.play()
+
POST tracking em background
```

Preservar:

```text
playSessionId
```

e a idempotência:

```text
videoId + playSessionId
```

Pause/play novamente não deve consumir novo Play.

---

# 12. Atualização de uso

Quando uma nova `play_session` válida for registrada:

```text
monthly_usage.plays += 1
```

Não bloquear o player com base no resultado desse incremento.

Esse uso atualizado será considerado na próxima carga de player.

---

# 13. Comportamento após atingir o limite

Exemplo:

```text
4999 / 5000
↓
player carrega
↓
Play registrado
↓
5000 / 5000
```

Esse player continua funcionando normalmente.

A próxima nova carga:

```text
GET bootstrap
↓
5000 >= 5000
↓
403
```

---

# 14. Remoção de assinatura

Se o player já foi carregado enquanto o plano estava ativo:

```text
sessão atual pode continuar
```

Se o plano for removido:

```text
novo load/reload
↓
bootstrap
↓
403
```

Não implementar revogação em tempo real de players já carregados.

---

# 15. Background Autoplay

Com:

```text
backgroundAutoplay = true
```

o fluxo deve ser:

```text
bootstrap
↓
assinatura + limites OK
↓
playbackUrl
↓
HLS anexado
↓
manifest pronto
↓
muted
↓
loop
↓
autoplay
```

No clique:

```text
loop = false
currentTime = 0
restaurar volume
foreground playback
```

Sem nova consulta ao backend.

Sem trocar `src`.

Sem recriar HLS.

---

# 16. Player normal

Com:

```text
backgroundAutoplay = false
```

ao carregar:

```text
HLS anexado
↓
player pausado e preparado
```

No clique:

```text
video.play()
```

imediatamente.

---

# 17. Editor

O preview interno segue a mesma lógica:

```text
page load
↓
acesso/plano válidos
↓
playbackUrl
↓
HLS preparado
```

Nenhuma autorização deve ocorrer no primeiro clique.

Tracking pode continuar separado/isento conforme comportamento atual do editor.

---

# 18. Cold start

Nenhum cold start do WatchMap pode existir entre:

```text
clique
```

e:

```text
início da reprodução
```

Toda consulta a:

- banco;
- assinatura;
- uso do plano;
- vídeo;
- backend Next.js;

deve acontecer no carregamento.

---

# 19. Fora de escopo

Não implementar:

- signed playback;
- JWT;
- proxy;
- reserva de quota;
- locks;
- autorização no Play;
- polling de plano;
- revogação instantânea;
- provider abstraction;
- Bunny;
- analytics novo.

---

# Critérios de aceite

- Assinatura é verificada no bootstrap.
- Limites são verificados no bootstrap.
- Player não carrega se assinatura estiver inválida.
- Player não carrega se quota já estiver esgotada.
- Bootstrap não incrementa Plays.
- Bootstrap autorizado retorna playbackUrl.
- HLS é anexado durante o load.
- Player está preparado antes do primeiro clique.
- Primeiro clique não espera backend.
- Primeiro clique não verifica assinatura.
- Primeiro clique não verifica quota.
- Primeiro clique não troca src.
- Primeiro clique não recria HLS.
- Play é registrado em background.
- Tracking não pode bloquear reprodução.
- `playSessionId` continua idempotente.
- `monthly_usage` continua sendo atualizado.
- Limite atualizado passa a valer no próximo load.
- Pequena race condition de quota é aceita.
- Background Autoplay continua funcionando.
- Player normal continua funcionando.