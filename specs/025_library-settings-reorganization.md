# 025 — Reorganização da Biblioteca e Configurações

## Objetivo

Reorganizar a estrutura inicial da aplicação antes de partir para uma reformulação visual maior.

A mudança deve separar claramente:

- Biblioteca de vídeos;
- Configurações da conta/plano;
- Navegação global;
- Navegação contextual dentro de um vídeo.

Antes de implementar, consultar o material de design e as instruções existentes no projeto e preservar os padrões atuais.

---

## 1. Header

Manter o header atual como navegação principal da aplicação.

Remover do header a breadcrumb que existe atualmente.

No centro do header, criar a navegação principal com:

- Biblioteca
- Configurações

Usar o padrão visual já existente no projeto.

Não criar sidebar neste momento.

---

## 2. Biblioteca

A página atual de vídeos passa a representar a Biblioteca.

Remover dessa página os cards de uso do plano:

- vídeos utilizados;
- plays do mês;
- qualidade/duração.

Essas informações pertencem à nova página de Configurações.

Manter nesta etapa:

- título da página;
- botão de envio de vídeo;
- listagem dos vídeos;
- funcionalidades atuais da biblioteca.

Pode haver pequenos ajustes de espaçamento, hierarquia e organização visual para acomodar a nova estrutura, mas não fazer ainda uma reformulação completa da biblioteca.

---

## 3. Configurações

Criar uma nova página de Configurações acessível pelo header.

Nesta primeira versão, ela deve concentrar as informações atualmente exibidas nos cards de plano da Biblioteca.

Exibir de forma organizada:

- plano atual;
- uso de vídeos;
- plays utilizados no mês;
- duração máxima permitida;
- qualidade máxima permitida.

Reutilizar os dados e regras já existentes.

Não criar billing, checkout, upgrade ou novas regras de plano nesta spec.

---

## 4. Página de vídeo

Não redesenhar a página individual do vídeo.

A única alteração deve ser de navegação.

Remover o atual "Voltar para biblioteca".

Reaproveitar exatamente a breadcrumb que hoje aparece no header e posicioná-la nesse local.

Não redesenhar nem criar uma nova breadcrumb.

---

## 5. Direção de implementação

Priorizar reorganização estrutural.

Não adicionar funcionalidades novas apenas para preencher espaço.

Reutilizar componentes existentes sempre que fizer sentido.

Se algum comportamento estiver ambíguo, não inventar uma solução complexa:
- usar a alternativa mais simples compatível com o design atual;
- ou pedir esclarecimento antes de ampliar o escopo.

---

## Critérios de aceite

- Header não contém mais a breadcrumb.
- Header possui navegação central com Biblioteca e Configurações.
- Biblioteca não exibe mais os cards de plano.
- Existe uma página de Configurações com as informações de plano/uso.
- Página individual do vídeo mantém seu design atual.
- Breadcrumb existente foi movida para o lugar do "Voltar para biblioteca".
- Nenhuma sidebar foi criada.
- Nenhuma nova funcionalidade de produto foi adicionada.
- Dados e regras existentes de plano continuam sendo a fonte de verdade.