import { RequestContext } from '../middleware/auth';

declare global {
  namespace Express {
    interface Request {
      context?: RequestContext;
      requestId?: string;
    }
  }
}

export {};
