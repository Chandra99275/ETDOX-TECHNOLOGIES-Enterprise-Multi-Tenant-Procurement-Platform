import { RequestHandler } from 'express';
import { getRequestContext } from '../../middleware/auth';
import {
  createWebhook,
  deleteWebhook,
  getWebhook,
  listDeliveryAttempts,
  listWebhookDeliveries,
  listWebhooks,
  replayWebhookDelivery,
  updateWebhook,
} from './webhooks.repository';

export const create: RequestHandler = async (req, res, next) => {
  try {
    res.status(201).json({ data: await createWebhook(getRequestContext(req), req.body) });
  } catch (error) {
    next(error);
  }
};

export const list: RequestHandler = async (req, res, next) => {
  try {
    const query = req.query as unknown as { status?: string; limit: number; offset: number };
    res.json(await listWebhooks(getRequestContext(req), query));
  } catch (error) {
    next(error);
  }
};

export const get: RequestHandler = async (req, res, next) => {
  try {
    res.json({ data: await getWebhook(getRequestContext(req), req.params.id) });
  } catch (error) {
    next(error);
  }
};

export const update: RequestHandler = async (req, res, next) => {
  try {
    res.json({ data: await updateWebhook(getRequestContext(req), req.params.id, req.body) });
  } catch (error) {
    next(error);
  }
};

export const remove: RequestHandler = async (req, res, next) => {
  try {
    const id = req.params.id;
    await deleteWebhook(getRequestContext(req), id);
    res.json({ data: { id, deleted: true } });
  } catch (error) {
    next(error);
  }
};

export const listDeliveries: RequestHandler = async (req, res, next) => {
  try {
    const query = req.query as unknown as { status?: string; limit: number; offset: number };
    res.json(await listWebhookDeliveries(getRequestContext(req), req.params.id, query));
  } catch (error) {
    next(error);
  }
};

export const listAttempts: RequestHandler = async (req, res, next) => {
  try {
    const query = req.query as unknown as { limit: number; offset: number };
    res.json({
      ...await listDeliveryAttempts(getRequestContext(req), req.params.id, req.params.deliveryId, query),
    });
  } catch (error) {
    next(error);
  }
};

export const replayDelivery: RequestHandler = async (req, res, next) => {
  try {
    res.json({
      data: await replayWebhookDelivery(getRequestContext(req), req.params.id, req.params.deliveryId),
    });
  } catch (error) {
    next(error);
  }
};
