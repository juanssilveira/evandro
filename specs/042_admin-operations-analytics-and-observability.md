# 042 — Admin Operations, Analytics and Observability

## Objetivo

Transformar o painel administrativo interno do WatchMap em um painel operacional completo para:

- acompanhar crescimento e consumo da plataforma;
- visualizar saúde da operação;
- investigar usuários individualmente;
- administrar contas e usuários;
- administrar redeem codes;
- acompanhar Mux e Bunny separadamente;
- executar ações administrativas com segurança.

Esta spec continua utilizando o painel interno existente.

Não redesenhar a identidade visual geral do `/dev`.

Melhorar estrutura, informação, hierarquia e capacidade operacional.

---

# 1. Segurança atual

Preservar integralmente:

```text
assertLocalDevPanelAccess()
```

e as regras atuais do painel:

- development only;
- localhost;
- não disponível em Vercel;
- não disponível em produção.

Todas as Server Actions administrativas também devem executar o guard independentemente da UI.

Não confiar apenas na proteção da página.

---

# 2. Navegação

Estrutura:

```text
Overview
Usuários
Redeem Codes
Infra de Vídeo
```

Preservar a arquitetura criada pela spec 041.

---

# 3. Overview — remover tabela por usuário

Remover da home:

```text
Uso por Conta
```

A análise individual pertence à área de Usuários.

O Overview deve se tornar um dashboard operacional.

---

# 4. Range global do dashboard

Adicionar seletor:

```text
7 dias
30 dias
90 dias
```

Default:

```text
30 dias
```

Pode utilizar:

```text
/dev?tab=overview&range=30d
```

Toda métrica temporal e gráfico deve respeitar esse período quando fizer sentido.

---

# 5. KPIs do Overview

Mostrar cards compactos para:

```text
Usuários totais
Novos usuários no período
Usuários com plano ativo
Vídeos ativos
Uploads no período
Plays no período
Plays hoje
Mídia atual armazenada
```

Não exagerar em cards.

Hierarquia:

```text
crescimento
consumo
operação
```

---

# 6. Deltas

Quando possível mostrar comparação contra período anterior.

Exemplo:

```text
1.240 Plays
+18,2% vs período anterior
```

Calcular comparando:

```text
range atual
vs
range imediatamente anterior de mesma duração
```

Não inventar percentuais quando não houver dados anteriores suficientes.

---

# 7. Gráfico principal — Plays

Criar gráfico:

```text
Plays por dia
```

Fonte:

```text
play_sessions.created_at
```

Não utilizar `monthly_usage` para série diária.

`monthly_usage` continua sendo fonte do limite mensal.

Mostrar:

```text
data
plays
```

para cada dia.

---

# 8. Gráfico de crescimento

Criar gráfico compacto combinando:

```text
Novos usuários
Uploads de vídeos
```

por dia.

Fontes:

```text
user.created_at
videos.created_at
```

Permitir visualização clara sem excesso de elementos.

---

# 9. Consumo de vídeo

Criar seção:

```text
Consumo da Operação
```

Mostrar:

```text
Total de vídeos
Ready
Processando
Errored
Tamanho original total
Duração hospedada
Plays no mês atual
```

Adicionar divisão por provider:

```text
Mux
Bunny
```

com:

```text
quantidade de vídeos
bytes originais cadastrados
duração total
plays dos vídeos daquele provider
```

Esses dados vêm inicialmente do banco WatchMap.

---

# 10. Gráficos

Adicionar uma biblioteca de gráficos leve e madura.

Preferência:

```text
recharts
```

Não criar engine de gráficos própria.

Usar componentes reutilizáveis para:

```text
line chart
bar chart
area chart quando fizer sentido
```

Manter o design visual do WatchMap:

- neutro;
- compacto;
- poucas cores;
- grid discreto;
- tooltips limpos;
- sem gráficos excessivamente decorativos.

---

# 11. Usuários — tabela

Preservar a tabela atual, mas tornar cada linha clicável.

Clique:

```text
/dev/users/[userId]
```

Manter botão/ação existente de plano disponível.

A tabela continua mostrando rapidamente:

```text
nome
email
conta
status
plano
vídeos
plays
criado em
```

Adicionar badges quando aplicável:

```text
Conta desativada
Banido
```

---

# 12. Página completa do usuário

Criar:

```text
/dev/users/[userId]
```

Essa página deve ser o centro de diagnóstico daquela conta.

Header:

```text
Nome
Email
User ID
Account ID
Conta
Criado em
Email verificado
Status da conta
Status do usuário
Plano atual
```

Adicionar botão:

```text
← Voltar para usuários
```

---

# 13. Resumo da conta

Mostrar cards:

```text
Vídeos
Plays no mês
Storage original
Duração total
Sessões ativas
```

Mostrar limites quando houver plano ativo:

```text
Vídeos
7 / 10

Plays
2.450 / 5.000
```

Utilizar progress bars discretas.

---

# 14. Analytics do usuário

Criar gráfico:

```text
Plays — últimos 30 dias
```

Fonte:

```text
play_sessions
WHERE owner_user_id = userId
```

Criar também:

```text
Uploads de vídeos — últimos 30 dias
```

Fonte:

```text
videos.created_at
WHERE account_id = accountId
```

Não criar dados artificiais.

---

# 15. Consumo por provider do usuário

Mostrar:

```text
Mux
X vídeos
Y MB originais
Z duração
N plays

Bunny
X vídeos
Y MB originais
Z duração
N plays
```

Fonte principal:

```text
WatchMap DB
```

Não fazer uma chamada externa por vídeo apenas para montar essa seção.

---

# 16. Lista de vídeos do usuário

Mostrar tabela compacta com:

```text
Título
Provider
Status
Duração
Tamanho
Plays
Criado em
```

Clique pode abrir:

```text
/videos/[videoId]
```

quando fizer sentido no ambiente local.

---

# 17. Histórico de plano

Mostrar subscriptions do usuário em ordem cronológica:

```text
Plano
Status
Início
Expiração
Encerramento
```

Não mostrar apenas assinatura atual.

---

# 18. Redeem usado

Se o usuário utilizou redeem:

mostrar:

```text
plano
duração
data de resgate
```

Nunca mostrar novamente o código original, porque atualmente o banco armazena apenas hash.

---

# 19. Sessões

Mostrar sessões Better Auth:

```text
Criada em
Última atualização
Expira em
IP
User Agent
```

Permitir:

```text
Revogar todas as sessões
```

Essa é uma ação administrativa explícita.

---

# 20. Status de conta

Adicionar ao schema `accounts`:

```text
status
disabled_at
disabled_reason
```

Valores:

```text
active
disabled
```

Default:

```text
active
```

---

# 21. Desativar conta

Ação:

```text
Desativar conta
```

Deve solicitar:

```text
motivo opcional
```

Resultado:

```text
accounts.status = disabled
disabledAt = now
disabledReason = motivo
```

Preservar todos os dados.

Não excluir vídeos.

Não excluir usuário.

Não excluir assinatura.

---

# 22. Efeito da conta desativada

Conta desativada não pode:

- acessar funcionalidades da aplicação;
- criar uploads;
- editar vídeos;
- utilizar embeds.

O bootstrap público do player deve retornar indisponível para vídeos pertencentes a contas desativadas.

Adicionar essa verificação ao fluxo central de account access/entitlement.

Não espalhar checks manuais em dezenas de componentes.

Criar helper central.

---

# 23. Reativar conta

Quando:

```text
status = disabled
```

mostrar ação:

```text
Reativar conta
```

Resultado:

```text
status = active
disabledAt = null
disabledReason = null
```

Não modificar plano.

---

# 24. Usuário banido

Ban é diferente de conta desativada.

```text
Conta desativada
→ entidade WatchMap bloqueada

Usuário banido
→ identidade/authentication bloqueada
```

Implementar usando a estrutura oficial compatível do Better Auth instalado.

Adicionar o Admin Plugin do Better Auth se necessário.

Schema Better Auth deve suportar os campos oficiais equivalentes a:

```text
role
banned
banReason
banExpires
```

Confirmar nomes exatos na versão instalada antes da migration.

Não criar uma segunda implementação paralela de ban.

---

# 25. Banir usuário

Ação:

```text
Banir usuário
```

Dialog:

```text
Motivo
Duração:
- Permanente
- 1 dia
- 7 dias
- 30 dias
- personalizada
```

Ao banir:

```text
banned = true
ban reason
ban expiration
```

e revogar todas as sessões atuais.

Usuário não pode fazer novo login enquanto o ban estiver ativo.

---

# 26. Desbanir

Usuário banido deve mostrar:

```text
Remover banimento
```

Preservar conta, vídeos e plano.

---

# 27. Enviar redefinição de senha

Adicionar ação:

```text
Enviar redefinição de senha
```

Utilizar o fluxo oficial do Better Auth:

```text
requestPasswordReset
```

Não definir nova senha manualmente no admin.

---

# 28. Infra de e-mail

O projeto atualmente não possui `sendResetPassword`.

Configurar:

```ts
emailAndPassword: {
  enabled: true,
  sendResetPassword: ...
}
```

Se já existir serviço de email quando esta spec for implementada:

```text
reutilizar
```

Caso contrário criar:

```text
src/lib/email/
```

com adapter inicial usando Resend.

Variáveis:

```env
RESEND_API_KEY=""
EMAIL_FROM=""
APP_PUBLIC_URL=""
```

Nunca enviar secret ao client.

---

# 29. Reset password page

Criar uma página pública simples:

```text
/reset-password
```

Recebe:

```text
?token=
```

Permite:

```text
nova senha
confirmar senha
```

e chama o método oficial do Better Auth.

Depois:

```text
Senha alterada
→ direcionar para /login
```

Configurar preferencialmente:

```text
revokeSessionsOnPasswordReset = true
```

---

# 30. Email não configurado

Se a infraestrutura de email não estiver configurada:

o botão aparece desabilitado ou retorna mensagem clara:

```text
Serviço de email não configurado.
```

Não fingir sucesso.

---

# 31. Excluir conta

Adicionar ação destrutiva:

```text
Excluir conta
```

Exigir confirmação forte.

Exemplo:

```text
Digite o nome da conta para confirmar.
```

---

# 32. Exclusão da conta — ordem

Antes de remover dados do banco:

1. buscar todos os vídeos da conta;
2. para cada vídeo:
   - resolver `video.provider`;
   - chamar `provider.deleteVideo(video)`;
3. remover previews R2 associados;
4. somente depois remover dados persistidos.

Se exclusão em provider falhar:

```text
NÃO apagar silenciosamente os IDs do banco.
```

Abortar a operação e informar quais assets falharam.

Isso permite retry.

---

# 33. O que excluir

A ação `Excluir conta` remove:

```text
account
account_members
folders
videos
player settings relacionados
play sessions relacionados aos vídeos
assets externos
previews R2
```

utilizando cascades existentes quando apropriado.

Não remover automaticamente o registro Better Auth `user`.

É exclusão da conta WatchMap, não necessariamente da identidade.

Se o usuário ficar sem nenhuma outra conta:

- revogar suas sessões;
- inativar subscriptions ativas.

---

# 34. Audit log administrativo

Criar:

```text
admin_audit_log
```

Campos equivalentes:

```text
id
action
target_user_id
target_account_id
metadata_json
created_at
```

Registrar ações importantes:

```text
plan_changed
account_disabled
account_enabled
user_banned
user_unbanned
sessions_revoked
password_reset_requested
account_deleted
redeem_deleted
default_provider_changed
```

Não armazenar secrets.

---

# 35. Redeem Codes — delete

Adicionar ação:

```text
Excluir
```

em cada Redeem Code.

Solicitar confirmação.

---

# 36. Redeem não utilizado

Se:

```text
usedAt = null
```

deletar normalmente.

---

# 37. Redeem utilizado

Se o redeem já foi utilizado:

permitir exclusão do registro, porém exibir warning:

```text
Este código já foi utilizado.

Excluir este registro NÃO remove ou altera o plano concedido ao usuário.
```

Não modificar subscription existente.

Registrar no audit log.

---

# 38. Infra de Vídeo — redesign

Melhorar visualmente a página criada na spec 041.

Criar dois grandes provider cards:

```text
MUX
BUNNY STREAM
```

Utilizar logos oficiais.

Armazenar assets localmente, por exemplo:

```text
/public/brands/mux.svg
/public/brands/bunny.svg
```

Não hotlinkar logos externos.

Usar versões oficiais e discretas.

Não alterar cores do restante do dashboard para imitar as marcas.

---

# 39. Provider ativo

No topo:

```text
Provider para novos uploads

Mux / Bunny
```

Preservar seletor criado pela spec 041.

Mostrar claramente:

```text
ATIVO PARA NOVOS UPLOADS
```

no provider selecionado.

---

# 40. Métricas locais por provider

Cada card mostra dados WatchMap:

```text
Vídeos
Ready
Processando
Com erro
Tamanho original dos uploads
Duração total
Plays associados
```

Fonte:

```text
videos.provider
play_sessions
```

---

# 41. Mux — dados externos

Criar helper administrativo server-side para consultar Mux.

Usar APIs oficiais existentes.

Obter quando disponível:

```text
Assets atuais
Duração armazenada
Delivery no período
Delivery por resolução
```

Utilizar:

```text
Mux Assets API
Mux Delivery Usage API
```

Mux Delivery Usage é uma métrica de CDN/delivery e NÃO deve ser apresentada como Watch Time.

Nomear:

```text
Delivery Mux
```

ou:

```text
Minutos entregues pela CDN
```

Nunca:

```text
Tempo assistido
```

---

# 42. Limitações do Mux

Não inventar bytes de storage se a API utilizada não fornecer essa métrica.

Quando necessário mostrar:

```text
Minutos armazenados
```

agrupados por resolution tier.

Separar claramente:

```text
Dados WatchMap
Dados Mux
```

---

# 43. Bunny — dados externos

Se possível, consultar dados reais da Video Library Bunny.

Mostrar:

```text
VideoCount
TrafficUsage
StorageUsage
```

e outras métricas úteis disponíveis.

Para informações por vídeo, Bunny também disponibiliza:

```text
storageSize
views
averageWatchTime
totalWatchTime
```

Não chamar todos os vídeos individualmente toda vez que a página abrir se isso resultar em N requests desnecessárias.

---

# 44. Bunny Account API

Para consultar métricas da Video Library via API de conta, adicionar suporte opcional a:

```env
BUNNY_ACCOUNT_API_KEY=""
```

Essa chave é diferente da Stream API Key da library.

Não substituir:

```text
BUNNY_STREAM_API_KEY
```

Ela continua sendo usada pela integração de vídeo.

---

# 45. Bunny sem Account API Key

Se:

```text
BUNNY_ACCOUNT_API_KEY
```

não estiver configurada:

a página continua funcionando.

Mostrar:

```text
Dados da conta Bunny indisponíveis
```

e utilizar apenas métricas WatchMap/local.

Não quebrar upload/playback.

---

# 46. Estado e saúde da infra

Cada provider deve mostrar:

```text
Configurado
Não configurado
Erro de API
Operacional
```

Opcionalmente:

```text
Última consulta
```

Não chamar isso de uptime se não houver monitoramento real.

---

# 47. Refresh

Adicionar botão discreto:

```text
Atualizar dados
```

na página Infra de Vídeo.

Isso refaz apenas as consultas administrativas.

Não altera configuração do provider.

---

# 48. Cache de métricas externas

Não consultar Mux/Bunny repetidamente durante cada render trivial.

Adicionar cache curto:

```text
60–300 segundos
```

para métricas externas.

O botão `Atualizar dados` pode invalidar/refazer a consulta.

---

# 49. Provider logos

Os logos são apenas identificação visual.

Exemplo:

```text
[ Mux logo ]      Mux
[ Bunny logo ]    Bunny Stream
```

Não criar grandes banners publicitários.

Manter aparência de painel operacional.

---

# 50. Infra — comparação

Adicionar bloco compacto:

```text
Distribuição atual
```

Exemplo:

```text
Mux     72% dos vídeos
Bunny   28% dos vídeos
```

Opcionalmente:

```text
plays
duração
storage local
```

Não criar ranking ou recomendação de provider.

---

# 51. User actions UX

Ações normais:

```text
Alterar plano
Enviar redefinição de senha
Revogar sessões
```

Ações administrativas:

```text
Desativar conta
Banir usuário
```

Danger zone:

```text
Excluir conta
```

Visualmente separar essas categorias.

Não colocar todos os botões vermelhos juntos no header.

---

# 52. Confirmações

Exigir confirmação para:

```text
desativar conta
banir usuário
revogar todas sessões
excluir conta
excluir redeem
trocar provider default
```

Ações destrutivas não devem acontecer em um clique acidental.

---

# 53. Admin service structure

O `src/lib/dev/service.ts` atual já está ficando grande.

Refatorar em módulos, por exemplo:

```text
src/lib/dev/
├── analytics.ts
├── users.ts
├── accounts.ts
├── redeem.ts
├── video-infra.ts
├── audit.ts
├── guard.ts
└── service.ts
```

`service.ts` pode funcionar como facade/export.

Não criar um único arquivo gigante.

---

# 54. Actions

Separar server actions quando fizer sentido, mantendo sempre:

```text
assertLocalDevPanelAccess()
```

Ações esperadas:

```text
updateDevUserPlanAction
disableAccountAction
enableAccountAction
banUserAction
unbanUserAction
revokeUserSessionsAction
sendPasswordResetAction
deleteAccountAction
deleteRedeemCodeAction
refreshProviderStatsAction
```

Reutilizar actions da spec 041 para provider default.

---

# 55. Não guardar analytics duplicado

Nesta spec NÃO criar nova pipeline de eventos.

Utilizar os dados existentes:

```text
play_sessions
monthly_usage
videos
users
subscriptions
sessions
```

Analytics avançado do produto continua sendo outra etapa.

Este painel é analytics operacional.

---

# 56. Performance

Queries do dashboard devem agregar no banco.

Não:

```text
buscar todos play_sessions
→ contar no JavaScript
```

quando PostgreSQL puder fazer:

```text
COUNT
GROUP BY
DATE_TRUNC
SUM
```

Adicionar índices necessários para:

```text
play_sessions.created_at
videos.created_at
videos.provider
user.created_at
subscriptions.started_at
```

somente quando realmente necessários.

---

# 57. Empty/error states

Todo bloco externo deve possuir estado independente.

Exemplo:

Mux API falhou:

```text
Dados Mux indisponíveis
```

Mas:

- dashboard continua;
- Bunny continua;
- dados locais continuam;
- upload continua.

Não deixar uma API externa derrubar `/dev`.

---

# 58. Responsividade

Desktop é prioridade para `/dev`.

Mesmo assim:

- tabelas devem scrollar horizontalmente;
- cards reorganizam em grid;
- gráficos não devem overflow;
- user detail deve continuar utilizável em telas menores.

---

# 59. Não alterar produto desnecessariamente

Fora as verificações necessárias para:

```text
account.status = disabled
Better Auth ban
reset password
```

não alterar:

- player;
- upload;
- analytics do produto;
- provider selection;
- folders;
- player settings;
- checkout;
- planos.

---

# Critérios de aceite

- Overview não possui mais tabela de consumo por conta.
- Overview possui KPIs operacionais.
- Overview possui filtro 7/30/90 dias.
- Existe gráfico diário de Plays.
- Existe gráfico de usuários/uploads.
- Existe breakdown Mux/Bunny.
- Usuário possui página detalhada.
- Página mostra conta, plano, consumo, vídeos e sessões.
- Página possui gráficos de consumo.
- Plano continua editável.
- Conta pode ser desativada e reativada.
- Conta desativada não consegue utilizar produto nem embeds.
- Usuário pode ser banido e desbanido.
- Ban revoga sessões.
- Existe ação de revogar sessões.
- Existe envio real de reset de senha quando email estiver configurado.
- Existe `/reset-password`.
- Exclusão de conta limpa assets Mux/Bunny/R2 antes do banco.
- Falha de cleanup não perde IDs necessários para retry.
- Redeem pode ser excluído.
- Excluir redeem usado não altera subscription.
- Existe audit log administrativo.
- Infra de Vídeo possui logos Mux/Bunny.
- Infra mostra métricas locais por provider.
- Mux mostra métricas externas quando disponível.
- Bunny mostra métricas externas quando disponível.
- Ausência de Bunny Account API Key não quebra painel.
- Secrets nunca chegam ao client.
- APIs externas não conseguem derrubar o painel inteiro.
- Toda ação continua protegida pelo guard local.