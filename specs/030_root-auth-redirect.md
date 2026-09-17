# 030 — Root Auth Redirect

## Objetivo

Remover completamente a landing page atual de `app.evandro.watch`.

A rota raiz `/` não deve mais renderizar nenhuma interface.

Ela passa a funcionar apenas como uma rota de decisão:

- usuário autenticado → aplicação;
- usuário não autenticado → login.

---

## 1. Rota raiz

Alterar:

```text
/
```

para executar a verificação de sessão no servidor.

Fluxo:

```text
/
↓
verificar sessão
↓
autenticado → /videos
não autenticado → /login
```

Não renderizar loading, landing page, mensagem ou qualquer outro conteúdo.

O redirecionamento deve acontecer server-side para evitar flash de conteúdo.

---

## 2. Usuário autenticado

Se existir uma sessão válida:

```text
redirect("/videos")
```

Não duplicar na rota raiz as regras de autorização de plano.

O fluxo existente da aplicação continua responsável por decidir se o usuário possui plano ativo.

Portanto:

```text
/
→ /videos
→ AppLayout
→ plano ativo → Biblioteca
→ sem plano → /no-plan
```

A rota raiz deve cuidar apenas de autenticação.

---

## 3. Usuário não autenticado

Se não existir sessão válida:

```text
redirect("/login")
```

Não exibir a antiga página "Estamos preparando tudo!".

---

## 4. Remoção da landing page

Remover o uso de:

```text
ComingSoon
```

da rota raiz.

Se o componente `ComingSoon` não possuir nenhum outro uso no projeto, ele pode ser removido.

Não deixar código morto relacionado à landing page antiga.

---

## 5. Comportamento esperado

### Visitante

```text
https://app.evandro.watch
→ /login
```

### Usuário autenticado com plano

```text
https://app.evandro.watch
→ /videos
```

### Usuário autenticado sem plano

```text
https://app.evandro.watch
→ /videos
→ proteção existente
→ /no-plan
```

---

## Critérios de aceite

- `/` não possui mais interface própria.
- Landing page antiga não aparece mais.
- Usuário sem sessão é enviado para `/login`.
- Usuário com sessão é enviado para `/videos`.
- Usuário autenticado sem plano continua chegando em `/no-plan` através da proteção existente.
- Redirecionamento acontece no servidor.
- Não existe flash da landing page antiga.
- Nenhuma regra de plano é duplicada na rota raiz.
- `ComingSoon` é removido caso tenha ficado sem uso.