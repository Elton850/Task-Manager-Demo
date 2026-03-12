/**
 * Demo: utilitário de I/O JSON com escrita atômica.
 * Todos os arquivos ficam em data/demo/ (criado automaticamente).
 * Escrita atômica: grava em .tmp e renomeia para evitar arquivo corrompido.
 */
import fs from "fs";
import path from "path";

const DEMO_DATA_DIR = path.resolve(process.cwd(), "data", "demo");

export function ensureDataDir(): void {
  if (!fs.existsSync(DEMO_DATA_DIR)) {
    fs.mkdirSync(DEMO_DATA_DIR, { recursive: true });
  }
}

export function dataPath(filename: string): string {
  return path.join(DEMO_DATA_DIR, filename);
}

export function readJson<T>(filename: string, defaultValue: T): T {
  const filePath = dataPath(filename);
  if (!fs.existsSync(filePath)) return defaultValue;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
  } catch {
    return defaultValue;
  }
}

export function writeJson<T>(filename: string, data: T): void {
  ensureDataDir();
  const filePath = dataPath(filename);
  const tmpPath = filePath + ".tmp";
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), "utf-8");
  fs.renameSync(tmpPath, filePath);
}

/** Verifica se o arquivo de estado já existe (diferencia seed de dado persistido). */
export function fileExists(filename: string): boolean {
  return fs.existsSync(dataPath(filename));
}
