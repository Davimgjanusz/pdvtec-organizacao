"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
}

interface OptionSelectProps {
  id?: string;
  value: string | null | undefined;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  "aria-invalid"?: boolean;
  "aria-label"?: string;
}

/**
 * Select com rótulos traduzidos: o Base UI exibe o valor bruto no gatilho
 * a menos que receba `items`, então os rótulos são sempre repassados aqui.
 */
export function OptionSelect({
  id,
  value,
  onValueChange,
  options,
  placeholder = "Selecione",
  className,
  disabled,
  ...aria
}: OptionSelectProps) {
  const items = Object.fromEntries(options.map((o) => [o.value, o.label]));

  return (
    <Select
      items={items}
      value={value ?? null}
      onValueChange={(v) => {
        if (v !== null && v !== undefined) onValueChange(v as string);
      }}
      disabled={disabled}
    >
      <SelectTrigger id={id} className={cn("w-full", className)} {...aria}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
