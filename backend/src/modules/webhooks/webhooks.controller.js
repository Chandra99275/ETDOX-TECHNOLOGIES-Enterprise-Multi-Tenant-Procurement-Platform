
import { getRequestContext } from '../../middleware/auth.js';

import {
  createWebhook,
  deleteWebhook,
  getWebhook,
  listDeliveryAttempts,
  listWebhookDeliveries,
  listWebhooks,
  replayWebhookDelivery,
  updateWebhook,
} from './webhooks.repository.js';

export const create = async (req, res, next) => {
  try {
    res.status(201).json({
      data: await createWebhook(getRequestContext(req), req.body),
    });
  } catch (error) {
    next(error);
  }
};

export const list = async (req, res, next) => {
  try {
    const query = {
      status: req.query.status,
      limit: Number(req.query.limit ?? 25),
      offset: Number(req.query.offset ?? 0),
    };

    res.json(
      await listWebhooks(getRequestContext(req), query)
    );
  } catch (error) {
    next(error);
  }
};

export const get = async (req, res, next) => {
  try {
    res.json({
      data: await getWebhook(
        getRequestContext(req),
        req.params.id
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const update = async (req, res, next) => {
  try {
    res.json({
      data: await updateWebhook(
        getRequestContext(req),
        req.params.id,
        req.body
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const remove = async (req, res, next) => {
  try {
    const { id } = req.params;

    await deleteWebhook(getRequestContext(req), id);

    res.json({
      data: {
        id,
        deleted: true,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const listDeliveries = async (req, res, next) => {
  try {
    const query = {
      status: req.query.status,
      limit: Number(req.query.limit ?? 25),
      offset: Number(req.query.offset ?? 0),
    };

    res.json(
      await listWebhookDeliveries(
        getRequestContext(req),
        req.params.id,
        query
      )
    );
  } catch (error) {
    next(error);
  }
};

export const listAttempts = async (req, res, next) => {
  try {
    const query = {
      limit: Number(req.query.limit ?? 25),
      offset: Number(req.query.offset ?? 0),
    };

    res.json({
      ...await listDeliveryAttempts(
        getRequestContext(req),
        req.params.id,
        req.params.deliveryId,
        query
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const replayDelivery = async (req, res, next) => {
  try {
    res.json({
      data: await replayWebhookDelivery(
        getRequestContext(req),
        req.params.id,
        req.params.deliveryId
      ),
    });
  } catch (error) {
    next(error);
  }
};
