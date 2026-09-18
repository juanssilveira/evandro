# Evandro Watch — Product

## O que é o Evandro Watch

Evandro Watch é uma plataforma de hospedagem, reprodução e análise comportamental de vídeos de alta conversão.

A plataforma é responsável por:

* gerenciamento dos vídeos;
* reprodução através do Evandro Player;
* coleta de dados de reprodução e telemetria operacional;
* tracking comportamental e análise futura (Evandro Tracker e Evandro Intelligence);
* processamento e persistência dos dados;
* visualização de analytics.

## Família de Produtos e Conceitos

O ecossistema Evandro é composto por quatro frentes conceituais:

### 1. Evandro Watch (Aplicação / Plataforma)

A plataforma principal onde usuários gerenciam contas, membros, vídeos, pastas, configurações de embed e visualizam dados.
Assinatura visual oficial: **Evandro Watch by Evandro Intelligence**.

### 2. Evandro Player (Smart Player de Vídeo)

O componente cliente de reprodução ultrarrápida, embed e controle de playback (`<evandro-player>`, `evandro-player.js`). Responsável pelo ciclo de vida do vídeo, ABR de inicialização, autoplay em background e medição precisa de performance.

### 3. Evandro Tracker (Tracking Comportamental Avançado - Futuro)

Camada projetada para observação, registro e reconstrução detalhada do comportamento do espectador durante a sessão. Atualmente o player opera com telemetria operacional; o Evandro Tracker completo representa a evolução futura desse motor.

### 4. Evandro Intelligence (Analytics e Inteligência - Futuro)

Camada de interpretação avançada, inteligência de conversão e insights de audiência.

## Arquitetura conceitual

```text
EVANDRO WATCH
│
├── Plataforma (Evandro Watch)
│   ├── autenticação
│   ├── contas
│   ├── vídeos e pastas
│   └── configurações
│
├── Evandro Player
│   └── reprodução e performance de playback
│
├── Evandro Tracker (Tracking avançado futuro)
│   └── observação comportamental profunda
│
├── Backend
│   └── persistência e processamento
│
└── Evandro Intelligence (Analytics & inteligência futura)
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

A arquitetura permite múltiplos usuários por conta sem alterar o modelo fundamental dos dados.

## Princípios do produto

### Simplicidade

Construir apenas o necessário para resolver necessidades reais do produto.

Evitar complexidade e abstrações prematuras.

### Controle do player

O Evandro Watch utiliza seu próprio player (Evandro Player) como base para reprodução e coleta de dados.

O controle direto do player é parte fundamental da qualidade e profundidade do tracking.

### Separação de responsabilidades

O Evandro Player é responsável por reprodução e performance.

O tracking comportamental evolui na camada Evandro Tracker.

A plataforma Evandro Watch é responsável por gestão, configuração e visualização.

Cada componente possui responsabilidades claras e delimitadas.

### Dados antes de interpretação

A prioridade é coletar dados confiáveis e reconstruir corretamente o comportamento de uma sessão antes de criar análises mais sofisticadas.

### Produção real

Player e telemetria são projetados para funcionar em condições reais de produção com alta performance e baixo overhead.

### Evolução incremental

O produto evolui através de funcionalidades pequenas, especificadas e testáveis.

Cada nova camada aproveita a fundação existente sem exigir reconstruções desnecessárias.
