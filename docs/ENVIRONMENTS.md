# Ambientes

### Development

Git branch:
development

Application:
http://localhost:3000

Database:
Neon development

Storage:
watchmap-videos-development

Finalidade:
desenvolvimento livre e local.

### Stage

Git branch:
stage

Application:
https://stage.evandro.watch

Database:
Neon stage

Storage:
watchmap-videos-stage

Finalidade:
ambiente isolado para testes internos em condições reais de produção.

### Production

Git branch:
main

Application:
https://evandro.watch

Database:
Neon production

Storage:
watchmap-videos-production

Finalidade:
ambiente real utilizado por clientes.

## Regras de Isolamento

Nenhum ambiente pode possuir fallback para recursos de outro ambiente.

Se uma variável obrigatória estiver ausente, a aplicação deve falhar claramente em vez de utilizar recursos de outro ambiente.
