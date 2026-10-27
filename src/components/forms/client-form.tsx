"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { clientSchema, type ClientFormData } from "@/lib/validations/schemas";
import { validateCnpj } from "@/lib/validations/cnpj";
import { CepInput, CnpjInput, FieldError, PhoneInput } from "./masked-inputs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Search } from "lucide-react";
import { useState, useCallback } from "react";
import { toast } from "@/lib/notify";
import type { Client } from "@/types/database";

interface ClientFormProps {
  defaultValues?: Client;
  onSubmit: (data: ClientFormData) => Promise<{ error?: string }>;
  onCancel: () => void;
}

interface BrasilApiCnpj {
  razao_social?: string;
  nome_fantasia?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  ddd_telefone_1?: string;
  email?: string | null;
}

export function ClientForm({ defaultValues, onSubmit, onCancel }: ClientFormProps) {
  const [cnpjLoading, setCnpjLoading] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
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
      : {
          corporate_name: "",
          trade_name: "",
          cnpj: "",
          contact_name: "",
          contact_email: "",
          contact_phone: "",
          zip_code: "",
          street: "",
          neighborhood: "",
          city: "",
          state: "",
        },
  });

  const lookupCnpj = useCallback(async () => {
    const rawCnpj = getValues("cnpj")?.replace(/\D/g, "");
    if (!rawCnpj || rawCnpj.length !== 14) {
      toast.error("Digite os 14 dígitos do CNPJ.");
      return;
    }
    if (!validateCnpj(rawCnpj)) {
      toast.error("CNPJ inválido. Verifique os dígitos verificadores.");
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
          toast.warning("CNPJ não encontrado na base da Receita Federal.");
        } else {
          toast.error("Erro ao consultar CNPJ. Tente novamente.");
        }
        return;
      }

      const data: BrasilApiCnpj = await res.json();

      // Preenche somente campos vazios, preservando o que o usuário já digitou
      const fillIfEmpty = (field: keyof ClientFormData, value: string | null | undefined) => {
        if (value && !getValues(field)) setValue(field, value, { shouldValidate: true, shouldDirty: true });
      };

      fillIfEmpty("corporate_name", data.razao_social);
      fillIfEmpty("trade_name", data.nome_fantasia);
      fillIfEmpty("zip_code", data.cep?.replace(/\D/g, ""));
      fillIfEmpty("street", [data.logradouro, data.numero].filter(Boolean).join(", "));
      fillIfEmpty("neighborhood", data.bairro);
      fillIfEmpty("city", data.municipio);
      fillIfEmpty("state", data.uf);
      fillIfEmpty("contact_phone", data.ddd_telefone_1?.replace(/\D/g, ""));
      fillIfEmpty("contact_email", data.email?.toLowerCase());

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
    <form
      noValidate
      onSubmit={handleSubmit(async (data) => {
        const result = await onSubmit(data);
        if (result?.error) toast.error(result.error);
      })}
      className="space-y-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="cnpj">CNPJ</Label>
          <div className="flex gap-2">
            <Controller
              name="cnpj"
              control={control}
              render={({ field }) => (
                <CnpjInput
                  id="cnpj"
                  name={field.name}
                  getInputRef={field.ref}
                  value={field.value}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                  aria-invalid={!!errors.cnpj}
                />
              )}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={lookupCnpj}
              disabled={cnpjLoading}
              aria-label="Consultar CNPJ na BrasilAPI"
              title="Consultar CNPJ na BrasilAPI"
            >
              {cnpjLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
          <FieldError message={errors.cnpj?.message} />
        </div>

        <div>
          <Label htmlFor="corporate_name">Razão Social</Label>
          <Input id="corporate_name" {...register("corporate_name")} aria-invalid={!!errors.corporate_name} />
          <FieldError message={errors.corporate_name?.message} />
        </div>

        <div>
          <Label htmlFor="trade_name">Nome Fantasia</Label>
          <Input id="trade_name" {...register("trade_name")} />
          <FieldError message={errors.trade_name?.message} />
        </div>

        <div>
          <Label htmlFor="contact_name">Nome do Contato</Label>
          <Input id="contact_name" {...register("contact_name")} aria-invalid={!!errors.contact_name} />
          <FieldError message={errors.contact_name?.message} />
        </div>

        <div>
          <Label htmlFor="contact_email">E-mail</Label>
          <Input id="contact_email" type="email" {...register("contact_email")} aria-invalid={!!errors.contact_email} />
          <FieldError message={errors.contact_email?.message} />
        </div>

        <div>
          <Label htmlFor="contact_phone">Telefone</Label>
          <Controller
            name="contact_phone"
            control={control}
            render={({ field }) => (
              <PhoneInput
                id="contact_phone"
                name={field.name}
                getInputRef={field.ref}
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                aria-invalid={!!errors.contact_phone}
              />
            )}
          />
          <FieldError message={errors.contact_phone?.message} />
        </div>

        <div>
          <Label htmlFor="zip_code">CEP</Label>
          <Controller
            name="zip_code"
            control={control}
            render={({ field }) => (
              <CepInput
                id="zip_code"
                name={field.name}
                getInputRef={field.ref}
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                aria-invalid={!!errors.zip_code}
              />
            )}
          />
          <FieldError message={errors.zip_code?.message} />
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="street">Logradouro</Label>
          <Input id="street" {...register("street")} />
          <FieldError message={errors.street?.message} />
        </div>

        <div>
          <Label htmlFor="neighborhood">Bairro</Label>
          <Input id="neighborhood" {...register("neighborhood")} />
          <FieldError message={errors.neighborhood?.message} />
        </div>

        <div>
          <Label htmlFor="city">Cidade</Label>
          <Input id="city" {...register("city")} />
          <FieldError message={errors.city?.message} />
        </div>

        <div>
          <Label htmlFor="state">UF</Label>
          <Input
            id="state"
            maxLength={2}
            className="uppercase"
            {...register("state", { setValueAs: (v: string | null) => v?.toUpperCase() ?? v })}
            aria-invalid={!!errors.state}
          />
          <FieldError message={errors.state?.message} />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {defaultValues ? "Atualizar" : "Cadastrar"}
        </Button>
      </div>
    </form>
  );
}
