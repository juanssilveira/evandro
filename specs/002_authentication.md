# Spec 002 — Authentication

## Objetivo

Implementar a autenticação básica do WatchMap utilizando Better Auth.

Ao final desta spec, o usuário deve conseguir:

* criar seu usuário;
* fazer login;
* manter uma sessão autenticada;
* acessar uma área protegida;
* fazer logout.

Esta spec trata somente de identidade e sessão.

Accounts do WatchMap serão implementadas no próximo milestone.

---

## Rotas

Implementar:

```text
/login
/signup
/videos
/api/auth/[...all]
```

`/videos` será temporariamente apenas a primeira rota protegida da aplicação.

A biblioteca real de vídeos ainda não deve ser implementada.

---

## Autenticação

Utilizar a configuração de Better Auth já criada na Spec 001.

Habilitar:

```text
email + password
```

Não criar sistema próprio de autenticação.

---

## Signup

Criar:

```text
/signup
```

Campos:

```text
name
email
password
confirmPassword
```

Regras:

* `name` obrigatório;
* `email` obrigatório e válido;
* `password` entre 8 e 128 caracteres;
* `confirmPassword` deve coincidir com `password`;
* `confirmPassword` não deve ser persistido.

Fluxo esperado:

```text
/signup
   ↓
validação
   ↓
criação do usuário
   ↓
sessão autenticada
   ↓
/videos
```

Erros esperados devem ser apresentados de forma clara sem expor detalhes internos.

---

## Login

Criar:

```text
/login
```

Campos:

```text
email
password
```

Fluxo esperado:

```text
/login
   ↓
autenticação
   ↓
/videos
```

Credenciais inválidas devem gerar feedback claro e genérico.

---

## Logout

Disponibilizar logout na área autenticada.

Fluxo:

```text
logout
   ↓
sessão invalidada
   ↓
/login
```

Após logout, tentar acessar `/videos` novamente deve redirecionar para `/login`.

---

## Sessão

A sessão deve ser validada server-side.

Estado React ou estado visual do frontend nunca deve ser a fonte de verdade da autenticação.

---

## Área protegida

Criar:

```text
src/app/(app)/
```

com:

```text
src/app/(app)/layout.tsx
```

O layout deve validar a sessão no servidor.

Sem sessão válida:

```text
redirect → /login
```

As futuras rotas privadas devem herdar essa proteção através do layout.

---

## Página temporária de vídeos

Criar:

```text
src/app/(app)/videos/page.tsx
```

Conteúdo mínimo:

```text
Vídeos

Você está autenticado no WatchMap.
```

Também deve existir uma forma funcional de logout.

Não implementar listagem de vídeos nesta spec.

---

## Área de autenticação

Criar:

```text
src/app/(auth)/
├── login/
└── signup/
```

As telas devem seguir `docs/DESIGN.md`.

Utilizar o roxo oficial do WatchMap através dos tokens do design system.

Não aplicar cores hardcoded diretamente nos componentes quando existir token correspondente.

---

## Usuário autenticado

Se um usuário com sessão válida acessar:

```text
/login
/signup
```

redirecionar para:

```text
/videos
```

---

## Formulários

Utilizar Zod para validação.

Implementar:

* mensagens de validação;
* estado de envio;
* botão desabilitado durante submit;
* prevenção de submissão duplicada;
* feedback de erro de autenticação.

---

## Better Auth API

Expor o handler do Better Auth em:

```text
src/app/api/auth/[...all]/route.ts
```

Reutilizar:

```text
src/lib/auth.ts
src/lib/auth-client.ts
```

Não duplicar configuração.

---

## Fora do escopo

Não implementar:

* Account WatchMap;
* `account_members`;
* roles;
* recuperação de senha;
* verificação de email;
* login social;
* magic link;
* MFA;
* perfil;
* biblioteca real de vídeos;
* upload;
* player;
* Evandro.

---

## Validação manual

### Signup

```text
/signup
→ criar usuário
→ sessão criada
→ /videos
```

### Login

```text
/login
→ autenticar
→ /videos
```

### Login inválido

```text
/login
→ credenciais inválidas
→ permanece em /login
→ erro visível
```

### Proteção

```text
sem sessão
→ /videos
→ /login
```

### Redirecionamento

```text
com sessão
→ /login ou /signup
→ /videos
```

### Logout

```text
/videos
→ logout
→ /login
→ tentar /videos
→ /login
```

---

## Critérios de aceite

* [ ] signup por email e senha funciona;
* [ ] login funciona;
* [ ] logout invalida a sessão;
* [ ] sessão persiste entre navegações e reloads;
* [ ] `/videos` exige autenticação;
* [ ] proteção acontece server-side;
* [ ] usuário autenticado é redirecionado para `/videos` ao acessar `/login` ou `/signup`;
* [ ] validação dos formulários funciona;
* [ ] loading e erros possuem feedback visual;
* [ ] interface segue o design system;
* [ ] nenhum recurso de Account WatchMap foi implementado;
* [ ] todos os checks do projeto passam.

---

## Milestone

Commit esperado após conclusão e validação:

```text
spec(002): authentication
```

Após o commit, enviar para o repositório remoto conforme definido em `AGENTS.md`.