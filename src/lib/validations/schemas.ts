import { z } from "zod";
import { validateCnpj } from "./cnpj";

// Mensagens padrão do Zod em português (usadas quando o schema não define uma própria)
z.setErrorMap((issue, ctx) => {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      if (issue.received === "undefined" || issue.received === "null") return { message: "Campo obrigatório" };
      return { message: "Valor inválido" };
    case z.ZodIssueCode.invalid_string:
      if (issue.validation === "email") return { message: "E-mail inválido" };
      if (issue.validation === "uuid") return { message: "Seleção inválida" };
      return { message: "Formato inválido" };
    case z.ZodIssueCode.too_small:
      return issue.type === "string"
        ? { message: `Deve ter no mínimo ${issue.minimum} caractere(s)` }
        : { message: `Deve ser no mínimo ${issue.minimum}` };
    case z.ZodIssueCode.too_big:
      return issue.type === "string"
        ? { message: `Deve ter no máximo ${issue.maximum} caractere(s)` }
        : { message: `Deve ser no máximo ${issue.maximum}` };
    case z.ZodIssueCode.invalid_enum_value:
      return { message: "Opção inválida" };
    case z.ZodIssueCode.invalid_date:
      return { message: "Data inválida" };
    default:
      return { message: ctx.defaultError };
  }
});

const digits = (val: string) => val.replace(/\D/g, "");

// =============================================
// Argumentos de Server Actions (validados no servidor, nunca confiar no cliente)
// =============================================
export const recordIdSchema = z.string().uuid("Identificador inválido");

export const proposalStatusSchema = z.enum(["draft", "sent", "approved", "rejected", "cancelled"]);

export const proposalStatusChangeSchema = z.object({
  id: recordIdSchema,
  status: proposalStatusSchema,
  reason: z.string().trim().max(1000, "Motivo muito longo").optional(),
});

export const contractStatusSchema = z.enum(["active", "pending_renewal", "expired", "cancelled"]);

export const contractStatusChangeSchema = z.object({
  id: recordIdSchema,
  status: contractStatusSchema,
});

/** Caminho relativo dentro do bucket privado (sem "..", barra inicial ou esquema de URL) */
export const storagePathSchema = z
  .string()
  .trim()
  .min(1, "Documento não informado")
  .max(500)
  .refine((path) => !path.startsWith("/") && !path.split("/").includes("..") && !/^[a-z]+:/i.test(path), {
    message: "Caminho de documento inválido",
  });

export const clientSchema = z.object({
  corporate_name: z.string().min(1, "Razão social é obrigatória").max(300),
  trade_name: z.string().max(300).nullable().optional(),
  cnpj: z
    .string()
    .min(1, "CNPJ é obrigatório")
    .refine((val) => validateCnpj(val), { message: "CNPJ inválido" }),
  contact_name: z.string().min(1, "Nome do contato é obrigatório").max(200),
  contact_email: z.string().min(1, "E-mail é obrigatório").email("E-mail inválido"),
  contact_phone: z
    .string()
    .min(1, "Telefone é obrigatório")
    .refine((val) => [10, 11].includes(digits(val).length), { message: "Telefone deve ter DDD + 8 ou 9 dígitos" }),
  zip_code: z
    .string()
    .nullable()
    .optional()
    .refine((val) => !val || digits(val).length === 8, { message: "CEP deve ter 8 dígitos" }),
  street: z.string().max(300).nullable().optional(),
  neighborhood: z.string().max(200).nullable().optional(),
  city: z.string().max(200).nullable().optional(),
  state: z
    .string()
    .nullable()
    .optional()
    .refine((val) => !val || /^[A-Za-z]{2}$/.test(val), { message: "UF deve ter 2 letras" }),
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

export const contractBaseSchema = z.object({
  client_id: z.string().uuid("Selecione um cliente"),
  proposal_id: z.string().uuid().nullable().optional(),
  start_date: z.string().min(1, "Data de início é obrigatória"),
  end_date: z.string().min(1, "Data de término é obrigatória"),
  monthly_amount: z.number({ invalid_type_error: "Informe o valor mensal" }).min(0, "Valor não pode ser negativo"),
});

const contractDatesRefinement = (data: { start_date: string; end_date: string }) =>
  !data.start_date || !data.end_date || data.end_date >= data.start_date;

const contractDatesError = {
  message: "Data de término deve ser posterior à data de início",
  path: ["end_date"],
};

export const contractSchema = contractBaseSchema.refine(contractDatesRefinement, contractDatesError);

export type ContractFormData = z.infer<typeof contractSchema>;

// Versão do formulário (cliente) que inclui o arquivo PDF obrigatório
export const contractFormSchema = contractBaseSchema
  .extend({
    document: z
      .custom<File>((val) => typeof File !== "undefined" && val instanceof File, {
        message: "Selecione o arquivo PDF do contrato",
      })
      .refine((file) => file.size <= 15 * 1024 * 1024, { message: "Arquivo excede o limite de 15 MB" })
      .refine((file) => file.type === "application/pdf", { message: "Apenas arquivos PDF são permitidos" }),
  })
  .refine(contractDatesRefinement, contractDatesError);

export type ContractFormInput = z.infer<typeof contractFormSchema>;

export const TASK_COLOR_TAGS = ["default", "blue", "green", "yellow", "orange", "red", "purple", "pink"] as const;

export const taskColorTagSchema = z.enum(TASK_COLOR_TAGS);

export const taskSchema = z.object({
  contract_id: z.string().uuid().nullable().optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  title: z.string().min(1, "Título é obrigatório").max(300),
  description: z.string().max(2000).nullable().optional(),
  column_status: z.enum(["todo", "in_progress", "review", "done"]),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  color_tag: taskColorTagSchema,
  due_date: z.string().nullable().optional(),
});

export type TaskFormData = z.infer<typeof taskSchema>;

export const loginSchema = z.object({
  email: z.string().min(1, "E-mail é obrigatório").email("E-mail inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
});

export type LoginFormData = z.infer<typeof loginSchema>;

// =============================================
// Usuários (administração)
// =============================================
export const userRoleSchema = z.enum(["admin", "comercial", "operacional"], {
  required_error: "Cargo é obrigatório",
  invalid_type_error: "Cargo inválido",
});

export const createUserSchema = z.object({
  full_name: z.string().trim().min(3, "Informe o nome completo").max(200, "Nome muito longo"),
  email: z.string().trim().toLowerCase().min(1, "E-mail é obrigatório").email("E-mail inválido"),
  password: z
    .string()
    .min(8, "A senha provisória deve ter no mínimo 8 caracteres")
    .max(72, "A senha provisória deve ter no máximo 72 caracteres")
    .regex(/[A-Za-z]/, "A senha deve conter ao menos uma letra")
    .regex(/\d/, "A senha deve conter ao menos um número"),
  role: userRoleSchema,
});

export type CreateUserFormData = z.infer<typeof createUserSchema>;

export const updateUserRoleSchema = z.object({
  role: userRoleSchema,
});

export type UpdateUserRoleFormData = z.infer<typeof updateUserRoleSchema>;

// =============================================
// Kanban
// =============================================
export const boardSchema = z.object({
  title: z.string().trim().min(1, "Título do quadro é obrigatório").max(200, "Título muito longo"),
  description: z.string().trim().max(1000, "Descrição muito longa").nullable().optional(),
});

export type BoardFormData = z.infer<typeof boardSchema>;

export const wipLimitsSchema = z.object({
  columns: z.array(
    z.object({
      id: z.string().uuid(),
      title: z.string(),
      wip_limit: z
        .number({ invalid_type_error: "Informe um número" })
        .int("Use um número inteiro")
        .min(1, "O limite deve ser no mínimo 1")
        .max(999, "Limite muito alto")
        .nullable(),
    })
  ),
});

export type WipLimitsFormData = z.infer<typeof wipLimitsSchema>;

export const taskMoveSchema = z.object({
  id: z.string().uuid(),
  column_status: z.enum(["todo", "in_progress", "review", "done"]),
  position: z.number().int().min(0),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  contract_id: z.string().uuid().nullable().optional(),
});

export const taskMovesSchema = z.object({
  board_id: z.string().uuid().nullable(),
  moved_task_id: z.string().uuid(),
  changes: z.array(taskMoveSchema).min(1).max(500),
});

export type TaskMove = z.infer<typeof taskMoveSchema>;
export type TaskMovesPayload = z.infer<typeof taskMovesSchema>;

// =============================================
// Conciliação Financeira
// =============================================
export const SPREADSHEET_EXTENSIONS = [".xlsx", ".xls", ".csv"] as const;
const MAX_SPREADSHEET_BYTES = 10 * 1024 * 1024;

const referenceMonthSchema = z
  .string()
  .min(1, "Informe o mês de referência")
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mês de referência inválido");

const partnerNameSchema = z.string().trim().min(2, "Informe o parceiro").max(200, "Nome muito longo");

export const reconciliationFormSchema = z.object({
  partner_name: partnerNameSchema,
  reference_month: referenceMonthSchema,
  file: z
    .custom<File>((val) => typeof File !== "undefined" && val instanceof File, {
      message: "Selecione a planilha do parceiro",
    })
    .refine((file) => SPREADSHEET_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext)), {
      message: "Formato não suportado. Use .xlsx, .xls ou .csv",
    })
    .refine((file) => file.size <= MAX_SPREADSHEET_BYTES, { message: "Arquivo excede o limite de 10 MB" }),
  client_column: z.string().min(1, "Selecione a coluna do cliente"),
  amount_column: z.string().min(1, "Selecione a coluna do valor"),
  cnpj_column: z.string().nullable(),
});

export type ReconciliationFormData = z.infer<typeof reconciliationFormSchema>;

export const reconciliationPayloadSchema = z.object({
  partner_name: partnerNameSchema,
  reference_month: referenceMonthSchema,
  rows: z
    .array(
      z.object({
        client_name: z.string().trim().min(1).max(300),
        cnpj: z.string().max(30).nullable().optional(),
        amount: z.number().finite(),
      })
    )
    .min(1, "A planilha não tem linhas com cliente e valor")
    .max(5000, "A planilha excede o limite de 5.000 linhas"),
});

export type ReconciliationPayload = z.infer<typeof reconciliationPayloadSchema>;

export const reconciliationKeySchema = z.object({
  partner_name: partnerNameSchema,
  reference_month: referenceMonthSchema,
});
