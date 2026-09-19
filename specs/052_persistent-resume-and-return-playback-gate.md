## Objetivo

Implementar **Persistent Resume** no Evandro Player.

Quando um espectador que **já iniciou playback foreground daquele vídeo anteriormente** retornar à página ou der F5, o player deve:

1. detectar o progresso salvo;
2. **não executar Autoplay nem Background Autoplay**;
3. não apresentar Startup Thumbnail;
4. não apresentar Background Preview;
5. não apresentar Pause Thumbnail;
6. carregar o mesmo vídeo no `PlayerEngine`;
7. posicionar o vídeo no ponto salvo;
8. manter o vídeo pausado nesse ponto;
9. apresentar sobre o próprio frame restaurado uma overlay de decisão:

   * **Continuar assistindo**
   * **Assistir do início**

A overlay existe apenas como um **gate inicial do reacesso**.

Depois que uma das opções for escolhida, o Persistent Resume deixa completamente o caminho crítico e o player volta ao comportamento normal.

A direção já prevista para a 052 na Knowledge Base é lembrar progresso, restaurar estado e oferecer continue/restart sem flashes incorretos de thumbnail/preview.

---

## Princípio central

Persistent Resume **não é um segundo player, uma segunda mídia nem uma segunda autoridade de playback**.

Ele é uma camada de estado sobre o `PlayerEngine` existente.

Continuam valendo integralmente:

* um `HTMLVideoElement`;
* um `PlayerEngine`;
* um lifecycle HLS principal;
* uma autoridade de `currentTime`;
* uma autoridade de first frame;
* nenhum vídeo temporário;
* nenhum HLS adicional;
* nenhum media element dedicado ao Resume.

---

## Semântica de histórico

Uma visita à página **não cria histórico de Resume**.

Preparar mídia **não cria histórico de Resume**.

Decodificar first frame **não cria histórico de Resume**.

Background Autoplay **não cria histórico de Resume**.

Somente playback foreground efetivamente iniciado pelo espectador cria ou atualiza histórico.

Regra conceitual:

```text
visitou
≠
assistiu

bootstrap carregou
≠
assistiu

Background Autoplay rodou
≠
assistiu

foreground playback realmente iniciou
=
histórico resumível
```

---

## Matriz principal de comportamento

### Caso 1 — Primeiro acesso

```text
histórico inexistente
```

Resultado:

```text
Persistent Resume NÃO aparece
→ player segue startup normal
```

Isso significa respeitar normalmente:

* Background Autoplay;
* Startup Thumbnail automática;
* Startup Thumbnail personalizada;
* Thumbnail OFF;
* demais regras atuais do player.

---

### Caso 2 — Já acessou antes, mas nunca deu Play

```text
histórico resumível inexistente
```

Resultado:

```text
Persistent Resume NÃO aparece
→ player segue startup normal
```

Uma page view anterior não deve ser suficiente para criar a experiência de retorno.

---

### Caso 3 — Já iniciou playback anteriormente

Exemplo:

```text
visitou
→ deu Play
→ chegou em 02:14
→ pausou / fechou página / saiu
```

No próximo acesso/F5:

```text
histórico = 02:14
→ Persistent Resume assume prioridade
→ mídia é preparada em ~02:14
→ vídeo permanece pausado
→ frame restaurado aparece
→ overlay Continue / Restart aparece
```

---

## Prioridade absoluta do Resume

Quando existe Resume elegível:

```text
Persistent Resume
>
Autoplay
>
Background Autoplay
>
Startup Thumbnail
>
Pause Thumbnail
```

Na prática, Persistent Resume sobrescreve todos os outros estados de entrada.

Enquanto o gate de Resume estiver ativo:

* `playback.autoplay` não pode iniciar playback;
* `backgroundAutoplay` não pode iniciar;
* Background Preview WebP não pode aparecer;
* Startup Thumbnail automática não pode aparecer;
* Startup Thumbnail personalizada não pode aparecer;
* Big Play da thumbnail não pode aparecer;
* Pause Thumbnail não pode aparecer;
* overlay padrão de pause não pode aparecer;
* controles normais não devem permitir escapar do gate;
* Fake Progress não deve funcionar como UI interativa do gate.

A única escolha inicial é:

```text
Continuar assistindo
ou
Assistir do início
```

---

## Resume precisa preparar primeiro, perguntar depois

O Persistent Resume não deve apresentar uma overlay e somente depois buscar o ponto salvo.

A mídia deve ser preparada **antes da decisão do espectador**.

Fluxo pretendido:

```text
bootstrap
↓
detecta histórico resumível
↓
suprime startup normal
↓
PlayerEngine conecta a mídia
↓
seek para posição salva
↓
aguarda frame correspondente estar disponível
↓
mantém vídeo pausado
↓
revela esse frame
↓
apresenta overlay Resume / Restart
```

Quando o espectador vê a decisão, o vídeo já deve estar essencialmente pronto.

---

## Estado visual durante preparação

No reacesso com Resume:

* não mostrar thumbnail;
* não mostrar preview;
* não iniciar Background Autoplay;
* manter superfície preta enquanto o frame restaurado ainda não estiver seguro;
* não mostrar botões de Resume sobre um frame incorreto.

O frame restaurado somente deve ser revelado quando corresponder ao seek preparado.

---

## Posição restaurada

### Target principal

Preferência:

```text
resumeTarget = savedPosition
```

O player deve tentar restaurar o ponto salvo com a maior precisão disponível.

### Fallback

Se o navegador/provider/HLS não conseguir entregar exatamente o ponto salvo:

```text
usar um ponto ligeiramente anterior
```

Nunca avançar intencionalmente o espectador além do ponto salvo.

Tolerância manual aceitável:

```text
savedPosition - até ~2s
≤
posição restaurada
≤
savedPosition
```

quando a precisão exata não for tecnicamente possível.

Se o seek exato funcionar, ele deve ser utilizado.

---

## Seek antecipado

O Engine deve buscar o ponto resumível o mais cedo possível sem quebrar compatibilidade entre:

* HLS.js;
* native HLS;
* playback direto futuro.

Para HLS.js, pode utilizar a estratégia segura disponível para iniciar/carregar próximo do target, desde que:

* utilize o HLS já pertencente ao `PlayerEngine`;
* não crie outro HLS;
* não crie vídeo auxiliar;
* não cause download intencional desde 0 apenas para depois buscar o Resume se houver forma segura de evitar isso.

Para native HLS:

* aguardar o mínimo de metadata/seekability necessário;
* executar o seek no mesmo `<video>`;
* aguardar confirmação suficiente de que o frame restaurado pertence ao target.

---

## Readiness específica de Resume

O first frame genérico da mídia não é suficiente para considerar Resume pronto.

Resume precisa distinguir:

```text
first frame qualquer
```

de:

```text
frame após o seek de Resume
```

O Engine deve possuir estado explícito de Resume, por exemplo conceitualmente:

```text
none
preparing
ready
resolved
```

E manter:

```text
requestedResumeTime
resolvedResumeTime
```

Nomes finais podem variar, mas a semântica precisa existir.

---

## Proteção contra flash antes da overlay

Existe uma race possível:

```text
Engine prepara frame
→ React Core ainda não montou overlay
→ frame aparece sozinho
```

Isso não é aceitável.

O frame restaurado deve continuar protegido pela startup surface preta até que a UI de Resume esteja pronta para ser apresentada.

Fluxo desejado:

```text
resume frame pronto por baixo
+
Core Resume Overlay montada
↓
liberar superfície preta
↓
frame restaurado + overlay aparecem juntos
```

Não deve existir:

* flash de thumbnail;
* flash de preview;
* flash de vídeo sem overlay;
* Play Button antigo piscando;
* autoplay rodando por baixo.

---

## Ação — Continuar assistindo

Ao clicar:

**Continuar assistindo**

o player já deve estar:

```text
mesma mídia
+
mesmo HTMLVideoElement
+
mesmo Engine
+
já seekado
+
já pausado no ponto correto
```

Portanto a ação é essencialmente:

```text
foreground user intent
+
play()
```

Não fazer:

* reload da mídia;
* novo HLS;
* novo seek ao ponto salvo;
* seek para 0;
* exibir thumbnail;
* exibir Background Preview;
* ativar Background Autoplay.

### Regra importante

O `startForeground()` atual possui comportamento histórico de retornar para `0`.

Esse comportamento **não pode ser utilizado diretamente para Continue** sem adaptação.

A implementação deve fornecer semântica explícita que preserve `currentTime` no Resume.

Exemplo conceitual:

```text
continueFromResume()
```

ou uma evolução segura da API atual.

Resultado:

```text
overlay desaparece
→ vídeo simplesmente continua daquele ponto
```

---

## Ação — Assistir do início

Ao clicar:

**Assistir do início**

o comportamento deve ser:

```text
resolver gate
↓
limpar progresso antigo
↓
seek(0)
↓
foreground playback
```

Não retornar ao pipeline inicial.

Portanto Restart **não deve**:

* mostrar Startup Thumbnail;
* mostrar Background Preview;
* iniciar Background Autoplay;
* reconstruir visual inicial;
* recriar Engine;
* recriar source;
* apresentar Big Play;
* apresentar novamente Resume Overlay.

O player simplesmente volta para:

```text
00:00
```

e inicia playback foreground.

---

## Resume Overlay aparece apenas uma vez por acesso

Existe uma diferença entre:

```text
histórico persistente
```

e:

```text
decisão já tomada nesta instância
```

Depois que Continue ou Restart for selecionado:

```text
resumeDecisionMade = true
```

conceitualmente.

Durante aquele acesso/instância:

* pausar não reapresenta Resume;
* play não reapresenta Resume;
* seek não reapresenta Resume;
* fullscreen não reapresenta Resume;
* buffering não reapresenta Resume.

Após resolver o gate, pauses posteriores voltam para o comportamento comum:

```text
Custom Pause Thumbnail
ou
Continue assistindo / Clique para continuar
```

conforme configuração atual.

---

## Se o espectador não escolher nada

Exemplo:

```text
abre página
→ Resume aparece
→ fecha página
```

O histórico anterior permanece.

No próximo acesso:

```text
Resume aparece novamente
```

A regra “uma vez” é por acesso, não para sempre.

---

## Persistência V1

Nesta spec, Persistent Resume deve permanecer simples e independente do futuro Evandro Tracker.

Não criar:

* tabela de viewer;
* identidade anônima server-side;
* fingerprint;
* endpoint de progresso;
* sincronização cloud;
* analytics;
* sessões cross-device;
* infraestrutura de Tracker.

Persistência V1:

```text
localStorage
```

por vídeo.

Chave conceitual:

```text
evandro:resume:v1:{videoId}
```

Payload mínimo conceitual:

```ts
{
  version: 1,
  position: number,
  duration: number | null,
  updatedAt: number
}
```

Somente dados técnicos mínimos.

Nenhum dado pessoal.

---

## Escopo da persistência V1

Como o embed executa no contexto da página hospedeira, essa persistência será naturalmente limitada a:

```text
mesmo navegador/perfil
+
mesma origin do site que contém o embed
+
mesmo videoId
```

Não é objetivo da 052 suportar:

* outro dispositivo;
* outro navegador;
* outra origin/site;
* visitante identificado globalmente.

Isso poderá evoluir futuramente junto ao Tracker/identidade de viewer.

---

## Falha de storage

`localStorage` pode não estar disponível devido a:

* modo privado específico;
* política do browser;
* quota;
* bloqueios;
* exceções de segurança.

Persistent Resume deve ser **fail-open**.

Se leitura/escrita falhar:

```text
ignorar Resume
→ player funciona normalmente
```

Nunca quebrar playback por causa de storage.

---

## Quando começar a persistir

Não salvar progresso durante:

* bootstrap;
* mídia apenas preparada;
* Background Autoplay;
* preview;
* first frame sem interação;
* Resume ainda aguardando decisão.

A persistência começa somente quando playback foreground efetivamente começou.

Sinal deve vir da autoridade do Engine, não de inferências visuais do React.

---

## Quando atualizar progresso

Depois de foreground playback iniciado:

salvar posição periodicamente com throttle simples, evitando escrever em `localStorage` em todos os frames.

Target recomendado:

```text
aproximadamente a cada 1–2 segundos
```

Também persistir imediatamente em eventos importantes:

* pause;
* `pagehide`;
* `visibilitychange` para hidden;
* antes do teardown do player quando possível;
* seek concluído durante foreground.

Não usar requests de rede.

---

## Background Autoplay jamais salva progresso

Mesmo se o `<video>` estiver realmente tocando e `currentTime` estiver avançando:

```text
experience === background_autoplay
```

não deve criar ou alterar Resume.

Resume representa progresso assistido em foreground.

---

## Restart e persistência

Ao escolher **Assistir do início**:

1. remover imediatamente o histórico antigo;
2. seek para `0`;
3. iniciar playback foreground;
4. depois que a nova reprodução avançar normalmente, novo histórico pode voltar a ser salvo.

Isso garante que o progresso antigo não sobreviva ao Restart.

---

## Vídeo concluído

Quando o vídeo chegar realmente ao evento `ended`:

```text
limpar histórico de Resume daquele vídeo
```

No próximo acesso, o player inicia normalmente.

Não apresentar:

```text
Continuar de 100%
```

---

## Configuração do player

Adicionar configuração:

```ts
playback.persistentResume
```

Tipo:

```ts
boolean
```

Default:

```ts
true
```

Exemplo:

```ts
playback: {
  autoplay: false,
  backgroundAutoplay: false,
  persistentResume: true,
  defaultPlaybackRate: 1,
  defaultVolume: 1
}
```

Atualizar:

* `PlayerConfig`;
* Zod schema;
* `DEFAULT_PLAYER_CONFIG`;
* action validation;
* merge/persistência de player settings;
* bootstrap config;
* Tiny Loader typing;
* Editor settings.

Nenhuma migration de banco é esperada porque Player Config já é JSON persistido.

---

## Persistent Resume OFF

Quando:

```text
playback.persistentResume === false
```

o player:

* não lê Resume para decidir startup;
* não apresenta Resume Overlay;
* não salva progresso novo;
* segue integralmente o comportamento atual da 051.

O histórico local existente pode permanecer armazenado, mas deve ser ignorado enquanto a funcionalidade estiver OFF.

Reativar a configuração torna o histórico local válido novamente, desde que ainda seja tecnicamente utilizável.

---

## Editor

O editor do Evandro Watch não deve criar histórico real de viewer.

Quando:

```text
isEditor === true
```

não:

* ler histórico real para bloquear o preview;
* salvar progresso local;
* contaminar a experiência futura do embed.

O switch de configuração continua visível e editável normalmente.

Não implementar simulador de Resume nesta spec.

---

## UI — configuração

Adicionar em:

```text
Configurações
→ Reprodução
```

próximo das configurações relacionadas ao comportamento inicial.

Label sugerida:

**Retomar reprodução**

Descrição:

**Ao retornar, o espectador pode continuar de onde parou ou assistir novamente desde o início.**

Switch:

```text
ON por padrão
```

Seguir a linguagem visual já existente em `video-settings.tsx`.

Não criar nova tab.

---

## UI — Resume Overlay

Quando Resume estiver pronto:

visual de fundo:

```text
frame real do vídeo restaurado
```

sobre ele:

```text
scrim escuro discreto
+
conteúdo central
```

Copy sugerida:

**Continuar assistindo?**

Texto auxiliar:

**Você parou em 02:14**

Ações:

**Continuar assistindo**

**Assistir do início**

### Hierarquia

`Continuar assistindo`

* ação principal;
* usa `var(--player-accent)`;
* ícone Play quando adequado.

`Assistir do início`

* ação secundária;
* visual neutro;
* ícone de restart/rotate quando adequado.

### Responsividade

Em players estreitos/9:16:

```text
botões empilhados
```

Em espaço suficiente:

```text
podem ficar lado a lado
```

O timestamp deve utilizar o mesmo formatter de tempo já existente no player.

---

## Controles enquanto Resume está ativo

Enquanto a overlay estiver ativa:

* ocultar controles tradicionais;
* impedir click-through para `togglePlay`;
* impedir fullscreen por double click da surface;
* não permitir mute/seek acidental por elementos atrás;
* overlay deve capturar a interação necessária.

Keyboard controls que poderiam iniciar playback não devem furar o gate.

---

## Pause Thumbnail após Continue

Fluxo:

```text
Resume
→ Continuar
→ vídeo reproduz
→ usuário pausa
```

A partir daí:

Persistent Resume não participa mais.

Usar comportamento normal:

```text
pauseThumbnail.enabled = true
→ Custom Pause Thumbnail

pauseThumbnail.enabled = false
→ overlay padrão de pause
```

A arquitetura de pause aceita na 051 deve continuar intacta.

---

## Pause Thumbnail após Restart

Mesmo comportamento:

```text
Resume
→ Assistir do início
→ playback começa em 0
→ usuário pausa
→ Pause UI normal
```

Resume não retorna.

---

## Background Autoplay após escolha

Se o vídeo está configurado com:

```text
backgroundAutoplay = true
```

e entrou pelo fluxo de Persistent Resume:

após Continue ou Restart ele já está em playback foreground.

Não retornar ao Background Autoplay naquela instância.

---

## Autoplay após escolha

A decisão do espectador é uma ação explícita.

Portanto:

```text
Continue
ou
Restart
```

estabelece foreground user intent.

O restante da sessão segue como playback manual normal.

---

## Mudanças no PlayerEngine

A implementação deve evoluir o Engine para reconhecer Resume sem transferir autoridade para React.

Mudanças conceituais esperadas:

### `EngineSourceOptions`

Adicionar informação como:

```ts
resumePosition?: number | null
```

ou estrutura equivalente.

---

### `PlayerEngineState`

Expor estado necessário à UI:

```ts
resumeState
requestedResumeTime
resolvedResumeTime
```

Naming exato fica a critério da implementação desde que a semântica permaneça clara.

---

### Operações

Precisamos de operações semanticamente separadas:

```text
prepare resume
continue existing position
restart from zero
```

Não reutilizar cegamente `startForeground()` se ele continuar contendo:

```text
currentTime = 0
```

Continue nunca pode resetar o playback.

---

## Separação de responsabilidades

### Resume Storage

Responsável por:

* read;
* write;
* clear;
* validation;
* versioning;
* tratamento seguro de storage exceptions.

Zero dependência de React.

---

### Tiny Loader

Responsável por:

* conhecer cedo que há um candidato de Resume;
* depois do bootstrap confirmar se feature está ON;
* não primar Startup Thumbnail/Background Preview quando Resume é elegível;
* passar posição ao Engine;
* preservar budget de bundle.

---

### PlayerEngine

Responsável por:

* attach da mesma mídia;
* seek real;
* estado de preparação;
* currentTime;
* pause;
* Continue;
* Restart;
* mídia pronta para apresentação;
* lifecycle e generation guard.

---

### React Player Core

Responsável por:

* observar estado de Resume;
* renderizar overlay;
* disparar ações Continue/Restart;
* garantir bloqueio das demais interações enquanto gate estiver ativo.

React não deve executar seek paralelo diretamente no `<video>`.

---

## Startup Visual Resolver

Quando Resume está elegível:

o pipeline normal de startup visual precisa ser explicitamente suprimido.

Não tentar representar Resume como:

```text
thumbnail
```

ou:

```text
background preview
```

Resume é outro estado superior de entrada.

A startup visual surface pode permanecer preta como proteção até o frame resumido estar pronto.

---

## Generation guards

Troca de `videoId`, reload de source ou callbacks antigos não podem:

* aplicar posição de outro vídeo;
* reabrir overlay resolvida;
* restaurar thumbnail depois do Resume;
* executar seek tardio;
* sobrescrever progresso atual.

Toda preparação assíncrona de Resume deve respeitar o `_generation` atual do Engine.

---

## Storage validation

Ao ler registro:

invalidar silenciosamente se:

* JSON inválido;
* versão desconhecida;
* `position` não finita;
* posição negativa;
* vídeo/duração tornar o valor impossível;
* estrutura incompleta.

Se registro for inválido:

```text
clear
→ startup normal
```

---

## O que muda tecnicamente

* novo setting `playback.persistentResume`, default ON;
* persistência local de progresso por `videoId`;
* Engine recebe `resumePosition`;
* novo lifecycle de preparação de Resume;
* early seek antes de apresentar decisão;
* supressão de autoplay/background autoplay durante Resume;
* supressão de thumbnails/preview;
* overlay Continue/Restart;
* Continue preserva `currentTime`;
* Restart limpa histórico, seeka `0` e toca;
* limpeza de histórico no `ended`;
* bloqueio da persistência no Editor;
* Tiny Loader passa a considerar Resume antes do startup visual.

---

## O que NÃO deve mudar

Não alterar:

* single media ownership da 051;
* pipeline principal HLS;
* Mux/Bunny delivery;
* regras de Background Preview quando não existe Resume;
* Startup Thumbnail quando não existe Resume;
* custom/provider fallback;
* canonical Play Button;
* Pause Thumbnail normal após o gate;
* Fake Progress normal após o gate;
* fullscreen normal após o gate;
* volume;
* playback rate;
* quota/access;
* tracking;
* Delivery/Edge;
* Tracker;
* banco de viewer;
* endpoints comerciais.

Evandro Delivery continua fora deste milestone. A própria KB mantém a prioridade na evolução do player antes dessa camada.

---

## Critérios de teste manual

### Cenário A — Primeiro acesso

Config:

```text
Persistent Resume ON
sem histórico
```

Esperado:

* sem Resume Overlay;
* startup atual funciona normalmente.

---

### Cenário B — Acesso anterior sem Play

1. abrir página;
2. não iniciar foreground playback;
3. sair;
4. voltar.

Esperado:

* sem Resume Overlay;
* nenhuma visita isolada cria histórico.

---

### Cenário C — Play + F5

1. dar Play;
2. assistir até aproximadamente `00:30`;
3. F5.

Esperado:

* thumbnail não aparece;
* preview não aparece;
* autoplay não acontece;
* vídeo prepara perto de `00:30`;
* frame restaurado fica pausado;
* Resume Overlay aparece;
* overlay aparece apenas uma vez nessa instância.

---

### Cenário D — Background Autoplay configurado + histórico

Config:

```text
Background Autoplay ON
Persistent Resume ON
histórico existente
```

Esperado:

* Background Preview não aparece;
* vídeo não roda muted em loop;
* Resume ganha prioridade;
* mídia é preparada no ponto salvo e pausada.

---

### Cenário E — Custom Startup Thumbnail + histórico

Esperado:

* custom startup thumbnail não aparece nem por um frame;
* Resume assume diretamente.

---

### Cenário F — Automatic Thumbnail + histórico

Esperado:

* provider thumbnail não aparece nem por um frame;
* Resume assume diretamente.

---

### Cenário G — Custom Pause Thumbnail + histórico

No startup:

* Pause Thumbnail não aparece.

Após clicar Continue e depois pausar:

* Custom Pause Thumbnail funciona normalmente.

---

### Cenário H — Continue

Com Resume pronto em aproximadamente `00:30`:

clicar:

**Continuar assistindo**

Esperado:

* nenhum novo seek;
* nenhum reload;
* nenhum reset para zero;
* vídeo apenas continua;
* início percebido próximo do ponto restaurado;
* overlay desaparece;
* não volta durante aquela instância.

---

### Cenário I — Restart

Com Resume pronto em aproximadamente `00:30`:

clicar:

**Assistir do início**

Esperado:

* progresso antigo é removido;
* playback vai para `00:00`;
* reprodução começa;
* nenhuma thumbnail aparece;
* nenhum Background Preview aparece;
* nenhum Background Autoplay acontece;
* Resume Overlay não reaparece.

---

### Cenário J — Pause depois de Continue

Esperado:

* Resume não reaparece;
* Pause UI normal aparece.

---

### Cenário K — Pause depois de Restart

Esperado:

* Resume não reaparece;
* Pause UI normal aparece.

---

### Cenário L — Fecha sem escolher

1. Resume aparece;
2. não clicar em nada;
3. fechar;
4. voltar.

Esperado:

* Resume aparece novamente.

---

### Cenário M — Background Autoplay sozinho

1. limpar histórico;
2. deixar Background Autoplay rodar;
3. nunca entrar em foreground;
4. fechar;
5. voltar.

Esperado:

* não existe Resume;
* Background Autoplay nunca cria histórico.

---

### Cenário N — Persistent Resume OFF

Mesmo com histórico local prévio:

Esperado:

* Resume não aparece;
* startup normal;
* nenhum progresso novo é persistido pela feature.

---

### Cenário O — Storage indisponível

Simular `localStorage` lançando exceção.

Esperado:

* nenhum crash;
* player segue comportamento normal;
* playback permanece funcional.

---

### Cenário P — Vídeo encerrado

1. assistir até `ended`;
2. recarregar.

Esperado:

* histórico anterior limpo;
* startup normal;
* sem Resume de 100%.

---

### Cenário Q — Posição aproximada

Salvar próximo de:

```text
01:15
```

No reacesso:

Esperado:

```text
~01:15
```

Se o seek exato não for possível:

```text
ligeiramente antes
```

e nunca deliberadamente depois.

---

### Cenário R — Overlay pronta sem flashes

Em cold reload com histórico:

Esperado visual:

```text
preto durante preparação, se necessário
→ frame restaurado + Resume Overlay
```

Nunca:

```text
thumbnail
→ preto
→ preview
→ frame sem overlay
→ Resume
```

---

## Falhou se

A Spec 052 deve ser considerada reprovada se ocorrer qualquer um destes:

* visita sem Play cria Resume;
* Background Autoplay cria Resume;
* Resume aparece no primeiro acesso;
* Resume aparece depois de já ter sido resolvido na mesma instância;
* Background Autoplay roda antes/por baixo do Resume;
* Startup Thumbnail pisca antes do Resume;
* Pause Thumbnail pisca antes do Resume;
* Continue retorna para `0`;
* Continue executa reload da source;
* Restart mostra thumbnail;
* Restart mostra preview;
* Restart volta para Background Autoplay;
* frame de `0` aparece antes do seek restaurado;
* overlay aparece sobre posição errada e depois salta;
* HLS é duplicado;
* `<video>` é duplicado;
* React passa a possuir playback paralelo;
* editor cria histórico de viewer;
* `localStorage` quebrado impede playback;
* `ended` mantém Resume inútil no final;
* Tiny Loader ultrapassa seu budget arquitetural.

---

## Resultado esperado final

A experiência deve parecer:

```text
PRIMEIRO ACESSO

startup atual
→ Play
→ playback normal
```

e:

```text
RETORNO COM HISTÓRICO

player abre
→ mídia vai silenciosamente para onde o espectador parou
→ frame correto aparece pausado
→ "Continuar assistindo?" / "Assistir do início"
```

Continue:

```text
play()
→ segue de onde estava
```

Restart:

```text
seek(0)
→ play()
```

Sem reconstruir o startup.

---

## Checks técnicos obrigatórios

Executar:

```text
pnpm typecheck
pnpm lint
pnpm build:embed
pnpm build
```

Se houver alteração estrutural de banco inesperada:

```text
pnpm db:generate
pnpm db:migrate
```

Mas a solução pretendida para esta spec **não exige nova tabela**.

Confirmar também:

* Tiny Loader dentro do budget atual;
* apenas um `<video>`;
* apenas um HLS ownership;
* sem regressão visual nos cenários sem Resume.

---

## Critério de conclusão

A spec só pode ser considerada concluída depois de:

1. implementação em `development`;
2. checks técnicos verdes;
3. testes manuais dos cenários principais;
4. validação explícita do comportamento pelo usuário.

Compilar não significa aceitar milestone.
