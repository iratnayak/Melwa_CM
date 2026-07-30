export type EmployeeDepartmentSummary = {
  id: number;
  code: string;
  name: string;
};

export type EmployeeListItem = {
  id: number;
  employeeCode: string;
  fullName: string;
  departmentId: number;
  department: EmployeeDepartmentSummary;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};
