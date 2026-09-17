# 031 — Video Folders

## Objetivo

Adicionar organização por pastas à Biblioteca de vídeos.

As pastas devem ser simples, visuais e integradas ao fluxo atual da página `/videos`.

Nesta primeira versão:

- uma pasta pertence a uma conta;
- um vídeo pode estar em uma pasta ou na raiz;
- não existem subpastas;
- cada pasta pode ter uma cor;
- cinza é a cor padrão.

---

## 1. Modelo de dados

Criar uma entidade `folders`.

Cada pasta deve possuir:

```text
id
accountId
name
color
createdAt
updatedAt
```

Adicionar aos vídeos:

```text
folderId
```

`folderId` deve ser nullable.

Quando:

```text
folderId = null
```

o vídeo pertence à raiz da Biblioteca.

Garantir isolamento por `accountId`.

Uma conta nunca pode visualizar ou manipular pastas de outra conta.

---

## 2. Cores

Disponibilizar inicialmente 5 opções de cor.

Exemplo:

```text
gray
violet
blue
green
orange
```

`gray` deve ser o padrão.

As cores devem seguir tokens/paleta compatíveis com o design atual.

A cor deve aparecer principalmente:

- no ícone da pasta;
- em detalhes discretos do componente;
- sem transformar o card inteiro em uma área fortemente colorida.

---

## 3. Biblioteca

As pastas devem ter presença clara dentro de `/videos`.

Na raiz da Biblioteca, exibir:

1. pastas;
2. vídeos sem pasta.

As pastas devem aparecer antes da listagem de vídeos.

Criar uma seção visual clara para elas, mantendo a página integrada ao design atual.

Cada pasta deve mostrar no mínimo:

- ícone de pasta com sua cor;
- nome;
- quantidade de vídeos.

Clicar em uma pasta abre seu conteúdo.

---

## 4. Navegação

Usar uma rota própria para abrir uma pasta.

Preferência:

```text
/videos/folders/[folderId]
```

Ao abrir uma pasta, mostrar somente os vídeos pertencentes a ela.

Manter:

- toolbar;
- busca;
- filtros aplicáveis;
- ordenação;
- ações dos vídeos.

Não criar uma experiência visual completamente diferente da Biblioteca.

---

## 5. Breadcrumb

Na página da pasta:

```text
Biblioteca > Nome da pasta
```

Na página individual de um vídeo que pertence a uma pasta:

```text
Biblioteca > Nome da pasta > Nome do vídeo
```

Quando o vídeo não possuir pasta:

```text
Biblioteca > Nome do vídeo
```

`Biblioteca` deve continuar levando para:

```text
/videos
```

O nome da pasta deve levar para sua página.

Reutilizar o componente de breadcrumb já existente.

---

## 6. Criar pasta

Adicionar uma ação bem visível na Biblioteca:

```text
Nova pasta
```

Pode ficar próxima ao botão atual de upload.

Ao criar, permitir informar:

- nome;
- cor.

Cor padrão:

```text
gray
```

Não exigir escolha de cor.

Validar nome vazio.

Após criação, atualizar a Biblioteca imediatamente.

---

## 7. Ações da pasta

Adicionar menu contextual ou menu de ações para cada pasta.

Ações:

```text
Renomear
Alterar cor
Excluir
```

### Renomear

Permitir alterar o nome sem recriar a pasta.

### Alterar cor

Mostrar as mesmas 5 opções disponíveis na criação.

### Excluir

Exigir confirmação.

Excluir uma pasta NÃO deve excluir os vídeos.

Ao excluir:

```text
vídeos da pasta
→ folderId = null
→ voltam para a raiz da Biblioteca
```

Essa operação deve acontecer de forma segura/atômica.

---

## 8. Mover vídeos

Adicionar ao menu contextual existente dos vídeos:

```text
Mover para pasta
```

Ao abrir:

- listar as pastas da conta;
- permitir selecionar uma pasta;
- permitir selecionar `Biblioteca` / `Sem pasta`.

Após selecionar, atualizar `folderId`.

Manter as ações existentes:

```text
Baixar
Editar
Excluir
```

---

## 9. Upload dentro de uma pasta

Quando o usuário iniciar um upload enquanto estiver dentro de:

```text
/videos/folders/[folderId]
```

o novo vídeo deve ser associado automaticamente à pasta atual.

Na raiz:

```text
/videos
```

o vídeo deve continuar sendo criado sem pasta.

Não duplicar o fluxo de upload existente.

Apenas passar o contexto da pasta quando necessário.

---

## 10. Busca e ordenação

Dentro de uma pasta, busca e ordenação devem operar somente sobre os vídeos daquela pasta.

Na raiz, devem operar somente sobre os vídeos sem pasta.

Não misturar vídeos de outras pastas nos resultados da raiz.

As pastas podem possuir sua própria busca futuramente, mas isso não é necessário nesta versão.

---

## 11. Estados

Prever:

### Biblioteca sem pastas

Não mostrar uma área vazia desnecessária.

### Pasta vazia

Mostrar empty state simples:

```text
Esta pasta ainda não possui vídeos.
```

Manter disponíveis as ações:

- enviar vídeo;
- voltar para Biblioteca.

### Pasta inexistente ou de outra conta

Retornar `404`.

---

## 12. Regras

Não criar:

- subpastas;
- compartilhamento de pastas;
- permissões específicas por pasta;
- limite de pastas;
- analytics específico por pasta;
- drag and drop entre pastas nesta versão.

A implementação deve permanecer simples.

---

## Critérios de aceite

- É possível criar uma pasta.
- Pasta pertence à conta correta.
- Pasta possui nome e cor.
- Cinza é a cor padrão.
- Existem 5 opções de cor.
- Pastas aparecem de forma clara em `/videos`.
- Pastas aparecem antes dos vídeos na raiz.
- É possível abrir uma pasta.
- Pasta mostra somente seus próprios vídeos.
- É possível renomear pasta.
- É possível alterar a cor.
- É possível excluir pasta.
- Excluir pasta não exclui vídeos.
- Vídeos de pasta excluída voltam para a raiz.
- É possível mover vídeo entre pastas.
- É possível remover vídeo de uma pasta.
- Upload iniciado dentro de pasta associa o vídeo à pasta.
- Breadcrumb da pasta mostra `Biblioteca > Pasta`.
- Breadcrumb de vídeo em pasta mostra `Biblioteca > Pasta > Vídeo`.
- Vídeo sem pasta mantém `Biblioteca > Vídeo`.
- Não existem subpastas.
- Ações atuais dos vídeos continuam funcionando.