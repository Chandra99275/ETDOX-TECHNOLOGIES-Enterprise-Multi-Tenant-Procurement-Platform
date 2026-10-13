import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import {
  create,
  get,
  list,
  listAttempts,
  listDeliveries,
  remove,
  replayDelivery,
  update,
} from './webhooks.controller';
import {
  createWebhookSchema,
  listDeliveriesSchema,
  listDeliveryAttemptsSchema,
  listWebhooksSchema,
  webhookDeliveryParamsSchema,
  webhookIdSchema,
  updateWebhookSchema,
} from './webhooks.schema';

export const router = Router();
router.use(authenticate);
router.use(requirePermission('webhooks:manage'));

router.get('/', validate(listWebhooksSchema, 'query'), list);
router.post('/', validate(createWebhookSchema), create);
router.get('/:id/deliveries', validate(webhookIdSchema, 'params'), validate(listDeliveriesSchema, 'query'), listDeliveries);
router.get(
  '/:id/deliveries/:deliveryId/attempts',
  validate(webhookDeliveryParamsSchema, 'params'),
  validate(listDeliveryAttemptsSchema, 'query'),
  listAttempts,
);
router.post('/:id/deliveries/:deliveryId/replay', validate(webhookDeliveryParamsSchema, 'params'), replayDelivery);
router.get('/:id', validate(webhookIdSchema, 'params'), get);
router.patch('/:id', validate(webhookIdSchema, 'params'), validate(updateWebhookSchema), update);
router.delete('/:id', validate(webhookIdSchema, 'params'), remove);
