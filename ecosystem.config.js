/**
 * Configuração do PM2 para deploy (produção + staging).
 * Uso no VPS:
 *   cd ~/Task-Manager
 *   npm run build
 *   pm2 start ecosystem.config.js
 *
 * Produção: PORT 3000, carrega .env.production. Staging: PORT 3001, carrega .env.staging.
 * Na VPS, tenha .env.production e .env.staging na pasta do projeto.
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
    {
      name: "task-manager-staging",
      script: "./dist/server.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "staging",
        PORT: 3001,
      },
    },
  ],
};
