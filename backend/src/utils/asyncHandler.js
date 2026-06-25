// backend/src/utils/asyncHandler.js

// Express 4 doesn't forward rejected promises from async handlers to next().
// Wrapping every handler in this wins back proper error-handling middleware
// support without needing try/catch in every controller function.
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { asyncHandler };