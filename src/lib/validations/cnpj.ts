export function normalizeCnpj(cnpj: string): string {
  return cnpj.replace(/\D/g, "");
}

export function formatCnpj(cnpj: string): string {
  const digits = normalizeCnpj(cnpj);
  return digits.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    "$1.$2.$3/$4-$5"
  );
}

export function validateCnpj(cnpj: string): boolean {
  const digits = normalizeCnpj(cnpj);

  if (digits.length !== 14) return false;
  if (/^(\d)\1+$/.test(digits)) return false;

  const calc = (slice: string, weights: number[]): number => {
    const sum = slice
      .split("")
      .reduce((acc, digit, i) => acc + parseInt(digit, 10) * weights[i], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const d1 = calc(digits.slice(0, 12), w1);
  const d2 = calc(digits.slice(0, 13), w2);

  return parseInt(digits[12], 10) === d1 && parseInt(digits[13], 10) === d2;
}
