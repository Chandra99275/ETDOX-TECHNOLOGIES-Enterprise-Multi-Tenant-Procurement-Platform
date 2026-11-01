import { env } from "./env.js";

const allowedOrigins = new Set([
  env.frontendUrl,
  ...(env.isDevelopment
    ? ["http://localhost:5173", "http://127.0.0.1:5173"]
    : []),
]);

export const corsOptions = {
  origin(origin, callback) {
    // Allow requests without an Origin header, such as local health checks.
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.has(origin)) {
      return callback(null, true);
    }

    const error = new Error("Origin is not allowed by the CORS policy.");
    error.status = 403;

    return callback(error);
  },

  methods: [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
  ],

  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Request-ID",
  ],

  exposedHeaders: [
    "X-Request-ID",
  ],

  credentials: true,

  optionsSuccessStatus: 204,

  maxAge: 600,
};