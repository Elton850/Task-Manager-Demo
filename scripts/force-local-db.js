/**
 * Define o path do SQLite local ANTES de carregar seedLocal.
 * Garante que npm run seed:local sempre escreva em data/taskmanager.db,
 * independente de DB_PROVIDER ou SQLITE_DB_PATH no .env.
 */
const path = require("path");
process.env.SQLITE_DB_PATH = path.resolve(process.cwd(), "data", "taskmanager.db");
