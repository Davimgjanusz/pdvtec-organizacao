"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { clientSchema, type ClientFormData } from "@/lib/validations/schemas";
import { PatternFormat } from "react-number-format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Search } from "lucide-react";
import { useState, useCallback } from "react";
import { toast } from "sonner";
import type { Client } from "@/types/database";

interface ClientFormProps {
  defaultValues?: Client;
  onSubmit: (data: ClientFormData) => Promise<{ error?: string }>;
  onCancel: () => void;
}

export function ClientForm({ defaultValues, onSubmit, onCancel }: ClientFormProps) {
  const [loading, setLoading] = useState(false);
  const [cnpjLoading, setCnpjLoading] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: defaultValues
      ? {
          corporate_name: defaultValues.corporate_name,
          trade_name: defaultValues.trade_name,
          cnpj: defaultValues.cnpj,
          contact_name: defaultValues.contact_name,
          contact_email: defaultValues.contact_email,
          contact_phone: defaultValues.contact_phone,
          zip_code: defaultValues.zip_code,
          street: defaultValues.street,
          neighborhood: defaultValues.neighborhood,
          city: defaultValues.city,
          state: defaultValues.state,
        }
      : undefined,
  });

  const lookupCnpj = useCallback(async () => {
    const rawCnpj = getValues("cnpj")?.replace(/\D/g, "");
    if (!rawCnpj || rawCnpj.length !== 14) {
      toast.error("Digite os 14 dígitos do CNPJ.");
      return;
    }

    setCnpjLoading(true);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${rawCnpj}`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        if (res.status === 404) {
          toast.warning("CNPJ não encontrado na base de dados.");
        } else {
          toast.error("Erro ao consultar CNPJ. Tente novamente.");
        }
        return;
      }

      const data = await res.json();

      const currentName = getValues("corporate_name");
      if (!currentName) setValue("corporate_name", data.razao_social ?? "");
      if (!getValues("trade_name")) setValue("trade_name", data.nome_fantasia ?? "");
      if (!getValues("zip_code")) setValue("zip_code", data.cep ?? "");
      if (!getValues("street")) setValue("street", data.logradouro ?? "");
      if (!getValues("neighborhood")) setValue("neighborhood", data.bairro ?? "");
      if (!getValues("city")) setValue("city", data.municipio ?? "");
      if (!getValues("state")) setValue("state", data.uf ?? "");

      toast.success("Dados do CNPJ preenchidos. Revise antes de salvar.");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        toast.error("Tempo limite da consulta excedido.");
      } else {
        toast.error("Não foi possível consultar o CNPJ. Prossiga com o cadastro manual.");
      }
    } finally {
      setCnpjLoading(false);
    }
  }, [getValues, setValue]);

  return (
    <form onSubmit={handleSubmit(async (data) => {
      setLoading(true);
      const result = await onSubmit(data);
      if (result?.error) {
        toast.error(result.error);
      }
      setLoading(false);
    })} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="cnpj">CNPJ</Label>
          <div className="flex gap-2">
            <Controller
              name="cnpj"
              control={control}
              render={({ field }) => (
                <PatternFormat
                  format="##.###.###/####-##"
                  mask="_"
                  customInput={Input}
                  id="cnpj"
                  value={field.value}
                  onValueChange={(values) => field.onChange(values.value)}
                  aria-invalid={!!errors.cnpj}
                />
              )}
            />
            <Button type="button" variant="outline" size="icon" onClick={lookupCnpj} disabled={cnpjLoading} aria-label="Consultar CNPJ">
              {cnpjLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
          {errors.cnpj && <p className="text-sm text-destructive mt-1">{errors.cnpj.message}</p>}
        </div>

        <div>
          <Label htmlFor="corporate_name">Razão Social</Label>
          <Input id="corporate_name" {...register("corporate_name")} aria-invalid={!!errors.corporate_name} />
          {errors.corporate_name && <p className="text-sm text-destructive mt-1">{errors.corporate_name.message}</p>}
        </div>

        <div>
          <Label htmlFor="trade_name">Nome Fantasia</Label>
          <Input id="trade_name" {...register("trade_name")} />
        </div>

        <div>
          <Label htmlFor="contact_name">Nome do Contato</Label>
          <Input id="contact_name" {...register("contact_name")} aria-invalid={!!errors.contact_name} />
          {errors.contact_name && <p className="text-sm text-destructive mt-1">{errors.contact_name.message}</p>}
        </div>

        <div>
          <Label htmlFor="contact_email">E-mail</Label>
          <Input id="contact_email" type="email" {...register("contact_email")} aria-invalid={!!errors.contact_email} />
          {errors.contact_email && <p className="text-sm text-destructive mt-1">{errors.contact_email.message}</p>}
        </div>

        <div>
          <Label htmlFor="contact_phone">Telefone</Label>
          <Controller
            name="contact_phone"
            control={control}
            render={({ field }) => (
              <PatternFormat
                format="(##) #####-####"
                mask="_"
                customInput={Input}
                id="contact_phone"
                value={field.value}
                onValueChange={(values) => field.onChange(values.value)}
                aria-invalid={!!errors.contact_phone}
              />
            )}
          />
          {errors.contact_phone && <p className="text-sm text-destructive mt-1">{errors.contact_phone.message}</p>}
        </div>

        <div>
          <Label htmlFor="zip_code">CEP</Label>
          <Controller
            name="zip_code"
            control={control}
            render={({ field }) => (
              <PatternFormat
                format="#####-###"
                mask="_"
                customInput={Input}
                id="zip_code"
                value={field.value ?? ""}
                onValueChange={(values) => field.onChange(values.value)}
              />
            )}
          />
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="street">Logradouro</Label>
          <Input id="street" {...register("street")} />
        </div>

        <div>
          <Label htmlFor="neighborhood">Bairro</Label>
          <Input id="neighborhood" {...register("neighborhood")} />
        </div>

        <div>
          <Label htmlFor="city">Cidade</Label>
          <Input id="city" {...register("city")} />
        </div>

        <div>
          <Label htmlFor="state">UF</Label>
          <Input id="state" maxLength={2} {...register("state")} />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {defaultValues ? "Atualizar" : "Cadastrar"}
        </Button>
      </div>
    </form>
  );
}
