export interface RequestContext {
  tenantId: string;
}

export interface AuditSearchOptions {
  action?: string;
  resourceType?: string;
  resourceId?: string;
  actorId?: string;
  from?: string;
  to?: string;
  limit: number;
  offset: number;
}
