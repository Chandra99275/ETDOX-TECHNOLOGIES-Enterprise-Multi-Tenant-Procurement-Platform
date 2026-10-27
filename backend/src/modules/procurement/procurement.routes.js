import { Router } from 'express';
import {
  listRequests,
  getRequest,
  createRequest,
  updateRequest,
  submitRequest,
  financeDecision,
} from './procurement.controller.js';

import { authenticate } from '../../middleware/authenticate.js';

const router = Router();

router.use(authenticate);

// Purchase requests
router.get('/requests', listRequests);
router.get('/requests/:id', getRequest);
router.post('/requests', createRequest);
router.patch('/requests/:id', updateRequest);
router.post('/requests/:id/submit', submitRequest);

// Preserve the endpoint used by the ETDOX Finance dashboard.
router.patch('/requests/:id/finance-decision', financeDecision);

export default router;