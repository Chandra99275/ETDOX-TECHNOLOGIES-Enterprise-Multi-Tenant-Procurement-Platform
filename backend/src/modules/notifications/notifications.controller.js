
import { getRequestContext } from '../../middleware/auth.js';
import {
  getNotification,
  listNotifications,
  markNotificationRead,
} from './notifications.repository.js';

export const list = async (req, res, next) => {
  try {
    const query = req.query;
    res.json(
      await listNotifications(getRequestContext(req), query)
    );
  } catch (error) {
    next(error);
  }
};

export const get = async (req, res, next) => {
  try {
    res.json({
      data: await getNotification(
        getRequestContext(req),
        req.params.id
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const markRead = async (req, res, next) => {
  try {
    res.json({
      data: await markNotificationRead(
        getRequestContext(req),
        req.params.id
      ),
    });
  } catch (error) {
    next(error);
  }
};
