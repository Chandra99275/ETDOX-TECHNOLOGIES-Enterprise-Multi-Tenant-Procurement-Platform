import { RequestHandler } from 'express';
import { getRequestContext } from '../../middleware/auth';
import { getNotification, listNotifications, markNotificationRead } from './notifications.repository';

export const list: RequestHandler = async (req, res, next) => {
  try {
    const query = req.query as unknown as { limit: number; offset: number; unreadOnly?: boolean };
    res.json(await listNotifications(getRequestContext(req), query));
  } catch (error) {
    next(error);
  }
};

export const get: RequestHandler = async (req, res, next) => {
  try {
    res.json({ data: await getNotification(getRequestContext(req), req.params.id) });
  } catch (error) {
    next(error);
  }
};

export const markRead: RequestHandler = async (req, res, next) => {
  try {
    res.json({ data: await markNotificationRead(getRequestContext(req), req.params.id) });
  } catch (error) {
    next(error);
  }
};
