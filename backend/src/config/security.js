import helmet from "helmet";
import { env } from "./env.js";

export const helmetOptions = {
  contentSecurityPolicy: env.isProduction
    ? {
        directives: {
          defaultSrc: ["'self'"],
          baseUri: ["'self'"],
          fontSrc: ["'self'", "https:", "data:"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          imgSrc: ["'self'", "data:", "https:"],
          objectSrc: ["'none'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "https:", "'unsafe-inline'"],
          upgradeInsecureRequests: [],
        },
      }
    : false,

  crossOriginEmbedderPolicy: false,

  referrerPolicy: {
    policy: "strict-origin-when-cross-origin",
  },

  frameguard: {
    action: "deny",
  },

  noSniff: true,
};

/**
 * Register security headers in Express.
 *
 * Usage:
 * import { configureSecurity } from "./config/security.js";
 * configureSecurity(app);
 */
export function configureSecurity(app) {
  app.disable("x-powered-by");
  app.use(helmet(helmetOptions));
}