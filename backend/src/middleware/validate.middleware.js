// backend/src/middleware/validate.middleware.js

// Validates req.body against a zod schema. On success, req.body is replaced
// with the parsed (and coerced/defaulted) data, so controllers can trust the
// shape of what they receive instead of re-checking it themselves.
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }
    req.body = result.data;
    next();
  };
}

module.exports = { validate };