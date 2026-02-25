/**
 * Módulo de Storage para Supabase.
 *
 * Usado APENAS em produção (NODE_ENV=production) e staging (NODE_ENV=staging).
 * Em desenvolvimento, os uploads continuam em disco local (data/uploads).
 *
 * Isolamento de ambientes:
 *   - Produção: usa SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY de .env.production
 *   - Staging:  usa SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY de .env.staging
 *   Nunca há mistura — as variáveis são carregadas por load-env.ts antes deste módulo.
 *
 * Criação de buckets:
 *   Os buckets são criados programaticamente na primeira utilização (ensureBucket).
 *   O administrador não precisa criar nada manualmente no Supabase Dashboard.
 *
 * Convenção para distinguir paths:
 *   - Path em disco: começa com "data/" (relativo à raiz do projeto)
 *   - Storage key:   não começa com "data/" — ex: "{tenantId}/tasks/{taskId}/{id}_{name}"
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Bucket names — configuráveis via env, com fallbacks seguros
// ---------------------------------------------------------------------------

/** Bucket privado para evidências de tarefas e justificativas. */
export const BUCKET_EVIDENCES =
  process.env.SUPABASE_STORAGE_BUCKET_EVIDENCES || "task-evidences";

/** Bucket para logos de tenants (criado como privado; servido pelo backend). */
export const BUCKET_LOGOS =
  process.env.SUPABASE_STORAGE_BUCKET_LOGOS || "tenant-logos";

// ---------------------------------------------------------------------------
// Helpers de ambiente
// ---------------------------------------------------------------------------

/**
 * Retorna true quando o app deve usar o Supabase Storage.
 * Em desenvolvimento, uploads vão para disco local (sem alterar o comportamento existente).
 */
export function shouldUseStorage(): boolean {
  const env = process.env.NODE_ENV;
  return env === "production" || env === "staging";
}

/**
 * Determina se um valor armazenado no banco é uma Storage key (não um path em disco).
 *
 * Convenção:
 *   - Paths em disco: começam com "data/" ou "data\" (caminhos relativos gravados em produção antiga)
 *   - Storage keys: não começam com "data/" — são chaves de objeto do bucket
 *
 * Exemplos de Storage key:
 *   - "abc123/tasks/def456/evid789_relatorio.pdf"
 *   - "abc123/justifications/ghi012/evid345_foto.jpg"
 *   - "abc123/logo.png"
 */
export function isStorageKey(filePath: string | null | undefined): boolean {
  if (!filePath || filePath.trim() === "") return false;
  const normalized = filePath.replace(/\\/g, "/").trimStart();
  return !normalized.startsWith("data/");
}

// ---------------------------------------------------------------------------
// Supabase client — instanciado uma única vez por processo
// ---------------------------------------------------------------------------

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "[supabase-storage] SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios " +
        "para uso do Storage em produção/staging. Verifique .env.production ou .env.staging."
    );
  }

  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return _client;
}

// ---------------------------------------------------------------------------
// Garantia de existência dos buckets (criação automática)
// ---------------------------------------------------------------------------

const ensuredBuckets = new Set<string>();

/**
 * Garante que o bucket existe, criando-o programaticamente se necessário.
 * A verificação é feita uma única vez por processo por bucket (cache em memória).
 */
async function ensureBucket(name: string, isPublic: boolean): Promise<void> {
  if (ensuredBuckets.has(name)) return;

  const client = getClient();
  const { error: getError } = await client.storage.getBucket(name);

  if (!getError) {
    ensuredBuckets.add(name);
    return;
  }

  // Tenta criar o bucket caso não exista
  const { error: createError } = await client.storage.createBucket(name, {
    public: isPublic,
    fileSizeLimit: null,
  });

  if (createError) {
    const msg = createError.message.toLowerCase();
    // Ignora erro "já existe" (race condition ou criado fora do código)
    if (!msg.includes("already exists") && !msg.includes("duplicate")) {
      throw new Error(
        `[supabase-storage] Falha ao criar bucket "${name}": ${createError.message}`
      );
    }
  }

  ensuredBuckets.add(name);
  console.log(
    `[supabase-storage] Bucket "${name}" pronto (public=${isPublic}, env=${process.env.NODE_ENV})`
  );
}

// ---------------------------------------------------------------------------
// API pública do módulo
// ---------------------------------------------------------------------------

/**
 * Faz upload de um buffer para o Supabase Storage.
 *
 * @param bucket        - Nome do bucket
 * @param key           - Chave do objeto dentro do bucket (path sem barra inicial)
 * @param buffer        - Conteúdo do arquivo
 * @param mimeType      - MIME type do arquivo
 * @param isPublicBucket - Se o bucket deve ser criado como público (apenas na criação)
 * @returns A mesma `key` passada como argumento (para gravação no banco)
 */
export async function uploadFile(
  bucket: string,
  key: string,
  buffer: Buffer,
  mimeType: string,
  isPublicBucket = false
): Promise<string> {
  if (!shouldUseStorage()) {
    throw new Error(
      "[supabase-storage] uploadFile chamado fora de produção/staging. " +
        "Use armazenamento em disco em desenvolvimento."
    );
  }

  await ensureBucket(bucket, isPublicBucket);

  const client = getClient();
  const { error } = await client.storage.from(bucket).upload(key, buffer, {
    contentType: mimeType,
    upsert: true,
  });

  if (error) {
    throw new Error(
      `[supabase-storage] Falha no upload da chave "${key}": ${error.message}`
    );
  }

  return key;
}

/**
 * Baixa um arquivo do Supabase Storage e retorna um Buffer.
 */
export async function downloadFile(bucket: string, key: string): Promise<Buffer> {
  if (!shouldUseStorage()) {
    throw new Error(
      "[supabase-storage] downloadFile chamado fora de produção/staging."
    );
  }

  const client = getClient();
  const { data, error } = await client.storage.from(bucket).download(key);

  if (error || !data) {
    throw new Error(
      `[supabase-storage] Falha no download da chave "${key}": ${
        error?.message ?? "sem dados retornados"
      }`
    );
  }

  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Remove um arquivo do Supabase Storage.
 * Não lança erro se o arquivo não existir — apenas registra um aviso.
 */
export async function deleteFile(bucket: string, key: string): Promise<void> {
  if (!shouldUseStorage()) return;

  const client = getClient();
  const { error } = await client.storage.from(bucket).remove([key]);

  if (error) {
    // Falha de exclusão não bloqueia o fluxo — apenas registra
    console.warn(
      `[supabase-storage] Aviso ao excluir chave "${key}": ${error.message}`
    );
  }
}
