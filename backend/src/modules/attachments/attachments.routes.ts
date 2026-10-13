import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireAnyPermission, requirePermission } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import {
  addRequestFile,
  addSupplierFile,
  listRequestFiles,
  listSupplierFiles,
  removeRequestFile,
  removeSupplierFile,
} from './attachments.controller';
import {
  attachmentIdParamsSchema,
  attachmentParamsSchema,
  createRequestAttachmentSchema,
  createSupplierDocumentSchema,
} from './attachments.schema';

export const router = Router();
router.get('/purchase-requests/:id/attachments', authenticate, requireAnyPermission('attachments:read', 'purchase_requests:read'), validate(attachmentParamsSchema, 'params'), listRequestFiles);
router.post('/purchase-requests/:id/attachments', authenticate, requireAnyPermission('attachments:manage', 'purchase_requests:create'), validate(attachmentParamsSchema, 'params'), validate(createRequestAttachmentSchema), addRequestFile);
router.delete('/purchase-requests/:id/attachments/:attachmentId', authenticate, requireAnyPermission('attachments:manage', 'purchase_requests:create'), validate(attachmentIdParamsSchema, 'params'), removeRequestFile);
router.get('/suppliers/:id/documents', authenticate, requireAnyPermission('attachments:read', 'suppliers:read'), validate(attachmentParamsSchema, 'params'), listSupplierFiles);
router.post('/suppliers/:id/documents', authenticate, requireAnyPermission('attachments:manage', 'suppliers:manage'), validate(attachmentParamsSchema, 'params'), validate(createSupplierDocumentSchema), addSupplierFile);
router.delete('/suppliers/:id/documents/:documentId', authenticate, requireAnyPermission('attachments:manage', 'suppliers:manage'), validate(attachmentParamsSchema.extend({ documentId: attachmentParamsSchema.shape.id }), 'params'), removeSupplierFile);
