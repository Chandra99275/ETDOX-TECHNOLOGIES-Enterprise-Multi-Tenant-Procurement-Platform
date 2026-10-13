import { RequestHandler } from 'express';
import { getRequestContext } from '../../middleware/auth';
import {
  createRequestAttachment,
  createSupplierDocument,
  deleteRequestAttachment,
  deleteSupplierDocument,
  listRequestAttachments,
  listSupplierDocuments,
} from './attachments.repository';

export const listRequestFiles: RequestHandler = async (req, res, next) => {
  try {
    const context = getRequestContext(req);
    const canReadAll = context.permissions.includes('purchase_requests:manage') || context.permissions.includes('*');
    res.json({ data: await listRequestAttachments(context, req.params.id, canReadAll) });
  } catch (error) {
    next(error);
  }
};

export const addRequestFile: RequestHandler = async (req, res, next) => {
  try {
    const context = getRequestContext(req);
    const canManageAny = context.permissions.includes('purchase_requests:manage') || context.permissions.includes('*');
    res.status(201).json({ data: await createRequestAttachment(context, req.params.id, req.body, canManageAny) });
  } catch (error) {
    next(error);
  }
};

export const removeRequestFile: RequestHandler = async (req, res, next) => {
  try {
    const context = getRequestContext(req);
    const canManageAny = context.permissions.includes('purchase_requests:manage') || context.permissions.includes('*');
    await deleteRequestAttachment(context, req.params.id, req.params.attachmentId, canManageAny);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

export const listSupplierFiles: RequestHandler = async (req, res, next) => {
  try {
    res.json({ data: await listSupplierDocuments(getRequestContext(req), req.params.id) });
  } catch (error) {
    next(error);
  }
};

export const addSupplierFile: RequestHandler = async (req, res, next) => {
  try {
    res.status(201).json({ data: await createSupplierDocument(getRequestContext(req), req.params.id, req.body) });
  } catch (error) {
    next(error);
  }
};

export const removeSupplierFile: RequestHandler = async (req, res, next) => {
  try {
    await deleteSupplierDocument(getRequestContext(req), req.params.id, req.params.documentId);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};
