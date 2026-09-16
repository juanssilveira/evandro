# Spec 018 — Player Controls Settings

## Objetivo

Adicionar à tela de configurações do vídeo os controles de:

```text
Controles do player
→ esconder/exibir controles

Fullscreen
→ ativar/desativar fullscreen
→ exibir botão de fullscreen
→ permitir duplo clique
→ permitir tecla F
```

Utilizar a estrutura já existente em `PlayerConfig`.

Não criar um novo modelo de configuração.

---

## Configuração existente

A spec deve utilizar:

```ts
controls: {
  hidden: boolean,
  fullscreen: {
    enabled: boolean,
    button: boolean,
    doubleClick: boolean,
    keyboardF: boolean
  }
}
```

Valores default permanecem:

```ts
controls: {
  hidden: false,
  fullscreen: {
    enabled: true,
    button: true,
    doubleClick: true,
    keyboardF: true
  }
}
```

Não alterar o formato do `PlayerConfig`.

---

## Interface

Adicionar uma nova seção nas configurações do player:

```text
Controles
```

Ela deve seguir o mesmo padrão visual das configurações existentes.

A seção deve conter dois blocos:

```text
Controles do player
Fullscreen
```

As mudanças devem refletir imediatamente no preview do player e persistir através do fluxo de configuração já existente.

---

## Esconder controles

Adicionar a opção:

```text
Esconder controles do player
```

Descrição sugerida:

```text
Remove a barra de controles durante a reprodução.
```

Mapeamento:

```text
controls.hidden
```

Quando:

```text
controls.hidden = true
```

não renderizar a barra inferior do player, incluindo:

```text
timeline
play/pause
volume
tempo
velocidade
fullscreen
```

Essa configuração não deve impedir automaticamente outras interações existentes no player.

Em especial:

```text
fullscreen por duplo clique
fullscreen pela tecla F
```

continuam seguindo suas próprias configurações.

Não interpretar `hidden` como bloqueio completo de interação.

---

## Fullscreen

Adicionar um controle principal:

```text
Permitir fullscreen
```

Mapeamento:

```text
controls.fullscreen.enabled
```

Quando:

```text
enabled = false
```

nenhuma forma de entrada em fullscreen deve funcionar.

Isso inclui:

```text
botão
duplo clique
tecla F
```

As opções individuais permanecem persistidas, mas ficam inativas enquanto o fullscreen global estiver desativado.

Ao reativar `enabled`, restaurar o comportamento conforme os valores individuais previamente salvos.

---

## Botão de fullscreen

Adicionar opção:

```text
Exibir botão de fullscreen
```

Mapeamento:

```text
controls.fullscreen.button
```

Quando `false`:

```text
o botão de fullscreen não deve ser renderizado nos controles
```

Isso não desativa:

```text
doubleClick
keyboardF
```

desde que:

```text
controls.fullscreen.enabled = true
```

Se:

```text
controls.hidden = true
```

o botão naturalmente não aparece porque a barra inteira está oculta.

Não modificar automaticamente `controls.fullscreen.button` nesse caso.

---

## Duplo clique

Adicionar opção:

```text
Fullscreen com duplo clique
```

Mapeamento:

```text
controls.fullscreen.doubleClick
```

Quando habilitado:

```text
duplo clique em uma área válida do player
→ alterna fullscreen
```

Preservar as exclusões atuais para elementos interativos como:

```text
buttons
sliders
controles
```

Quando desabilitado, duplo clique não deve alterar fullscreen.

---

## Tecla F

Adicionar opção:

```text
Fullscreen com tecla F
```

Mapeamento:

```text
controls.fullscreen.keyboardF
```

Quando habilitado:

```text
F
→ alterna fullscreen
```

Somente quando:

```text
controls.fullscreen.enabled = true
```

Preservar a proteção existente para inputs e textareas.

---

## Dependências visuais

Quando:

```text
controls.fullscreen.enabled = false
```

as opções:

```text
Exibir botão de fullscreen
Fullscreen com duplo clique
Fullscreen com tecla F
```

devem permanecer visíveis, porém visualmente desabilitadas na interface.

Não apagar seus valores.

Não forçar todos para `false`.

Isso permite:

```text
desativar fullscreen
→ reativar posteriormente
→ recuperar as preferências anteriores
```

---

## Preview

Toda alteração deve atualizar imediatamente o preview local do player.

Fluxo:

```text
usuário altera configuração
↓
preview reage imediatamente
↓
configuração é persistida
```

Em caso de erro ao persistir:

```text
reverter preview para configuração anterior
mostrar erro existente
```

Reutilizar o mecanismo atual de atualização otimista.

---

## Player

A implementação do player deve continuar utilizando exclusivamente:

```text
config.controls.hidden
config.controls.fullscreen
```

Não duplicar estado de configuração em novas props.

O estado React local necessário para fullscreen real do browser pode continuar existindo normalmente.

---

## Runtime

Não alterar o Player Runtime nesta spec.

Eventos de fullscreen existentes, caso já sejam observados pelo Runtime, devem continuar funcionando sem mudança de contrato.

A configuração controla apenas quais interações podem iniciar fullscreen.

---

## Compatibilidade

Validar:

```text
16:9
9:16
embed
preview interno
fullscreen
controles ocultos
```

Especialmente:

```text
hidden=true + doubleClick=true
→ barra oculta, duplo clique ainda funciona

hidden=true + keyboardF=true
→ barra oculta, tecla F ainda funciona

enabled=false
→ nenhuma forma de fullscreen funciona

enabled=true + button=false
→ botão oculto, outras formas continuam funcionando
```

---

## Critérios de aceite

- configuração `controls.hidden` pode ser alterada pela interface;
- barra completa de controles desaparece quando `hidden=true`;
- fullscreen global pode ser ativado/desativado;
- botão de fullscreen pode ser configurado separadamente;
- duplo clique pode ser configurado separadamente;
- tecla F pode ser configurada separadamente;
- `fullscreen.enabled=false` bloqueia todas as formas de fullscreen;
- opções individuais não são apagadas ao desativar fullscreen global;
- opções dependentes ficam visualmente desabilitadas na UI;
- controles ocultos não desabilitam automaticamente duplo clique ou tecla F;
- preview atualiza imediatamente;
- persistência utiliza o fluxo existente de `PlayerConfig`;
- erro de persistência reverte a alteração otimista;
- comportamento funciona no embed;
- Player Runtime não tem seu contrato alterado;
- `pnpm typecheck` passa;
- `pnpm lint` passa;
- `pnpm build` passa.

Não implemente funcionalidades além das especificadas.