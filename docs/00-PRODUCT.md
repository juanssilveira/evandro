# WatchMap — Product

## O que é o WatchMap

WatchMap é uma plataforma de hospedagem, reprodução e análise comportamental de vídeos de vendas.

A plataforma é responsável por:

* gerenciamento dos vídeos;
* reprodução através do WatchMap Player;
* coleta de dados de reprodução;
* tracking comportamental através do motor Evandro;
* processamento dos dados;
* visualização de analytics.

## Diferencial central

O principal diferencial do WatchMap é entender com profundidade como cada espectador se comporta durante um vídeo.

O produto combina duas tecnologias próprias:

### WatchMap Player

Responsável pela reprodução do vídeo e por fornecer controle direto sobre o ciclo de playback.

### Evandro

Responsável por observar, registrar e interpretar o comportamento do espectador durante a reprodução.

Player e Evandro trabalham de forma integrada, mas permanecem componentes independentes.

## Arquitetura conceitual

```text
WATCHMAP
│
├── Plataforma
│   ├── autenticação
│   ├── contas
│   ├── vídeos
│   └── configurações
│
├── WatchMap Player
│   └── reprodução
│
├── Evandro
│   └── tracking comportamental
│
├── Backend
│   └── persistência e processamento
│
└── Analytics
    └── interpretação e visualização
```

## Modelo de propriedade

Os dados pertencem a uma conta, não diretamente a um usuário.

```text
USER
  ↓
ACCOUNT
  ↓
VIDEO
```

Usuários acessam os dados através de sua associação com uma conta.

A arquitetura deve permitir múltiplos usuários por conta sem alterar o modelo fundamental dos dados.

## Princípios do produto

### Simplicidade

Construir apenas o necessário para resolver necessidades reais do produto.

Evitar complexidade e abstrações prematuras.

### Controle do player

O WatchMap utiliza seu próprio player como base para reprodução e coleta de dados.

O controle direto do player é parte fundamental da qualidade e profundidade do tracking.

### Separação de responsabilidades

O WatchMap Player é responsável por reprodução.

O Evandro é responsável por tracking e comportamento.

A plataforma é responsável por gestão, configuração e visualização.

Cada componente deve possuir responsabilidades claras.

### Dados antes de interpretação

A prioridade é coletar dados confiáveis e reconstruir corretamente o comportamento de uma sessão antes de criar análises mais sofisticadas.

### Produção real

Player e tracking devem ser projetados para funcionar em condições reais de produção desde o início.

### Evolução incremental

O produto deve evoluir através de funcionalidades pequenas, especificadas e testáveis.

Cada nova camada deve aproveitar a fundação existente sem exigir reconstruções desnecessárias.
