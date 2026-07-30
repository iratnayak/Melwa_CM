export type BalanceListItem = {
  id: number;
  employeeId: number;
  billingCycleId: number;
  openingBalance: string;
  totalCredit: string;
  totalPaid: string;
  closingBalance: string;
  carriedForwardBalance: string;
  advanceBalance: string;
  isOverdue: boolean;
  calculatedAt: string;
  employee: {
    id: number;
    employeeCode: string;
    fullName: string;
  };
  billingCycle: {
    id: number;
    cycleCode: string;
    startDate: string;
    dueDate: string;
    status: string;
  };
};

