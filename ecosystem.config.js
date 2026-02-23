/**
 * Configuração do PM2 para deploy em produção.
 * Uso no VPS (sempre a partir da pasta do projeto):
 *   cd ~/Task-Manager
 *   npm run build
 *   pm2 start ecosystem.config.js
 *
 * Variáveis de ambiente: o app carrega .env e, se NODE_ENV=production, .env.production.
 * Na VPS, coloque um arquivo .env.production na pasta do projeto com as variáveis reais
 * (SUPABASE_DB_URL, DB_PROVIDER, JWT_SECRET, etc.). O PM2 já define NODE_ENV=production e PORT.
 */
module.exports = {
  apps: [
    {
      name: "task-manager",
      script: "./dist/server.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
