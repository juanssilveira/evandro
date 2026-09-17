# Ambientes
 
## Development
 
- **Git branch:** `development`
- **Execução:** Local
- **Aplicação:** `http://localhost:3000`
- **BASE_URL:** `http://localhost:3000`
- **CDN_URL:** `http://localhost:3000`
- **Database:** Neon development
- **Video Infra:** Mux Development environment
- **Finalidade:** desenvolvimento livre e local.
 
## Production
 
- **Git branch:** `main`
- **Execução:** Remota
- **Aplicação:** `https://app.evandro.watch`
- **Player CDN:** `https://cdn.evandro.watch`
- **BASE_URL:** `https://app.evandro.watch`
- **CDN_URL:** `https://cdn.evandro.watch`
- **Database:** Neon production
- **Video Infra:** Mux Production environment
- **Finalidade:** ambiente oficial de produção utilizado pelos clientes.
 
## Regras de Isolamento
 
Nenhum ambiente pode possuir fallback para recursos de outro ambiente.
 
Se uma variável obrigatória estiver ausente, a aplicação deve falhar claramente em vez de utilizar silenciosamente recursos de outro ambiente.

