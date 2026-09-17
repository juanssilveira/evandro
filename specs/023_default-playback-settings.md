# Spec 023 — Default Playback Settings

## Objetivo

Adicionar duas novas configurações dentro da categoria:

```text
Reprodução
```

Configurações:

```text
Velocidade padrão
Volume padrão
```

Esses valores definem como o vídeo real deve iniciar quando o playback principal for ativado.

Não alterar comportamento de:

- Background Preview;
- Fake Progress;
- Runtime;
- analytics;
- HLS;
- Mux;
- controles;
- autoplay além do necessário para aplicar os valores iniciais.

---

## 1. Configurações

Adicionar ao PlayerConfig, dentro da estrutura de reprodução já existente, valores equivalentes a:

```ts
playback: {
  defaultPlaybackRate: 1,
  defaultVolume: 1
}
```

Adapte os nomes à estrutura real existente.

Valores padrão:

```text
Velocidade:
1x

Volume:
100%
```

---

## 2. Velocidade padrão

Adicionar na categoria:

```text
Reprodução
```

campo:

```text
Velocidade padrão
```

Opções iniciais:

```text
0.5x
0.75x
1x
1.25x
1.5x
1.75x
2x
```

Default:

```text
1x
```

Persistir numericamente:

```text
0.5
0.75
1
1.25
1.5
1.75
2
```

---

## 3. Volume padrão

Adicionar na mesma categoria:

```text
Volume padrão
```

Utilizar slider de:

```text
0% → 100%
```

Default:

```text
100%
```

Persistir internamente como valor normalizado:

```text
0 → 1
```

Exemplos:

```text
0%   → 0
25%  → 0.25
50%  → 0.5
75%  → 0.75
100% → 1
```

A UI pode apresentar percentual.

---

## 4. Aplicação da velocidade

Quando o playback principal real for inicializado:

```text
video.playbackRate = defaultPlaybackRate
```

O valor deve estar aplicado antes/início da reprodução perceptível sempre que possível.

Deve funcionar igualmente em:

```text
preview Live/Testar reprodução
player público
embed
```

---

## 5. Aplicação do volume

Quando o playback principal real for iniciado em foreground:

```text
video.volume = defaultVolume
```

O volume configurado representa o volume desejado quando o usuário efetivamente começa a assistir ao vídeo principal.

---

## 6. Background Autoplay / Background Preview

A configuração de Volume padrão NÃO altera as regras de background autoplay.

Background autoplay/background preview permanece:

```text
muted
```

quando aplicável.

Não tentar iniciar mídia automática com áudio apenas porque:

```text
defaultVolume > 0
```

A política existente de autoplay deve ser preservada.

---

## 7. Ativação de foreground

No fluxo:

```text
Background Preview
↓
usuário clica "ativar som"
↓
HLS principal inicia
```

aplicar:

```text
playbackRate = defaultPlaybackRate
volume = defaultVolume
```

e respeitar a lógica existente de unmute/foreground.

Exemplo:

```text
defaultPlaybackRate = 1.25
defaultVolume = 0.7
```

Ao ativar foreground:

```text
vídeo começa em 1.25x
volume = 70%
```

---

## 8. Volume 0%

Se:

```text
defaultVolume = 0
```

o foreground deve começar efetivamente sem volume.

Não converter automaticamente:

```text
0
→ 1
```

Não assumir que foreground implica obrigatoriamente volume audível.

---

## 9. Interação do usuário

As configurações são valores INICIAIS.

Após o playback começar, o usuário pode alterar:

```text
velocidade
volume
```

pelos controles disponíveis.

Depois que o visitante alterar manualmente um desses valores:

não sobrescrever continuamente com o valor padrão.

Exemplo:

```text
defaultVolume = 70%

usuário altera para 30%
→ permanece 30%
```

Não reaplicar 70% a cada:

```text
pause
play
seek
buffer
waiting
```

---

## 10. Nova sessão

Em uma nova instância/sessão do player:

os valores padrão devem ser aplicados novamente.

Exemplo:

```text
defaultPlaybackRate = 1.5
defaultVolume = 0.8
```

Nova abertura do player:

```text
1.5x
80%
```

---

## 11. Restart

Se o próprio fluxo existente reiniciar o vídeo do começo durante a mesma sessão:

```text
currentTime = 0
```

não sobrescrever uma alteração manual de volume/velocidade feita pelo visitante, salvo se esse restart fizer parte da inicialização original do foreground.

Preservar o estado escolhido pelo usuário durante a sessão.

---

## 12. Player Runtime

Runtime continua observando o HTMLVideoElement real.

Eventos existentes como:

```text
ratechange
volumechange
```

devem continuar funcionando normalmente.

Não adicionar lógica específica dessas configurações ao Runtime além do comportamento natural do elemento.

---

## 13. Fake Progress

Fake Progress continua utilizando:

```text
currentTime
duration
```

reais.

Velocidade 2x naturalmente fará `currentTime` avançar mais rápido.

Não compensar matematicamente a Fake Progress pela playbackRate.

Não alterar o Fake Progress Engine nesta spec.

---

## 14. Background Preview Asset

O asset visual usado antes do playback real:

```text
animated WebP / asset derivado
```

não precisa respeitar:

```text
defaultPlaybackRate
defaultVolume
```

Ele é apenas uma representação visual do background.

As configurações passam a valer quando o vídeo principal real for carregado.

---

## 15. Editor

Dentro da categoria:

```text
Reprodução
```

organizar as novas configurações junto às demais opções de playback existentes.

Exemplo conceitual:

```text
REPRODUÇÃO

Velocidade padrão
[ 1x ▼ ]

Volume padrão
[────────────●] 100%
```

Manter o padrão visual atual do painel.

Não criar nova categoria.

---

## 16. Preview estático

Alterar:

```text
Velocidade padrão
Volume padrão
```

no editor não deve obrigatoriamente carregar HLS.

Esses valores podem ser configurados no estado visual normalmente.

Para observar comportamento real:

```text
Testar reprodução
```

---

## 17. Testar reprodução

Ao iniciar teste real no editor:

aplicar os valores configurados.

Exemplo:

```text
Velocidade padrão = 1.5x
Volume padrão = 40%
```

Teste inicia:

```text
video.playbackRate === 1.5
video.volume === 0.4
```

Preview interno continua sem contar View/analytics públicos conforme arquitetura existente.

---

## 18. Embed

As configurações precisam fazer parte do PlayerConfig entregue ao embed.

Não criar parâmetros separados no HTML como:

```text
volume="..."
speed="..."
```

O embed continua recebendo a configuração central do WatchMap.

---

## 19. Validação

Validar velocidade:

```text
0.5x
0.75x
1x
1.25x
1.5x
1.75x
2x
```

Validar volume:

```text
0%
25%
50%
75%
100%
```

---

## 20. Persistência

Alterar configuração:

```text
salvar
↓
recarregar página
↓
valor permanece
```

Validar tanto:

```text
defaultPlaybackRate
defaultVolume
```

---

## 21. Backward compatibility

Vídeos/configurações existentes que não possuem os novos campos devem assumir:

```text
defaultPlaybackRate = 1
defaultVolume = 1
```

Não quebrar PlayerConfig antigo.

Não exigir migration destrutiva.

---

## 22. Validação de foreground

Com Background Autoplay habilitado:

```text
background
→ muted

foreground ativado
→ aplica volume padrão
→ aplica velocidade padrão
```

Testar especialmente:

```text
default volume 50%
default speed 1.5x
```

Resultado esperado:

```text
foreground real:
volume = 0.5
playbackRate = 1.5
```

---

## 23. Validação de interação

Exemplo:

```text
default:
volume 80%
speed 1.25x

playback inicia
→ 80%
→ 1.25x

usuário:
volume → 20%
speed → 2x

pause
play
seek

resultado:
→ 20%
→ 2x
```

Os defaults não devem ser reaplicados durante a sessão.

---

## 24. Não implementar

Não implementar nesta spec:

- lembrar volume entre vídeos diferentes;
- lembrar velocidade global do visitante;
- cookies de preferência;
- configuração por dispositivo;
- velocidade adaptativa;
- volume automático;
- normalization;
- compressor;
- loudness analysis;
- novos analytics;
- novos controles de usuário.

Somente valores padrão por vídeo/configuração do player.

---

## Critérios de aceite

A implementação está concluída quando:

```text
1. Reprodução possui Velocidade padrão;
2. Reprodução possui Volume padrão;
3. speed default = 1x;
4. volume default = 100%;
5. valores persistem;
6. preview Live respeita os valores;
7. player público respeita os valores;
8. embed respeita os valores;
9. Background Preview permanece independente;
10. background autoplay continua sem áudio;
11. foreground aplica os defaults;
12. alteração manual do visitante não é sobrescrita;
13. Runtime continua funcionando;
14. Fake Progress permanece inalterada;
15. configs antigas continuam funcionando.
```

Não implemente funcionalidades além das especificadas.