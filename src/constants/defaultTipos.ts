/**
 * Tipos de tarefa padrão (comuns no mercado).
 * Usados ao "Carregar tipos padrão" e ao criar nova área.
 */
export const DEFAULT_TIPOS_TAREFA = [
  "Reunião",
  "Relatório",
  "Desenvolvimento",
  "Análise",
  "Treinamento",
  "Suporte",
  "Documentação",
  "Planejamento",
  "Acompanhamento",
  "Outros",
] as const;

export type DefaultTipo = (typeof DEFAULT_TIPOS_TAREFA)[number];

export function getDefaultTiposList(): string[] {
  return [...DEFAULT_TIPOS_TAREFA];
}
