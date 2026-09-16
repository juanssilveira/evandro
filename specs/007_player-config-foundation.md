# Spec 007 — Player Config Foundation

## Objetivo

Criar a infraestrutura central de configuração do WatchMap Player.

As futuras customizações do player devem utilizar essa camada em vez de criar configurações isoladas diretamente em `videos`.

## Persistência

Criar relação 1:1:

```text
videos
  ↓
video_player_settings
```

Campos:

- `video_id`
- `config` JSONB
- `created_at`
- `updated_at`

`video_id` deve ser FK para `videos.id` e garantir uma única configuração por vídeo.

## PlayerConfig

Criar configuração versionada e tipada:

```ts
type PlayerConfig = {
  version: 1

  playback: {
    autoplay: boolean
    backgroundAutoplay: boolean
  }

  controls: {
    hidden: boolean

    fullscreen: {
      enabled: boolean
      button: boolean
      doubleClick: boolean
      keyboardF: boolean
    }
  }

  progress: {
    fake: {
      enabled: boolean
      targetPercent: number
      targetSeconds: number
    }
  }

  development: {
    debug: boolean
  }
}
```

Defaults:

```ts
{
  version: 1,

  playback: {
    autoplay: false,
    backgroundAutoplay: false
  },

  controls: {
    hidden: false,

    fullscreen: {
      enabled: true,
      button: true,
      doubleClick: true,
      keyboardF: true
    }
  },

  progress: {
    fake: {
      enabled: false,
      targetPercent: 0.85,
      targetSeconds: 10
    }
  },

  development: {
    debug: false
  }
}
```

## Validação

Criar:

- schema Zod;
- defaults centralizados;
- tipo `PlayerConfig` derivado do schema sempre que possível.

Config carregada do banco deve ser validada antes de chegar ao player.

## API interna

Centralizar operações de configuração.

Exemplo conceitual:

```ts
getPlayerConfig(videoId)
updatePlayerConfig(videoId, patch)
```

Toda operação deve respeitar Account/autorização existente.

O frontend não pode atualizar configuração de vídeo pertencente a outra Account.

## Player

`WatchMapPlayer` deve receber uma configuração validada.

Exemplo:

```tsx
<WatchMapPlayer
  videoId={video.id}
  src={playbackUrl}
  config={playerConfig}
/>
```

Não espalhar consultas de configuração dentro dos componentes internos do player.

## Migração de configurações existentes

Mover o comportamento atual de debug para:

```text
config.development.debug
```

Se existir `videos.debug_enabled`, migrar seu valor e remover a dependência dessa coluna.

O comportamento atual do debug deve permanecer funcionando.

As configurações atuais de fullscreen devem ser representáveis pela nova estrutura sem quebrar o comportamento já implementado.

## Separação

Cada área deve consumir somente a parte necessária:

```text
playback     → playback logic
controls     → controls/fullscreen
progress     → progress rendering
development  → runtime debug
```

O Runtime não deve receber o `PlayerConfig` inteiro.

## Critérios de aceite

- `video_player_settings` existe;
- configuração utiliza JSONB;
- `PlayerConfig` possui `version`;
- Zod valida a configuração;
- defaults estão centralizados;
- configuração é carregada server-side;
- `WatchMapPlayer` recebe config validada;
- debug atual funciona através da nova config;
- comportamento atual do fullscreen permanece funcionando;
- configurações não autorizadas não podem ser alteradas;
- migration e documentação estão atualizadas;
- checks passam.

Não implemente comportamentos novos além da infraestrutura especificada.