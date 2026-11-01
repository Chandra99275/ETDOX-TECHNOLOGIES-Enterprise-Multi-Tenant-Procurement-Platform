import { ZodError } from "zod";

export function validate(schema, target = "body") {
  const allowedTargets = ["body", "query", "params"];

  if (!allowedTargets.includes(target)) {
    throw new Error(
      `Invalid validation target "${target}". Use body, query, or params.`
    );
  }

  if (!schema || typeof schema.safeParse !== "function") {
    throw new Error("validate() requires a valid Zod schema.");
  }

  return function validateRequest(req, _res, next) {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      const error = new Error("Request validation failed.");
      error.status = 400;
      error.code = "VALIDATION_ERROR";
      error.details = result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
        code: issue.code,
      }));

      return next(error);
    }

    // Use the parsed and validated values in subsequent handlers.
    if (target === "body") {
      req.body = result.data;
    } else if (target === "params") {
      req.params = result.data;
    } else {
      // Express query objects can be getter-backed, so do not
      // reassign req.query. Store validated data separately.
      req.validatedQuery = result.data;
    }

    return next();
  };
}

export { ZodError };

export default validate;