export interface RequestContext {
  tenantId: string;
  userId: string;
}

export interface BudgetListOptions {
  fiscalYear?: number;
  departmentId?: string;
  costCenterId?: string;
  limit: number;
  offset: number;
}
