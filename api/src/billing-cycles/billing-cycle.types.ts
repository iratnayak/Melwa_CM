export type BillingCycleStatus = 'draft' | 'open' | 'closed';

export type BillingCycleListItem = {
  id: number;
  cycleCode: string;
  startDate: string;
  endDate: string;
  dueDate: string;
  status: BillingCycleStatus;
  createdAt: string;
  updatedAt: string;
};
