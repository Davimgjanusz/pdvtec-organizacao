import { z } from "zod";
import { validateCnpj } from "./cnpj";

export const clientSchema = z.object({
  corporate_name: z.string().min(1, "Razão social é obrigatória").max(300),
  trade_name: z.string().max(300).nullable().optional(),
  cnpj: z
    .string()
    .min(1, "CNPJ é obrigatório")
    .refine((val) => validateCnpj(val), { message: "CNPJ inválido" }),
  contact_name: z.string().min(1, "Nome do contato é obrigatório").max(200),
  contact_email: z.string().min(1, "E-mail é obrigatório").email("E-mail inválido"),
  contact_phone: z.string().min(1, "Telefone é obrigatório").max(20),
  zip_code: z.string().max(10).nullable().optional(),
  street: z.string().max(300).nullable().optional(),
  neighborhood: z.string().max(200).nullable().optional(),
  city: z.string().max(200).nullable().optional(),
  state: z.string().max(2).nullable().optional(),
});

export type ClientFormData = z.infer<typeof clientSchema>;

export const proposalSchema = z
  .object({
    client_id: z.string().uuid("Selecione um cliente"),
    title: z.string().min(1, "Título é obrigatório").max(300),
    billing_type: z.enum(["one_off", "recurring", "hybrid"], {
      required_error: "Tipo de cobrança é obrigatório",
    }),
    setup_value: z.number().min(0, "Valor não pode ser negativo"),
    recurring_value: z.number().min(0, "Valor não pode ser negativo"),
    valid_until: z.string().min(1, "Data de validade é obrigatória"),
    scope_description: z.string().min(1, "Descrição do escopo é obrigatória"),
    notes: z.string().nullable().optional(),
  })
  .refine(
    (data) => {
      if (data.billing_type === "one_off") return data.setup_value > 0;
      if (data.billing_type === "recurring") return data.recurring_value > 0;
      return data.setup_value > 0 || data.recurring_value > 0;
    },
    { message: "Informe ao menos um valor de acordo com o tipo de cobrança", path: ["setup_value"] }
  );

export type ProposalFormData = z.infer<typeof proposalSchema>;

export const contractSchema = z
  .object({
    client_id: z.string().uuid("Selecione um cliente"),
    proposal_id: z.string().uuid().nullable().optional(),
    start_date: z.string().min(1, "Data de início é obrigatória"),
    end_date: z.string().min(1, "Data de término é obrigatória"),
    monthly_amount: z.number().min(0, "Valor não pode ser negativo"),
  })
  .refine((data) => data.end_date >= data.start_date, {
    message: "Data de término deve ser posterior à data de início",
    path: ["end_date"],
  });

export type ContractFormData = z.infer<typeof contractSchema>;

export const taskSchema = z.object({
  contract_id: z.string().uuid().nullable().optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  title: z.string().min(1, "Título é obrigatório").max(300),
  description: z.string().max(2000).nullable().optional(),
  column_status: z.enum(["todo", "in_progress", "review", "done"]),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  due_date: z.string().nullable().optional(),
});

export type TaskFormData = z.infer<typeof taskSchema>;

export const loginSchema = z.object({
  email: z.string().min(1, "E-mail é obrigatório").email("E-mail inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
});

export type LoginFormData = z.infer<typeof loginSchema>;
