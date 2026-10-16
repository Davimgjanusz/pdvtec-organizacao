"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { taskSchema, type TaskFormData } from "@/lib/validations/schemas";
import { createClient } from "@/lib/supabase/client";
import type { Task, Profile, Contract } from "@/types/database";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface TaskFormProps {
  defaultValues?: Task;
  onSubmit: (data: TaskFormData) => Promise<{ error?: string }>;
  onCancel: () => void;
}

export function TaskForm({ defaultValues, onSubmit, onCancel }: TaskFormProps) {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<Profile[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
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
          due_date: defaultValues.due_date,
        }
      : {
          column_status: "todo",
          priority: "medium",
        },
  });

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();
      const [usersRes, contractsRes] = await Promise.all([
        supabase.from("profiles").select("*").order("full_name"),
        supabase.from("contracts").select("*, client:clients(corporate_name)").eq("status", "active").order("contract_number"),
      ]);
      setUsers(usersRes.data ?? []);
      setContracts((contractsRes.data ?? []) as Contract[]);
    };
    fetchData();
  }, []);

  return (
    <form onSubmit={handleSubmit(async (data) => {
      setLoading(true);
      const result = await onSubmit(data as TaskFormData);
      if (result?.error) toast.error(result.error);
      setLoading(false);
    })} className="space-y-4">
      <div>
        <Label htmlFor="task_title">Título</Label>
        <Input id="task_title" {...register("title")} aria-invalid={!!errors.title} />
        {errors.title && <p className="text-sm text-destructive mt-1">{errors.title.message}</p>}
      </div>

      <div>
        <Label htmlFor="task_description">Descrição</Label>
        <Textarea id="task_description" rows={3} {...register("description")} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Prioridade</Label>
          <Controller
            name="priority"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div>
          <Label htmlFor="task_due_date">Prazo</Label>
          <Input id="task_due_date" type="date" {...register("due_date")} />
        </div>

        <div>
          <Label>Responsável</Label>
          <Controller
            name="assigned_to"
            control={control}
            render={({ field }) => (
              <Select value={field.value ?? ""} onValueChange={(v) => field.onChange(v || null)}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div>
          <Label>Contrato</Label>
          <Controller
            name="contract_id"
            control={control}
            render={({ field }) => (
              <Select value={field.value ?? ""} onValueChange={(v) => field.onChange(v || null)}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum</SelectItem>
                  {contracts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.contract_number} — {(c.client as { corporate_name?: string })?.corporate_name ?? ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {defaultValues ? "Atualizar" : "Criar Tarefa"}
        </Button>
      </div>
    </form>
  );
}
