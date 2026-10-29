"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { taskSchema, type TaskFormData } from "@/lib/validations/schemas";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_COLUMNS, TASK_COLOR_OPTIONS } from "@/lib/kanban";
import { PRIORITY_OPTIONS, cn } from "@/lib/utils";
import type { Task, Profile, Contract, TaskColumnStatus } from "@/types/database";
import { FieldError } from "./masked-inputs";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { OptionSelect } from "@/components/ui/option-select";
import { Check, Loader2 } from "lucide-react";
import { toast } from "@/lib/notify";

const NONE = "__none__";

interface TaskFormProps {
  defaultValues?: Task;
  /** Valores iniciais de uma nova tarefa (ex.: coluna/raia de onde foi criada) */
  initialValues?: Partial<TaskFormData>;
  columns?: { slug: TaskColumnStatus; title: string }[];
  onSubmit: (data: TaskFormData) => Promise<{ error?: string }>;
  onCancel: () => void;
}

export function TaskForm({ defaultValues, initialValues, columns = DEFAULT_COLUMNS, onSubmit, onCancel }: TaskFormProps) {
  const [users, setUsers] = useState<Profile[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    defaultValues: defaultValues
      ? {
          contract_id: defaultValues.contract_id,
          assigned_to: defaultValues.assigned_to,
          title: defaultValues.title,
          description: defaultValues.description,
          column_status: defaultValues.column_status,
          priority: defaultValues.priority,
          color_tag: defaultValues.color_tag ?? "default",
          due_date: defaultValues.due_date,
        }
      : {
          title: "",
          description: "",
          column_status: "todo",
          priority: "medium",
          color_tag: "default",
          assigned_to: null,
          contract_id: null,
          due_date: null,
          ...initialValues,
        },
  });

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();
      const [usersRes, contractsRes] = await Promise.all([
        supabase.from("profiles").select("*").order("full_name"),
        supabase
          .from("contracts")
          .select("*, client:clients(corporate_name)")
          .in("status", ["active", "pending_renewal"])
          .order("contract_number"),
      ]);
      if (usersRes.error || contractsRes.error) {
        toast.error("Erro ao carregar responsáveis ou contratos.", { id: "carregar-opcoes-tarefa" });
      }
      setUsers(usersRes.data ?? []);
      const list = (contractsRes.data ?? []) as Contract[];
      // Mantém o contrato atual da tarefa como opção mesmo que não esteja mais ativo
      const current = defaultValues?.contract;
      if (current && !list.some((c) => c.id === current.id)) list.unshift(current);
      setContracts(list);
    };
    fetchData();
  }, [defaultValues?.contract]);

  return (
    <form
      noValidate
      onSubmit={handleSubmit(async (data) => {
        const result = await onSubmit({ ...data, due_date: data.due_date || null });
        if (result?.error) toast.error(result.error);
      })}
      className="space-y-4"
    >
      <div>
        <Label htmlFor="task_title">Título</Label>
        <Input id="task_title" {...register("title")} aria-invalid={!!errors.title} />
        <FieldError message={errors.title?.message} />
      </div>

      <div>
        <Label htmlFor="task_description">Descrição</Label>
        <Textarea id="task_description" rows={3} {...register("description")} aria-invalid={!!errors.description} />
        <FieldError message={errors.description?.message} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="task_column">Etapa</Label>
          <Controller
            name="column_status"
            control={control}
            render={({ field }) => (
              <OptionSelect
                id="task_column"
                value={field.value}
                onValueChange={field.onChange}
                options={columns.map((c) => ({ value: c.slug, label: c.title }))}
              />
            )}
          />
          <FieldError message={errors.column_status?.message} />
        </div>

        <div>
          <Label htmlFor="task_priority">Prioridade</Label>
          <Controller
            name="priority"
            control={control}
            render={({ field }) => (
              <OptionSelect id="task_priority" value={field.value} onValueChange={field.onChange} options={PRIORITY_OPTIONS} />
            )}
          />
          <FieldError message={errors.priority?.message} />
        </div>

        <div>
          <Label htmlFor="task_assignee">Responsável</Label>
          <Controller
            name="assigned_to"
            control={control}
            render={({ field }) => (
              <OptionSelect
                id="task_assignee"
                value={field.value ?? NONE}
                onValueChange={(v) => field.onChange(v === NONE ? null : v)}
                options={[{ value: NONE, label: "Nenhum" }, ...users.map((u) => ({ value: u.id, label: u.full_name }))]}
              />
            )}
          />
          <FieldError message={errors.assigned_to?.message} />
        </div>

        <div>
          <Label htmlFor="task_due_date">Prazo</Label>
          <Input id="task_due_date" type="date" {...register("due_date")} aria-invalid={!!errors.due_date} />
          <FieldError message={errors.due_date?.message} />
        </div>

        <div className="sm:col-span-2">
          <Label id="task_color_label">Etiqueta de cor</Label>
          <Controller
            name="color_tag"
            control={control}
            render={({ field }) => (
              <div role="group" aria-labelledby="task_color_label" className="mt-1.5 flex flex-wrap gap-2">
                {TASK_COLOR_OPTIONS.map((option) => {
                  const selected = field.value === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={selected}
                      aria-label={option.label}
                      title={option.label}
                      onClick={() => field.onChange(option.value)}
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-full border outline-none transition-shadow focus-visible:ring-3 focus-visible:ring-ring/50",
                        option.swatch,
                        option.value === "default" && "border-dashed text-muted-foreground",
                        selected && "ring-2 ring-primary ring-offset-2 ring-offset-background"
                      )}
                    >
                      {selected && <Check className={cn("h-3.5 w-3.5", option.value !== "default" && "text-white")} />}
                    </button>
                  );
                })}
              </div>
            )}
          />
          <FieldError message={errors.color_tag?.message} />
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="task_contract">Cliente / Contrato</Label>
          <Controller
            name="contract_id"
            control={control}
            render={({ field }) => (
              <OptionSelect
                id="task_contract"
                value={field.value ?? NONE}
                onValueChange={(v) => field.onChange(v === NONE ? null : v)}
                options={[
                  { value: NONE, label: "Nenhum" },
                  ...contracts.map((c) => ({
                    value: c.id,
                    label: `${c.contract_number} — ${(c.client as { corporate_name?: string } | undefined)?.corporate_name ?? ""}`,
                  })),
                ]}
              />
            )}
          />
          <FieldError message={errors.contract_id?.message} />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {defaultValues ? "Atualizar" : "Criar Tarefa"}
        </Button>
      </div>
    </form>
  );
}
