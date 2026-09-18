# 041 — Default Video Provider Control

## Objetivo

Adicionar ao painel administrativo uma configuração global para escolher qual infraestrutura receberá os NOVOS uploads:

```text
Mux
Bunny
```

A troca afeta exclusivamente vídeos criados depois da alteração.

Regra definitiva:

```text
default provider atual
↓
NOVO upload
↓
grava provider no vídeo
↓
esse vídeo permanece nesse provider para sempre
```

Vídeos existentes nunca são alterados.

---

# 1. Dependência

Esta spec pressupõe a infraestrutura multi-provider da spec 040:

- `video.provider`;
- Mux adapter;
- Bunny adapter;
- provider registry;
- `getDefaultVideoProviderName()`.

Não recriar essa infraestrutura.

Apenas conectar o default a uma configuração persistente.

---

# 2. Persistência

O provider default NÃO deve existir apenas em memória ou variável de ambiente.

Criar uma configuração persistente no banco.

Pode utilizar uma tabela simples equivalente a:

```text
app_settings

key
value
created_at
updated_at
```

Configuração:

```text
key = default_video_provider
value = mux | bunny
```

Não criar configuração por usuário ou por conta.

É uma configuração global do ambiente/plataforma.

---

# 3. Default seguro

Se não existir configuração persistida:

```text
default = mux
```

Isso preserva o comportamento atual.

Se o valor persistido for inválido:

```text
default = mux
```

e registrar warning server-side.

---

# 4. Fonte de verdade

`getDefaultVideoProviderName()` passa a ler essa configuração.

Resultado:

```ts
"mux" | "bunny"
```

Nenhum outro lugar deve decidir diretamente o provider default.

Não espalhar:

```ts
process.env.DEFAULT_PROVIDER
```

ou:

```ts
"mux"
```

pela lógica de upload.

---

# 5. Momento da escolha

O default é consultado somente durante a criação de um novo vídeo.

Fluxo:

```text
createVideoUploadSession()
↓
getDefaultVideoProviderName()
↓
provider = valor atual
↓
insert video(provider)
↓
provider.createUploadSession()
```

Depois que o registro foi criado:

```text
video.provider
```

é definitivo.

Sync, playback, poster, preview e delete usam sempre `video.provider`.

Nunca consultam novamente o default.

---

# 6. Troca de provider

Exemplo:

```text
default = mux

vídeo A → mux
vídeo B → mux
```

Admin altera:

```text
default = bunny
```

Resultado:

```text
vídeo A → mux
vídeo B → mux
vídeo C → bunny
vídeo D → bunny
```

Admin volta para Mux:

```text
vídeo E → mux
```

Nenhum vídeo anterior é migrado.

---

# 7. Painel `/dev`

Adicionar nova tab:

```text
Infra de Vídeo
```

Sugestão de id:

```text
video-infra
```

Navigation:

```text
Overview
Usuários
Redeem Codes
Infra de Vídeo
```

Manter integralmente o guard local existente do `/dev`.

---

# 8. Tela

Criar uma tela simples, sem excesso de opções.

Título:

```text
Infraestrutura de Vídeo
```

Descrição:

```text
Escolha qual provider será utilizado para novos uploads.
Vídeos existentes permanecem na infraestrutura em que foram criados.
```

---

# 9. Seletor

Exibir dois cards/opções:

```text
Mux
Bunny Stream
```

Cada opção deve mostrar:

- nome;
- status de configuração;
- indicação se é o provider ativo.

Exemplo:

```text
┌─────────────────────────┐
│ Mux                     │
│ Configurado             │
│                         │
│ ● Provider atual        │
└─────────────────────────┘

┌─────────────────────────┐
│ Bunny Stream            │
│ Configurado             │
│                         │
│ ○ Usar para novos vídeos│
└─────────────────────────┘
```

Manter o estilo atual do painel admin.

---

# 10. Status de configuração

Criar função server-side equivalente a:

```ts
getVideoProviderConfigurationStatus()
```

Mux configurado quando:

```text
MUX_TOKEN_ID
MUX_TOKEN_SECRET
```

estão presentes.

Bunny configurado quando:

```text
BUNNY_STREAM_LIBRARY_ID
BUNNY_STREAM_API_KEY
BUNNY_STREAM_CDN_HOSTNAME
```

estão presentes.

Não enviar valores das credentials ao client.

Retornar apenas:

```ts
{
  mux: {
    configured: true
  },
  bunny: {
    configured: false
  }
}
```

---

# 11. Provider não configurado

Não permitir selecionar um provider sem configuração completa.

Exemplo:

```text
Bunny Stream
Configuração incompleta
```

Opção desabilitada.

Mostrar indicação simples:

```text
Configure as variáveis de ambiente necessárias antes de ativar.
```

Não mostrar secrets.

---

# 12. Alteração do default

Criar server action equivalente a:

```ts
updateDefaultVideoProviderAction(provider)
```

Aceitar apenas:

```text
mux
bunny
```

A action deve:

1. executar `assertLocalDevPanelAccess()`;
2. validar provider;
3. confirmar que o provider está configurado;
4. persistir `default_video_provider`;
5. revalidar `/dev`.

---

# 13. Sem fallback silencioso

Se o default persistido for:

```text
bunny
```

e posteriormente as Bunny credentials forem removidas:

NOVOS uploads devem falhar explicitamente.

NÃO fazer:

```text
Bunny quebrado
→ silenciosamente enviar para Mux
```

Isso faria a infraestrutura real divergir da configuração escolhida.

Fallback para Mux só é permitido quando:

```text
a configuração default ainda NÃO existe
```

ou contém valor estruturalmente inválido.

---

# 14. Confirmação na troca

Como a alteração afeta uploads futuros, exibir confirmação simples antes de trocar.

Exemplo:

```text
Alterar provider para Bunny Stream?

A mudança será aplicada somente aos novos uploads.
Os vídeos existentes não serão alterados.
```

Botões:

```text
Cancelar
Alterar provider
```

Não precisa confirmação adicional para cada upload.

---

# 15. Feedback

Após alteração bem-sucedida:

```text
Provider padrão alterado para Bunny Stream.
Novos uploads usarão esta infraestrutura.
```

ou equivalente.

Atualizar a tela imediatamente.

---

# 16. Não alterar vídeos existentes

A action que altera o default NÃO pode executar:

```text
UPDATE videos SET provider = ...
```

Não pode:

- migrar vídeos;
- alterar IDs;
- recriar mídia;
- sincronizar vídeos antigos;
- deletar assets.

Ela altera apenas:

```text
default_video_provider
```

---

# 17. Concorrência

A escolha do provider acontece quando o novo upload é criado.

Se o admin trocar o default enquanto um upload já estiver em andamento:

```text
upload já criado
→ continua com provider originalmente salvo
```

Somente o próximo registro criado utiliza o novo default.

---

# 18. UploadDialog

Não adicionar seletor de provider ao UploadDialog.

O usuário final não escolhe infraestrutura.

Fluxo continua:

```text
Enviar vídeo
↓
backend escolhe default
↓
client recebe transporte
↓
upload
```

Mux/Bunny continuam transparentes para o usuário.

---

# 19. Observabilidade no painel

Na mesma tela, mostrar contagem simples de vídeos por provider:

```text
Mux
23 vídeos

Bunny
8 vídeos
```

Usar:

```text
videos.provider
```

Não consultar APIs Mux/Bunny para obter essas contagens.

---

# 20. Mostrar provider em desenvolvimento

Opcionalmente na tela Infra de Vídeo:

```text
Provider atual: Bunny Stream
```

Não adicionar provider aos cards públicos da Biblioteca.

A infraestrutura continua sendo detalhe interno.

---

# 21. Não alterar regras de reprodução

Esta spec não altera:

- bootstrap;
- entitlement;
- quota;
- tracking;
- playback;
- player;
- Background Autoplay;
- HLS;
- thumbnails;
- background previews.

Tudo isso continua sendo resolvido pela spec 040 através de `video.provider`.

---

# 22. Não alterar credentials

O painel NÃO deve permitir editar:

```text
MUX_TOKEN_ID
MUX_TOKEN_SECRET
BUNNY_STREAM_API_KEY
...
```

Credentials continuam exclusivamente em environment variables.

O painel apenas mostra:

```text
Configurado
Configuração incompleta
```

---

# 23. Estrutura sugerida

Pode criar algo equivalente a:

```text
src/lib/settings/app-settings.ts
src/components/dev/video-infra-view.tsx
```

E reutilizar:

```text
src/app/actions/dev.ts
src/lib/dev/service.ts
src/app/dev/page.tsx
src/components/dev/dev-header.tsx
```

Não criar subsistema de configuração excessivamente complexo.

---

# 24. Testes

## Estado inicial

Sem configuração no banco:

```text
getDefaultVideoProviderName()
→ mux
```

Novo vídeo:

```text
provider = mux
```

## Troca para Bunny

```text
admin → Bunny
↓
setting = bunny
↓
novo vídeo → bunny
```

Vídeos Mux antigos continuam Mux.

## Volta para Mux

```text
admin → Mux
↓
novo vídeo → mux
```

Vídeos Bunny continuam Bunny.

## Bunny sem credentials

```text
Bunny configured = false
↓
não pode ser selecionado
```

## Credentials removidas depois

```text
default = bunny
credentials ausentes
↓
novo upload falha explicitamente
```

Nunca fallback silencioso para Mux.

---

# Critérios de aceite

- Existe configuração persistente `default_video_provider`.
- Ausência de configuração significa Mux.
- Admin pode escolher Mux ou Bunny.
- Apenas providers configurados podem ser selecionados.
- Nenhum secret é enviado ao browser.
- Troca afeta somente novos uploads.
- Vídeos existentes não são alterados.
- `video.provider` permanece imutável.
- Upload em andamento não muda de provider.
- Novo upload lê o default no momento da criação.
- Não existe seletor de provider para usuário final.
- Painel mostra qual provider está ativo.
- Painel mostra quantidade de vídeos por provider.
- Não existe fallback silencioso Bunny → Mux.
- Playback e player não são alterados.