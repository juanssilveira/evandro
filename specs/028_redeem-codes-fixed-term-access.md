# 028 — Redeem Codes and Fixed-Term Access

## Objetivo

Adicionar um sistema interno de códigos de resgate de uso único que concedem acesso temporário ao plano Pro.

Os códigos serão gerados somente pelo terminal e cada código terá uma duração definida no momento da criação.

Também ajustar a página `/no-plan` para permitir o resgate desses códigos.

---

## 1. Página sem plano

Na página exibida para usuários autenticados sem plano ativo:

- manter a mensagem principal informando que o usuário não possui plano;
- substituir a área atual de informações da conta por uma exibição compacta contendo apenas o email do usuário.

### Email

Exibir o email em formato semelhante a badge/chip.

Permitir copiar o email através de um botão/ícone de copiar.

Após copiar, mostrar feedback visual curto.

Não exibir o nome do usuário nessa área.

---

## 2. Área de resgate

Logo abaixo do email adicionar:

- input para código;
- botão `Resgatar código`.

Exemplo:

```text
[ EVN-XXXX-XXXX-XXXX ] [ Resgatar código ]
```

Ao enviar:

1. validar o código no servidor;
2. verificar se ainda não foi utilizado;
3. verificar sua configuração;
4. criar o acesso temporário ao plano;
5. marcar o código como utilizado;
6. redirecionar para `/videos`.

Erros devem ser simples.

Exemplo:

```text
Código inválido ou já utilizado.
```

Não revelar informações internas sobre o motivo da invalidação.

---

## 3. Redeem Codes

Criar uma tabela própria para armazenar códigos de resgate.

Cada código deve possuir:

```text
id
codeHash
planCode
durationDays
usedAt
usedByUserId
createdAt
```

Opcionalmente pode existir `expiresAt` no próprio código caso seja útil internamente, mas a duração deve continuar sendo a informação principal usada para criar o acesso.

---

## 4. Segurança do código

O código deve:

- ser aleatório;
- possuir entropia suficiente;
- ser único;
- funcionar apenas uma vez.

Não armazenar o código original em texto puro.

Persistir apenas seu hash.

O código original deve ser mostrado somente no momento de sua geração pelo terminal.

---

## 5. Geração pelo terminal

Criar um script interno semelhante aos comandos atuais de plano.

Exemplo:

```bash
pnpm redeem:generate --days 30
```

Como atualmente existe apenas o plano Pro, não é necessário exigir o plano como argumento.

Opcionalmente aceitar:

```bash
pnpm redeem:generate --plan pro --days 30
```

Saída esperada:

```text
Redeem code created

Code: EVN-ABCD-EFGH-IJKL
Plan: Pro
Duration: 30 days
```

A duração deve ser obrigatória e validada.

Não criar painel administrativo nesta etapa.

---

## 6. Acesso por tempo fixo

Adicionar suporte a expiração real nas subscriptions.

Adicionar:

```text
expiresAt
```

Uma assinatura temporária criada por redeem deve possuir:

```text
planCode = pro
status = active
startedAt = agora
expiresAt = agora + durationDays
```

Assinaturas sem tempo fixo continuam podendo possuir:

```text
expiresAt = null
```

Nesse caso o acesso permanece ativo enquanto o status for `active`.

---

## 7. Validação central de plano

Atualizar a lógica central de autorização.

Uma assinatura só deve ser considerada ativa quando:

```text
status = active
AND
(
  expiresAt IS NULL
  OR
  expiresAt > agora
)
```

Essa regra deve ser utilizada pela fonte central de acesso ao plano.

Não implementar apenas na interface.

A expiração deve bloquear automaticamente:

- Biblioteca;
- Configurações protegidas;
- upload;
- APIs protegidas;
- criação de vídeos;
- playback protegido por plano;
- qualquer fluxo que dependa de `requireActivePlan`.

Não é necessário cron para alterar o status da assinatura.

A própria verificação de acesso deve considerar `expiresAt`.

---

## 8. Resgate atômico

O resgate do código deve acontecer de forma transacional.

Dentro da mesma operação:

1. localizar e validar o código;
2. garantir que ainda não foi utilizado;
3. garantir que o usuário não possui plano ativo;
4. criar a assinatura temporária;
5. marcar o código como utilizado;
6. registrar `usedByUserId`;
7. registrar `usedAt`.

Se qualquer etapa falhar, nenhuma alteração parcial deve permanecer.

Dois usuários tentando resgatar o mesmo código simultaneamente não podem conseguir ativá-lo duas vezes.

---

## 9. Usuário que já possui plano

Nesta primeira versão:

```text
usuário com plano ativo
→ não pode resgatar outro código
```

Não permitir acumular tempo.

Não permitir extensão automática.

Não implementar stacking de códigos nesta spec.

---

## 10. Configurações

Quando o plano possuir expiração, a página de Configurações deve mostrar de forma informativa:

```text
Válido até
17/10/2026
```

Quando:

```text
expiresAt = null
```

não é necessário exibir data de validade.

---

## 11. Expiração

Quando a data chegar:

```text
expiresAt <= agora
```

o usuário passa automaticamente a ser considerado sem plano.

Ao tentar acessar áreas protegidas deve retornar para:

```text
/no-plan
```

O código utilizado continua marcado como usado e nunca volta a ficar disponível.

---

## Critérios de aceite

- `/no-plan` mostra apenas o email do usuário.
- Email possui ação de copiar.
- Existe campo para resgatar código.
- Códigos são gerados somente pelo terminal.
- É possível escolher a duração do código.
- Código só funciona uma vez.
- Código original não fica armazenado em texto puro.
- Resgate cria uma assinatura Pro temporária.
- Subscription possui `expiresAt`.
- Acesso expira automaticamente pela validação central.
- Usuário expirado volta a ser tratado como usuário sem plano.
- Usuário com plano ativo não consegue resgatar outro código.
- Resgate é protegido contra concorrência e uso duplicado.
- Configurações mostra a validade quando existir.
- Nenhum painel administrativo ou billing é criado nesta etapa.