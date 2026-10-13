import { z } from 'zod';

const storageKey = z.string().min(1).max(1024).regex(/^[A-Za-z0-9._/-]+$/)
  .refine(value => !value.split('/').includes('..') && !value.startsWith('/'), 'Invalid storage key');

const metadata = z.object({
  fileName: z.string().trim().min(1).max(255),
  storageKey,
  contentType: z.string().trim().max(160).regex(/^[\w.+-]+\/[\w.+-]+$/).optional(),
  byteSize: z.number().int().min(0).max(50 * 1024 * 1024).optional(),
}).strict();

export const attachmentParamsSchema = z.object({ id: z.string().uuid() }).strict();
export const attachmentIdParamsSchema = z.object({ id: z.string().uuid(), attachmentId: z.string().uuid() }).strict();
export const createRequestAttachmentSchema = metadata;
export const createSupplierDocumentSchema = metadata.extend({
  documentType: z.string().trim().min(1).max(80),
  expiresOn: z.string().date().optional(),
}).strict();
