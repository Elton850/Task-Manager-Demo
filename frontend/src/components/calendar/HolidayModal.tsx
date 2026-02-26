import React, { useState, useEffect } from "react";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import type { Holiday, HolidayType } from "@/types";

const HOLIDAY_TYPE_OPTIONS: { value: HolidayType; label: string }[] = [
  { value: "national", label: "Nacional" },
  { value: "state", label: "Estadual" },
  { value: "municipal", label: "Municipal" },
  { value: "company", label: "Empresa / Ponto facultativo" },
];

interface HolidayModalProps {
  open: boolean;
  holiday: Holiday | null;
  initialDate?: string;
  onClose: () => void;
  onSave: (data: { date: string; name: string; type: HolidayType }) => Promise<void>;
  loading?: boolean;
}

export default function HolidayModal({
  open,
  holiday,
  initialDate,
  onClose,
  onSave,
  loading = false,
}: HolidayModalProps) {
  const [date, setDate] = useState(initialDate ?? "");
  const [name, setName] = useState("");
  const [type, setType] = useState<HolidayType>("company");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setDate(holiday?.date ?? initialDate ?? "");
    setName(holiday?.name ?? "");
    setType((holiday?.type as HolidayType) ?? "company");
    setError("");
  }, [open, holiday, initialDate]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Nome é obrigatório.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError("Data inválida. Use YYYY-MM-DD.");
      return;
    }
    setError("");
    try {
      await onSave({ date, name: trimmed, type });
      onClose();
    } catch (_) {
      setError("Erro ao salvar. Tente novamente.");
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={holiday ? "Editar feriado" : "Novo feriado"}
      subtitle={holiday ? "Altere os dados do feriado manual." : "Cadastre um feriado manual para o calendário."}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => handleSubmit()} loading={loading} disabled={loading}>
            {holiday ? "Salvar" : "Criar"}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Data"
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          required
          disabled={!!holiday?.source && holiday.source !== "manual"}
        />
        <Input
          label="Nome"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Ex.: Recesso de fim de ano"
          required
          maxLength={200}
        />
        <Select
          label="Tipo"
          options={HOLIDAY_TYPE_OPTIONS}
          value={type}
          onChange={e => setType(e.target.value as HolidayType)}
        />
        {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
      </form>
    </Modal>
  );
}
