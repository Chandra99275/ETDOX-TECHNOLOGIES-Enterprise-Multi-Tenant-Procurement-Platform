import { Router } from 'express';
import {
  listApprovals,
  getApproval,
  decideApproval,
} from './approvals.controller.js';

import { authenticate } from '../../middleware/authenticate.js';

const router = Router();

router.use(authenticate);

// View approval tasks
router.get('/', listApprovals);
router.get('/:id', getApproval);

// Record an approval decision
router.put('/:id', decideApproval);
router.patch('/:id/decision', decideApproval);

export default router;