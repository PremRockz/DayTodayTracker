// Indian digit grouping (lakh/crore style): 1,00,000 instead of 100,000.
export const formatIndianNumber = (
  value: number | string,
  options?: { minimumFractionDigits?: number; maximumFractionDigits?: number }
): string => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (Number.isNaN(num)) return '0';
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: options?.minimumFractionDigits ?? 0,
    maximumFractionDigits: options?.maximumFractionDigits ?? 0,
  });
};

// Formats a raw amount string with Indian digit grouping as the user types it into a TextInput.
export const formatAmountInput = (raw: string): string => {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  const dotIndex = cleaned.indexOf('.');
  const integerPart = dotIndex === -1 ? cleaned : cleaned.slice(0, dotIndex);
  const decimalPart = dotIndex === -1 ? '' : '.' + cleaned.slice(dotIndex + 1).replace(/\./g, '');
  const groupedInteger = integerPart ? Number(integerPart).toLocaleString('en-IN') : '';
  return groupedInteger + decimalPart;
};

// Undoes formatAmountInput's grouping so the raw value can go back into numeric state.
export const stripAmountFormatting = (formatted: string): string => formatted.replace(/,/g, '');
