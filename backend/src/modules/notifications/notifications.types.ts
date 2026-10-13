import { RequestContext } from '../../middleware/auth';

export type NotificationContext = Pick<RequestContext, 'tenantId' | 'userId'>;

export interface NotificationPageOptions {
  limit: number;
  offset: number;
  unreadOnly?: boolean;
}
