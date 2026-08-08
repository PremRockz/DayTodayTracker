export interface LoanInterestBreakdown {
  tenureMonths: number;
  monthlyInterest: number;
  totalInterest: number;
  totalPayable: number;
}

export const monthsBetweenDates = (from: Date, to: Date): number => {
  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) months -= 1;
  return Math.max(0, months);
};

export const daysBetweenDates = (from: Date, to: Date): number => {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / msPerDay));
};

// Simple interest, annualized: monthly interest = principal x rate% / 12, applied across the tenure.
export const computeLoanInterestBreakdown = (
  loanAmount: string,
  interestRate: string,
  disbursedDate: Date | null,
  dueDate: Date | null
): LoanInterestBreakdown => {
  const principal = parseFloat(loanAmount) || 0;
  const rate = parseFloat(interestRate) || 0;
  const tenureMonths = disbursedDate && dueDate ? monthsBetweenDates(disbursedDate, dueDate) : 0;
  const monthlyInterest = principal * (rate / 100) / 12;
  const totalInterest = monthlyInterest * tenureMonths;
  return {
    tenureMonths,
    monthlyInterest,
    totalInterest,
    totalPayable: principal + totalInterest,
  };
};
