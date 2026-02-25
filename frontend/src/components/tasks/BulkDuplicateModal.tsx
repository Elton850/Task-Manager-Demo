import React, { useState } from "react";
import { Copy, Layers, Plus, X } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import type { Task } from "@/types";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateBr(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  if (!y || !m || !d) return ymd;
  return `${d}/${m}/${y}`;
}

interface BulkDuplicateModalProps {
  open: boolean;
  task: Task | null;
  onClose: () => void;
  onSuccess: (created: number, newTasks: Task[]) => void;
  onRequest: (id: string, dates: string[]) => Promise<{ created: number; tasks: Task[] }>;
}

export default function BulkDuplicateModal({
  open,
  task,
  onClose,
  onSuccess,
  onRequest,
}: BulkDuplicateModalProps) {
  const [dateInput, setDateInput] = useState(todayStr());
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const addDate = () => {
    const trimmed = dateInput.trim();
    if (!trimmed) return;
    const match = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
    if (!match) return;
    setSelectedDates(prev => {
      if (prev.includes(trimmed)) return prev;
      return [...prev, trimmed].sort();
    });
    setDateInput(trimmed);
  };

  const removeDate = (date: string) => {
    setSelectedDates(prev => prev.filter(d => d !== date));
  };

  const handleSubmit = async () => {
    if (!task || selectedDates.length === 0) return;
    setLoading(true);
    try {
      const result = await onRequest(task.id, selectedDates);
      onSuccess(result.created, result.tasks);
      setSelectedDates([]);
      setDateInput(todayStr());
      onClose();
    } finally {
      setLoading(false);
    }
  };

  if (!task) return null;

  const hasSubtasks = (task.subtaskCount ?? 0) > 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Replicar tarefa para datas escolhidas"
      subtitle="Escolha as datas de prazo. Uma cópia da tarefa (e das subtarefas) será criada para cada data."
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={loading}
            disabled={selectedDates.length === 0}
            icon={<Copy size={14} />}
          >
            Replicar para {selectedDates.length} data{selectedDates.length !== 1 ? "s" : ""}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600/80 p-3">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate" title={task.atividade}>
            {task.atividade}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Tarefa atual: competência <strong>{task.competenciaYm}</strong>
            {task.prazo && (
              <span>, prazo {new Date(task.prazo + "T00:00:00").toLocaleDateString("pt-BR")}</span>
            )}
            {hasSubtasks && (
              <span className="ml-2 inline-flex items-center gap-1">
                <Layers size={12} />
                {task.subtaskCount} subtarefa(s) serão replicadas
              </span>
            )}
          </p>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider block mb-2">
            Adicionar datas (prazo de cada cópia)
          </label>
          <div className="flex gap-2">
            <input
              type="date"
              value={dateInput}
              onChange={e => setDateInput(e.target.value)}
              className="flex-1 rounded-lg border border-slate-300 dark:border-slate-500 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              min="2020-01-01"
              max="2030-12-31"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addDate}
              icon={<Plus size={14} />}
              title="Adicionar esta data"
            >
              Adicionar
            </Button>
          </div>
        </div>

        {selectedDates.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2">
              Datas selecionadas ({selectedDates.length})
            </p>
            <ul className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-600/80 divide-y divide-slate-200 dark:divide-slate-600/60">
              {selectedDates.map(date => (
                <li
                  key={date}
                  className="flex items-center justify-between py-2 px-3 text-sm text-slate-700 dark:text-slate-200"
                >
                  <span>{formatDateBr(date)}</span>
                  <button
                    type="button"
                    onClick={() => removeDate(date)}
                    className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30"
                    aria-label={`Remover ${formatDateBr(date)}`}
                  >
                    <X size={16} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}
