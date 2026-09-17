# 027 — Settings Account and Security

## Objetivo

Melhorar a página de Configurações, deixando a interface mais madura e organizando claramente:

- informações da conta;
- segurança;
- informações do plano.

Consultar o material de design e instruções existentes antes de implementar.

---

## 1. Estrutura

Organizar a página em três seções:

### Conta
Dados do usuário.

### Segurança
Alteração de senha.

### Plano
Informações e limites da assinatura atual.

Não criar novas páginas para essas seções nesta etapa.

---

## 2. Conta

Exibir:

- Nome;
- Email.

O email permanece somente leitura.

Permitir editar o nome do usuário.

Fluxo:

- campo com nome atual;
- botão "Salvar alterações";
- persistir no usuário autenticado;
- feedback de sucesso/erro;
- atualizar imediatamente os locais da interface que exibem o nome.

Usar a estrutura de autenticação existente.

---

## 3. Segurança

Adicionar alteração de senha.

Campos:

- Senha atual;
- Nova senha;
- Confirmar nova senha.

Regras:

- validar senha atual;
- exigir confirmação da nova senha;
- impedir envio se as novas senhas forem diferentes;
- usar o mecanismo de autenticação já existente para efetuar a alteração;
- não implementar lógica própria de hash ou armazenamento de senha.

Após sucesso:

- limpar os campos;
- mostrar feedback claro.

---

## 4. Plano

As informações de plano devem parecer informações da conta, não cards de dashboard ou blocos promocionais.

Exibir de forma limpa e hierárquica:

- Plano atual;
- Status;
- Vídeos utilizados / limite;
- Plays utilizados no mês / limite;
- Duração máxima por vídeo;
- Qualidade máxima.

Pode utilizar barras de progresso discretas para consumo de Vídeos e Plays.

Os valores devem continuar vindo da mesma fonte de verdade já utilizada pelo sistema.

Não criar nesta spec:

- checkout;
- upgrade;
- downgrade;
- cobrança;
- cancelamento.

---

## 5. Visual

Melhorar o visual geral da página seguindo o design atual do produto.

Priorizar:

- largura e espaçamento consistentes;
- títulos e descrições claras;
- seções visualmente bem separadas;
- formulários com boa hierarquia;
- estados de loading/saving;
- feedback de sucesso e erro;
- aparência de SaaS maduro.

Evitar excesso de cards, badges, sombras ou elementos decorativos.

---

## Critérios de aceite

- Configurações possui seções Conta, Segurança e Plano.
- Usuário consegue alterar o próprio nome.
- Email aparece como informação somente leitura.
- Usuário consegue alterar a própria senha informando a senha atual.
- Alteração de senha utiliza a autenticação existente.
- Informações do plano não parecem métricas de dashboard.
- Vídeos e Plays exibem consumo e limite.
- Página possui estados claros de salvamento, sucesso e erro.
- Nenhuma funcionalidade de billing foi adicionada.