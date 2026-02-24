/**
 * Configuração do PM2 para deploy (produção + staging).
 * Uso no VPS:
 *   cd ~/Task-Manager
 *   npm run build
 *   pm2 start ecosystem.config.js
 *
 * Produção: PORT 3000, carrega .env.production. Staging: PORT 3001, carrega .env.staging.
 * Na VPS, tenha .env.production e .env.staging na pasta do projeto.
 *
 * restart_delay: aguarda 5s antes de cada reinicialização (evita hammering do Supabase pooler).
 * max_restarts: após 10 falhas consecutivas em 60s, PM2 para de reiniciar (evita ciclo infinito).
 * min_uptime: processo precisa ficar no ar por 5s para resetar o contador de restarts.
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
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: 5000,
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
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: 5000,
      env: {
        NODE_ENV: "staging",
        PORT: 3001,
      },
    },
  ],
};
