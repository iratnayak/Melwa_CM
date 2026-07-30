export type CreditTransactionType = 'purchase' | 'adjustment' | 'reversal';

export type CreditTransactionListItem = {
  id: number;
  employeeId: number;
  billingCycleId: number;
  enteredByUserId: number;
  txnDate: string;
  description: string | null;
  amount: string;
  transactionType: CreditTransactionType;
  createdAt: string;
  employee: {
    id: number;
    employeeCode: string;
    fullName: string;
  };
  billingCycle: {
    id: number;
    cycleCode: string;
    status: string;
  };
  enteredByUser: {
    id: number;
    name: string;
    email: string;
  };
};
