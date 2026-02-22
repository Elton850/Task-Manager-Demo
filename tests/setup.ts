process.env.NODE_ENV = "test";
// Testes usam sempre SQLite (seed demo em data/taskmanager.db). Não usar Supabase para evitar
// necessidade de SUPABASE_DB_URL válida e para manter testes rápidos e determinísticos.
process.env.DB_PROVIDER = "sqlite";
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "test-jwt-secret-min-32-chars-long-for-production-check";
}
