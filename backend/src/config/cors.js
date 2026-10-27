
import cors from "cors";
import { env } from "./env.js";

export const corsOptions = {
  origin(origin, callback) {
    // Allow requests without an Origin header, such as server-to-server
    // requests and some command-line health checks.
    if (!origin || env.allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Origin not allowed by CORS"));
  },

  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],

  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Request-ID",
  ],

  credentials: true,
  optionsSuccessStatus: 204,
  maxAge: 600,
};

export const corsMiddleware = cors(corsOptions);
