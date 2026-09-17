# 032 — Folder UX Polish and Drag & Drop

## Objetivo

Refinar a experiência de pastas criada na spec 031.

A estrutura funcional já existe e deve ser preservada.

Esta spec deve melhorar:

- visual da Biblioteca;
- visual dos cards de pasta;
- modais relacionados a pastas;
- menu contextual das pastas;
- drag and drop de vídeos para pastas.

Não reconstruir o sistema de pastas do zero.

---

## 1. Biblioteca `/videos`

Melhorar a composição visual da Biblioteca para que pastas e vídeos pareçam partes do mesmo produto.

Manter a estrutura geral:

```text
Header da página
Ações
Pastas
Vídeos
```

As pastas devem ter presença clara, mas não dominar a tela.

Criar uma seção visual organizada:

```text
Pastas
[ Pasta ] [ Pasta ] [ Pasta ]
```

Depois:

```text
Vídeos
[ toolbar ]
[ cards ]
```

Evitar:

- cards excessivamente grandes;
- blocos vazios;
- cores muito fortes;
- aparência de file manager genérico;
- excesso de bordas e caixas.

Seguir a mesma densidade, radius, tipografia e spacing já utilizados nos cards de vídeo e no restante do SaaS.

---

## 2. Cards de pasta

Refinar o card de pasta.

Mostrar de forma clara:

- ícone da pasta;
- nome;
- quantidade de vídeos;
- cor selecionada.

A cor deve aparecer principalmente no ícone/detalhes discretos.

Adicionar estados visuais consistentes:

- hover;
- active/pressed;
- focus;
- drag-over.

O card inteiro continua abrindo a pasta com clique esquerdo.

Não adicionar informações desnecessárias.

---

## 3. Menu contextual da pasta

Adicionar o mesmo padrão de interação já existente nos vídeos.

Ao clicar com o botão direito sobre uma pasta:

- impedir o menu padrão do navegador naquele card;
- abrir menu contextual próprio próximo ao cursor.

Ações:

```text
Abrir
Renomear
Alterar cor
Excluir
```

`Excluir` deve aparecer como ação destrutiva e separada visualmente.

O menu deve:

- respeitar limites da viewport;
- fechar ao clicar fora;
- fechar com Escape;
- fechar após executar uma ação;
- não abrir a pasta ao selecionar uma ação.

O clique direito fora das pastas não deve ser alterado.

Sempre que fizer sentido, reutilizar o mesmo primitive/comportamento utilizado no menu contextual dos vídeos.

---

## 4. Menu acessível por botão

Além do clique direito, manter uma forma visível de acessar as mesmas ações através de botão de opções no card da pasta.

Exemplo:

```text
⋯
```

O menu desse botão e o menu de clique direito devem compartilhar:

- ações;
- lógica;
- componentes;
- estados.

Não manter duas implementações independentes.

---

## 5. Modais de pasta

Revisar todos os dialogs/modais relacionados às pastas:

- Criar pasta;
- Renomear pasta;
- Alterar cor;
- Excluir pasta;
- Mover vídeo para pasta.

Eles devem seguir o design system atual da aplicação.

Padronizar:

- largura;
- padding;
- header;
- título;
- descrição;
- inputs;
- footer;
- botões;
- estados loading;
- erro;
- foco;
- fechamento.

Evitar aparência de formulário genérico ou modal excessivamente grande.

---

## 6. Criar / editar pasta

Para criação e edição, utilizar uma interface compacta.

Estrutura sugerida:

```text
Nome da pasta
[input]

Cor
● ● ● ● ●
```

As cores devem ser selecionáveis visualmente.

Mostrar claramente qual cor está selecionada.

Não usar select/dropdown para as 5 cores.

Cor padrão:

```text
gray
```

---

## 7. Exclusão de pasta

O modal de exclusão deve explicar de forma simples que os vídeos NÃO serão apagados.

Exemplo:

```text
Excluir pasta?

Os vídeos desta pasta voltarão para a Biblioteca.
```

A ação destrutiva deve ser clara.

Não adicionar texto excessivo.

---

# Drag & Drop

## 8. Arrastar vídeo para pasta

Na página `/videos`, permitir arrastar um card de vídeo e soltá-lo sobre um card de pasta.

Fluxo:

```text
segurar vídeo
→ arrastar
→ pasta entra em estado drag-over
→ soltar
→ vídeo é movido para a pasta
```

Após sucesso:

- atualizar a interface imediatamente;
- remover o vídeo da raiz;
- atualizar contador da pasta;
- mostrar feedback discreto de sucesso.

Não navegar para a pasta automaticamente.

---

## 9. Feedback visual

Enquanto um vídeo estiver sendo arrastado:

O vídeo deve apresentar feedback de drag sem deformar o layout.

A pasta alvo deve indicar claramente que pode receber o vídeo.

Exemplo de comportamento:

```text
hover normal
→ card padrão

drag-over
→ borda/destaque da cor da pasta
→ fundo levemente destacado
```

Evitar animações exageradas.

O usuário deve perceber imediatamente onde pode soltar o vídeo.

---

## 10. Não confundir com upload por drag & drop

A Biblioteca já possui drag and drop de arquivos externos para upload.

Os dois comportamentos devem coexistir.

Distinguir explicitamente:

### Arquivo vindo do sistema operacional

```text
DataTransfer contém Files
→ fluxo atual de upload
```

### Card de vídeo sendo arrastado dentro da aplicação

```text
drag interno
→ mover vídeo para pasta
```

Arrastar um vídeo interno NÃO pode abrir o overlay de upload.

Arrastar um arquivo externo NÃO pode iniciar movimentação entre pastas.

Preservar integralmente o fluxo atual de upload por drag and drop.

---

## 11. Segurança da movimentação

A movimentação deve continuar validada no servidor.

Antes de mover:

- confirmar que o vídeo pertence à conta;
- confirmar que a pasta pertence à mesma conta.

Não confiar apenas nos IDs enviados pelo client.

Após movimentação:

```text
video.folderId = folder.id
```

Reutilizar a lógica existente de `Mover para pasta`.

Drag and drop não deve criar uma segunda regra de movimentação.

---

## 12. Falha ao mover

Se a operação falhar:

- manter/restaurar o vídeo na posição original;
- remover estado visual de drag;
- mostrar erro discreto.

Não deixar a UI indicando uma movimentação que não foi persistida.

---

## 13. Interações do card de vídeo

Adicionar drag sem quebrar:

- clique esquerdo;
- clique direito;
- menu contextual;
- download;
- editar;
- excluir;
- mover para pasta pelo menu.

Diferenciar corretamente clique de início de drag.

Um clique normal não deve iniciar movimentação acidental.

---

## 14. Responsividade

No desktop:

- drag and drop interno disponível.

Em dispositivos touch:

- não depender de drag and drop;
- `Mover para pasta` pelo menu continua sendo o fluxo principal.

Não implementar uma solução complexa de touch drag nesta etapa.

---

## 15. Página interna da pasta

Preservar o design e funcionalidades da página da pasta.

Fazer apenas os ajustes visuais necessários para manter consistência com a nova Biblioteca.

Não adicionar subpastas.

Não criar drag para reordenar vídeos.

Não criar ordenação manual.

---

## Critérios de aceite

- Biblioteca possui melhor hierarquia entre Pastas e Vídeos.
- Cards de pasta estão visualmente alinhados ao restante do SaaS.
- Modais relacionados a pastas foram padronizados.
- Seleção de cor é visual e compacta.
- Clique direito em pasta abre menu contextual próprio.
- Menu contextual possui Abrir, Renomear, Alterar cor e Excluir.
- Botão de opções da pasta reutiliza o mesmo menu/lógica.
- É possível arrastar vídeo da raiz para uma pasta.
- Pasta apresenta estado visual de drag-over.
- Ao soltar, vídeo é movido sem reload completo.
- Contador da pasta é atualizado.
- Drag interno não ativa upload.
- Drag externo continua ativando upload normalmente.
- Movimentação reutiliza a lógica existente de mover vídeo.
- Validação server-side garante vídeo e pasta na mesma conta.
- Falha de movimentação não deixa UI inconsistente.
- Clique e menu contextual dos vídeos continuam funcionando.
- Mobile continua podendo mover vídeos através do menu.