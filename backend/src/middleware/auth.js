
import { authenticate } from "./authenticate.js";
import { AppError } from "../utils/errors.js";

// --------------------------------------------------
// Shared authentication middleware
// --------------------------------------------------

// Reuse the canonical authentication implementation so
// routes importing either middleware get consistent
// JWT validation, tenant context, and role information.
export { authenticate };

// --------------------------------------------------
// Request context helper
// --------------------------------------------------

export function getRequestContext(req) {
  if (!req.context) {
    throw new AppError(
      401,
      "UNAUTHENTICATED",
      "Authentication is required."
    );
  }

  return req.context;
}

export default authenticate;
