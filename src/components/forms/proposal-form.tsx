"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { proposalSchema, type ProposalFormData } from "@/lib/validations/schemas";
import { CurrencyInput, FieldError } from "./masked-inputs";
import { createClient } from "@/lib/supabase/client";
import type { Client, Proposal } from "@/types/database";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { OptionSelect } from "@/components/ui/option-select";
import { Loader2 } from "lucide-react";
import { toast } from "@/lib/notify";

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
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("corporate_name");
      if (error) toast.error("Erro ao carregar a lista de clientes.", { id: "carregar-clientes" });
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
    <form noValidate onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="client_id">Cliente</Label>
          <Controller
            name="client_id"
            control={control}
            render={({ field }) => (
              <OptionSelect
                id="client_id"
                value={field.value}
                onValueChange={field.onChange}
                options={clients.map((c) => ({ value: c.id, label: c.corporate_name }))}
                placeholder="Selecione um cliente"
                aria-invalid={!!errors.client_id}
              />
            )}
          />
          <FieldError message={errors.client_id?.message} />
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="title">Título</Label>
          <Input id="title" {...register("title")} aria-invalid={!!errors.title} />
          <FieldError message={errors.title?.message} />
        </div>

        <div>
          <Label htmlFor="billing_type">Tipo de Cobrança</Label>
          <Controller
            name="billing_type"
            control={control}
            render={({ field }) => (
              <OptionSelect
                id="billing_type"
                value={field.value}
                onValueChange={field.onChange}
                options={[
                  { value: "one_off", label: "Pontual" },
                  { value: "recurring", label: "Recorrente" },
                  { value: "hybrid", label: "Híbrido" },
                ]}
              />
            )}
          />
        </div>

        <div>
          <Label htmlFor="valid_until">Validade</Label>
          <Input id="valid_until" type="date" {...register("valid_until")} aria-invalid={!!errors.valid_until} />
          <FieldError message={errors.valid_until?.message} />
        </div>

        <div>
          <Label htmlFor="setup_value">Valor de Implantação (R$)</Label>
          <Controller
            name="setup_value"
            control={control}
            render={({ field }) => (
              <CurrencyInput
                id="setup_value"
                name={field.name}
                getInputRef={field.ref}
                value={field.value}
                onValueChange={(v) => field.onChange(v ?? 0)}
                onBlur={field.onBlur}
                aria-invalid={!!errors.setup_value}
              />
            )}
          />
          <FieldError message={errors.setup_value?.message} />
        </div>

        <div>
          <Label htmlFor="recurring_value">Valor Recorrente (R$)</Label>
          <Controller
            name="recurring_value"
            control={control}
            render={({ field }) => (
              <CurrencyInput
                id="recurring_value"
                name={field.name}
                getInputRef={field.ref}
                value={field.value}
                onValueChange={(v) => field.onChange(v ?? 0)}
                onBlur={field.onBlur}
                aria-invalid={!!errors.recurring_value}
              />
            )}
          />
          <FieldError message={errors.recurring_value?.message} />
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="scope_description">Descrição do Escopo</Label>
          <Textarea id="scope_description" rows={4} {...register("scope_description")} aria-invalid={!!errors.scope_description} />
          <FieldError message={errors.scope_description?.message} />
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
