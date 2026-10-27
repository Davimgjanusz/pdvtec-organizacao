"use client";

import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "@/lib/notify";

import {
  boardSchema,
  wipLimitsSchema,
  type BoardFormData,
  type WipLimitsFormData,
} from "@/lib/validations/schemas";
import { updateWipLimitsAction } from "@/services/boards";
import type { KanbanColumn } from "@/types/database";
import { FieldError, IntegerInput } from "@/components/forms/masked-inputs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface BoardFormProps {
  defaultValues?: BoardFormData;
  onSubmit: (data: BoardFormData) => Promise<{ error?: string }>;
  onCancel: () => void;
}

export function BoardForm({ defaultValues, onSubmit, onCancel }: BoardFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<BoardFormData>({
    resolver: zodResolver(boardSchema),
    defaultValues: defaultValues ?? { title: "", description: "" },
  });

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={handleSubmit(async (data) => {
        const result = await onSubmit(data);
        if (result.error) toast.error(result.error);
      })}
    >
      <div>
        <Label htmlFor="board-title">Título</Label>
        <Input
          id="board-title"
          placeholder="Ex.: Implantações, Suporte, Comercial"
          {...register("title")}
          aria-invalid={!!errors.title}
        />
        <FieldError message={errors.title?.message} />
      </div>
      <div>
        <Label htmlFor="board-desc">Descrição (opcional)</Label>
        <Textarea
          id="board-desc"
          rows={2}
          placeholder="Descreva o propósito deste quadro"
          {...register("description")}
          aria-invalid={!!errors.description}
        />
        <FieldError message={errors.description?.message} />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {defaultValues ? "Salvar" : "Criar Quadro"}
        </Button>
      </div>
    </form>
  );
}

interface WipLimitsFormProps {
  columns: KanbanColumn[];
  counts: Record<string, number>;
  onSaved: () => void;
  onCancel: () => void;
}

export function WipLimitsForm({ columns, counts, onSaved, onCancel }: WipLimitsFormProps) {
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<WipLimitsFormData>({
    resolver: zodResolver(wipLimitsSchema),
    defaultValues: {
      columns: columns.map((c) => ({ id: c.id, title: c.title, wip_limit: c.wip_limit })),
    },
  });
  const { fields } = useFieldArray({ control, name: "columns" });

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={handleSubmit(async (data) => {
        const result = await updateWipLimitsAction(data);
        if (result.error) {
          toast.error(result.error);
          return;
        }
        toast.success("Limites WIP salvos!");
        onSaved();
      })}
    >
      <p className="text-sm text-muted-foreground">
        Defina o número máximo de cartões por coluna. Deixe em branco para não limitar.
      </p>
      {fields.map((field, index) => {
        const slug = columns[index]?.slug;
        return (
          <div key={field.id}>
            <div className="flex items-center gap-3">
              <Label htmlFor={`wip-${field.id}`} className="flex-1">
                {field.title}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {counts[slug] ?? 0} cartão(ões) agora
                </span>
              </Label>
              <Controller
                name={`columns.${index}.wip_limit`}
                control={control}
                render={({ field: f }) => (
                  <IntegerInput
                    id={`wip-${field.id}`}
                    className="w-28"
                    placeholder="Sem limite"
                    name={f.name}
                    getInputRef={f.ref}
                    value={f.value}
                    onValueChange={f.onChange}
                    onBlur={f.onBlur}
                    aria-invalid={!!errors.columns?.[index]?.wip_limit}
                  />
                )}
              />
            </div>
            <FieldError message={errors.columns?.[index]?.wip_limit?.message} />
          </div>
        );
      })}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar Limites
        </Button>
      </div>
    </form>
  );
}
