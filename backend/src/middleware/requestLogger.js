
import { randomUUID } from 'node:crypto';

export function requestLogger(req, res, next) {
  const startedAt = process.hrtime.bigint();

  const incomingId = req.headers['x-request-id'];
  const requestId =
    typeof incomingId === 'string' &&
    /^[a-zA-Z0-9._-]{1,100}$/.test(incomingId)
      ? incomingId
      : randomUUID();

  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);

  res.on('finish', () => {
    const elapsedNs = process.hrtime.bigint() - startedAt;
    const durationMs = Number(elapsedNs) / 1_000_000;

    const logEntry = {
      timestamp: new Date().toISOString(),
      level: res.statusCode >= 500 ? 'error' : 'info',
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
      ip: req.ip,
      userId: req.user?.id ?? null,
      tenantId: req.user?.tenantId ?? null,
    };

    const output = JSON.stringify(logEntry);

    if (res.statusCode >= 500) {
      console.error(output);
    } else {
      console.log(output);
    }
  });

  return next();
}

export default requestLogger;
