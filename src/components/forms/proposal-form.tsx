"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { proposalSchema, type ProposalFormData } from "@/lib/validations/schemas";
import { NumericFormat } from "react-number-format";
import { createClient } from "@/lib/supabase/client";
import type { Client, Proposal } from "@/types/database";

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

interface ProposalFormProps {
  defaultValues?: Proposal;
  onSubmit: (data: ProposalFormData) => Promise<{ error?: string }>;
  onCancel: () => void;
}

export function ProposalForm({ defaultValues, onSubmit, onCancel }: ProposalFormProps) {
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ProposalFormData>({
    resolver: zodResolver(proposalSchema),
    defaultValues: defaultValues
      ? {
          client_id: defaultValues.client_id,
          title: defaultValues.title,
          billing_type: defaultValues.billing_type,
          setup_value: Number(defaultValues.setup_value),
          recurring_value: Number(defaultValues.recurring_value),
          valid_until: defaultValues.valid_until,
          scope_description: defaultValues.scope_description,
          notes: defaultValues.notes,
        }
      : {
          setup_value: 0,
          recurring_value: 0,
          billing_type: "recurring",
        },
  });

  useEffect(() => {
    const fetchClients = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("clients")
        .select("*")
        .order("corporate_name");
      setClients(data ?? []);
    };
    fetchClients();
  }, []);

  const handleFormSubmit = async (data: ProposalFormData) => {
    setLoading(true);
    const result = await onSubmit(data);
    if (result?.error) toast.error(result.error);
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="client_id">Cliente</Label>
          <Controller
            name="client_id"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger aria-invalid={!!errors.client_id}>
                  <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.corporate_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.client_id && <p className="text-sm text-destructive mt-1">{errors.client_id.message}</p>}
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="title">Título</Label>
          <Input id="title" {...register("title")} aria-invalid={!!errors.title} />
          {errors.title && <p className="text-sm text-destructive mt-1">{errors.title.message}</p>}
        </div>

        <div>
          <Label htmlFor="billing_type">Tipo de Cobrança</Label>
          <Controller
            name="billing_type"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="one_off">Pontual</SelectItem>
                  <SelectItem value="recurring">Recorrente</SelectItem>
                  <SelectItem value="hybrid">Híbrido</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div>
          <Label htmlFor="valid_until">Validade</Label>
          <Input id="valid_until" type="date" {...register("valid_until")} aria-invalid={!!errors.valid_until} />
          {errors.valid_until && <p className="text-sm text-destructive mt-1">{errors.valid_until.message}</p>}
        </div>

        <div>
          <Label htmlFor="setup_value">Valor de Implantação (R$)</Label>
          <Controller
            name="setup_value"
            control={control}
            render={({ field }) => (
              <NumericFormat
                customInput={Input}
                id="setup_value"
                thousandSeparator="."
                decimalSeparator=","
                decimalScale={2}
                fixedDecimalScale
                prefix="R$ "
                value={field.value}
                onValueChange={(values) => field.onChange(values.floatValue ?? 0)}
                aria-invalid={!!errors.setup_value}
              />
            )}
          />
          {errors.setup_value && <p className="text-sm text-destructive mt-1">{errors.setup_value.message}</p>}
        </div>

        <div>
          <Label htmlFor="recurring_value">Valor Recorrente (R$)</Label>
          <Controller
            name="recurring_value"
            control={control}
            render={({ field }) => (
              <NumericFormat
                customInput={Input}
                id="recurring_value"
                thousandSeparator="."
                decimalSeparator=","
                decimalScale={2}
                fixedDecimalScale
                prefix="R$ "
                value={field.value}
                onValueChange={(values) => field.onChange(values.floatValue ?? 0)}
                aria-invalid={!!errors.recurring_value}
              />
            )}
          />
          {errors.recurring_value && <p className="text-sm text-destructive mt-1">{errors.recurring_value.message}</p>}
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="scope_description">Descrição do Escopo</Label>
          <Textarea id="scope_description" rows={4} {...register("scope_description")} aria-invalid={!!errors.scope_description} />
          {errors.scope_description && <p className="text-sm text-destructive mt-1">{errors.scope_description.message}</p>}
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="notes">Observações</Label>
          <Textarea id="notes" rows={2} {...register("notes")} />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {defaultValues ? "Atualizar" : "Criar Proposta"}
        </Button>
      </div>
    </form>
  );
}
