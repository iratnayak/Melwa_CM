export type PaymentStatus =
  | 'recorded'
  | 'allocated'
  | 'partially_allocated'
  | 'reversed';

export type PaymentListItem = {
  id: number;
  employeeId: number;
  billingCycleId: number | null;
  /** Cycle that received overpayment as advance (set on allocate); used on reverse. */
  advanceAppliedBillingCycleId: number | null;
  receivedByUserId: number;
  paymentDate: string;
  amount: string;
  method: string;
  referenceNo: string | null;
  status: PaymentStatus;
  allocatedAmount: string;
  allocatedAt: string | null;
  reversedAt: string | null;
  reversalReason: string | null;
  createdAt: string;
  updatedAt: string;
  employee: {
    id: number;
    employeeCode: string;
    fullName: string;
  };
  billingCycle: {
    id: number;
    cycleCode: string;
    status: string;
  } | null;
  receivedByUser: {
    id: number;
    name: string;
    email: string;
  };
};

export type PaymentAllocationItem = {
  id: number;
  paymentId: number;
  employeeId: number;
  billingCycleId: number;
  allocatedAmount: string;
  createdAt: string;
  billingCycle: {
    id: number;
    cycleCode: string;
    status: string;
  };
};
