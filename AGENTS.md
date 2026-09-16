# WatchMap — Agent Instructions

Este repositório contém o desenvolvimento do WatchMap.

## Regra principal

Antes de implementar ou alterar qualquer funcionalidade:

1. Leia os documentos relevantes em `/docs` (`00-PRODUCT.md`, `01-ARCHITECTURE.md`, `02-MODEL.md`, `03-DESIGN.md`).
2. Leia integralmente a spec da tarefa atual em `/specs`.
3. Respeite as decisões arquiteturais já existentes.
4. Implemente somente o que foi solicitado.
5. Leia `docs/03-DESIGN.md` antes de criar ou modificar interfaces.

## Princípios de desenvolvimento

* Preferir soluções simples e explícitas.
* Não criar abstrações prematuras.
* Não implementar funcionalidades futuras sem solicitação.
* Não duplicar código ou componentes existentes.
* Não adicionar dependências sem necessidade real.
* Utilizar TypeScript de forma estrita.
* Não utilizar `any` para contornar problemas de tipagem.
* Segurança e autorização devem ser validadas no servidor.
* Nunca confiar em IDs ou permissões enviados pelo frontend.
* Manter componentes pequenos e responsabilidades bem separadas.
* Preservar a arquitetura existente ao modificar código.

## Qualidade

Antes de considerar uma tarefa concluída:

* executar typecheck;
* executar lint;
* executar build;
* corrigir todos os erros encontrados.

Uma feature só está concluída quando todos os critérios de aceite definidos em sua spec forem atendidos.

## Git e Milestones

Cada spec representa um milestone de desenvolvimento.

Ao concluir integralmente uma spec:

1. validar todos os critérios de aceite;
2. executar os checks de qualidade do projeto;
3. revisar os arquivos alterados;
4. criar um único commit representando a conclusão da spec;
5. enviar o commit para o repositório remoto.

Utilizar o padrão:

```text
spec(XXX): descrição curta
```

Exemplos:

```text
spec(001): project foundation
spec(002): authentication
spec(003): account domain
spec(004): video library
```

O commit de milestone só deve ser criado quando a spec estiver concluída e validada.

Não incluir alterações não relacionadas à spec no commit.

Se o push não puder ser realizado por falta de configuração, autenticação ou acesso ao remoto, informar claramente o bloqueio em vez de alterar a configuração Git sem autorização.
