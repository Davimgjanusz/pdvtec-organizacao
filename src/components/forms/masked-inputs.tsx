"use client";

import { NumericFormat, PatternFormat, type NumericFormatProps, type PatternFormatProps } from "react-number-format";
import { Input } from "@/components/ui/input";

type PatternInputProps = Omit<PatternFormatProps, "format" | "customInput" | "value" | "onValueChange"> & {
  value: string | null | undefined;
  /** Recebe apenas os dígitos digitados */
  onValueChange: (digits: string) => void;
};

export function CnpjInput({ value, onValueChange, ...props }: PatternInputProps) {
  return (
    <PatternFormat
      {...props}
      format="##.###.###/####-##"
      mask="_"
      placeholder="00.000.000/0000-00"
      inputMode="numeric"
      customInput={Input}
      value={value ?? ""}
      onValueChange={(values) => onValueChange(values.value)}
    />
  );
}

export function CepInput({ value, onValueChange, ...props }: PatternInputProps) {
  return (
    <PatternFormat
      {...props}
      format="#####-###"
      mask="_"
      placeholder="00000-000"
      inputMode="numeric"
      customInput={Input}
      value={value ?? ""}
      onValueChange={(values) => onValueChange(values.value)}
    />
  );
}

/** Telefone fixo (10 dígitos) ou celular (11 dígitos), alternando a máscara automaticamente. */
export function PhoneInput({ value, onValueChange, ...props }: PatternInputProps) {
  const digits = (value ?? "").replace(/\D/g, "");
  const format = digits.length > 10 ? "(##) #####-####" : "(##) ####-#####";

  return (
    <PatternFormat
      {...props}
      format={format}
      placeholder="(00) 00000-0000"
      inputMode="tel"
      customInput={Input}
      value={digits}
      onValueChange={(values) => onValueChange(values.value)}
    />
  );
}

type NumberInputProps = Omit<NumericFormatProps, "customInput" | "value" | "onValueChange"> & {
  value: number | null | undefined;
  onValueChange: (value: number | null) => void;
};

/** Valor monetário no padrão R$ 0,00 */
export function CurrencyInput({ value, onValueChange, ...props }: NumberInputProps) {
  return (
    <NumericFormat
      {...props}
      customInput={Input}
      thousandSeparator="."
      decimalSeparator=","
      decimalScale={2}
      fixedDecimalScale
      allowNegative={false}
      prefix="R$ "
      placeholder="R$ 0,00"
      inputMode="decimal"
      value={value ?? ""}
      onValueChange={(values) => onValueChange(values.floatValue ?? 0)}
    />
  );
}

/** Inteiro positivo opcional (vazio = null) */
export function IntegerInput({ value, onValueChange, ...props }: NumberInputProps) {
  return (
    <NumericFormat
      {...props}
      customInput={Input}
      decimalScale={0}
      allowNegative={false}
      thousandSeparator="."
      decimalSeparator=","
      inputMode="numeric"
      value={value ?? ""}
      onValueChange={(values) => onValueChange(values.floatValue ?? null)}
    />
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1 text-sm text-destructive" role="alert">
      {message}
    </p>
  );
}
