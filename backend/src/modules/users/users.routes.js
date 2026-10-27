import { Router } from 'express';
import {
  listUsers,
  getUser,
  createUser,
  updateUser,
  deactivateUser,
} from './users.controller.js';

import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';

const router = Router();

// All user-management routes require authentication.
router.use(authenticate);

// Restrict user administration to authorized admin roles.
router.use(
  authorize('admin', 'organization_admin', 'organization admin')
);

router.get('/', listUsers);
router.get('/:id', getUser);
router.post('/', createUser);
router.patch('/:id', updateUser);
router.patch('/:id/deactivate', deactivateUser);

export default router;