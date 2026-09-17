# Ambientes
 
## Development
 
- **Git branch:** `development`
- **Execução:** Local
- **Aplicação:** `http://localhost:3000`
- **APP_ENV:** `development`
- **DEV_PANEL_ENABLED:** `true`
- **BASE_URL:** `http://localhost:3000`
- **CDN_URL:** `http://localhost:3000`
- **Database:** Neon development
- **Video Infra:** Mux Development environment
- **Derived Assets:** Cloudflare R2 (`evandro-assets-development`)
- **Finalidade:** desenvolvimento livre e local.
 
## Production
 
- **Git branch:** `main`
- **Execução:** Remota
- **Aplicação:** `https://app.evandro.watch`
- **Player CDN:** `https://cdn.evandro.watch`
- **APP_ENV:** `production`
- **DEV_PANEL_ENABLED:** não configurado / `false`
- **BASE_URL:** `https://app.evandro.watch`
- **CDN_URL:** `https://cdn.evandro.watch`
- **Database:** Neon production
- **Video Infra:** Mux Production environment
- **Derived Assets:** Cloudflare R2 (`evandro-assets-production`)
- **Finalidade:** ambiente oficial de produção utilizado pelos clientes.
 
## Regras de Isolamento
 
Nenhum ambiente pode possuir fallback para recursos de outro ambiente.
 
Se uma variável obrigatória estiver ausente, a aplicação deve falhar claramente em vez de utilizar silenciosamente recursos de outro ambiente.

O painel interno de desenvolvimento (`/dev`) é estritamente isolado ao ambiente local de desenvolvimento (`APP_ENV=development`, `DEV_PANEL_ENABLED=true`, `NODE_ENV=development` em host loopback e fora da Vercel).


