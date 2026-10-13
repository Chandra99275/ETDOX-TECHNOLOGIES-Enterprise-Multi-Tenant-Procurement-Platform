import { RequestContext } from '../../middleware/auth';

export type WebhookContext = Pick<RequestContext, 'tenantId' | 'userId'>;

export interface PageOptions {
  limit: number;
  offset: number;
}

export type WebhookStatus = 'ACTIVE' | 'PAUSED' | 'DISABLED';
export type DeliveryStatus = 'PENDING' | 'DELIVERED' | 'FAILED' | 'ABANDONED';
