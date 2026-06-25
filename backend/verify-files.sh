# webhookhub/verify-files.sh

#!/bin/bash
# Run this from your webhookhub repo root: bash verify-files.sh
#
# Checks every file that should exist actually does, and flags anything
# missing or suspiciously empty (under 50 bytes - real implementation
# files in this project are all well over that). This exists specifically
# to settle "is a file actually missing, or did something else go wrong"
# without more guessing.

FILES=(
  "backend/package.json"
  "frontend/package.json"
  "ARCHITECTURE.md"
  "README.md"
  "TESTING.md"
  ".github/workflows/ci.yml"
  "backend/prisma/schema.prisma"
  "backend/scripts/loadtest.js"
  "backend/scripts/smoke-test.sh"
  "backend/src/config/db.js"
  "backend/src/config/redis.js"
  "backend/src/controllers/apiKey.controller.js"
  "backend/src/controllers/auth.controller.js"
  "backend/src/controllers/delivery.controller.js"
  "backend/src/controllers/endpoint.controller.js"
  "backend/src/controllers/event.controller.js"
  "backend/src/controllers/project.controller.js"
  "backend/src/controllers/user.controller.js"
  "backend/src/middleware/apiKeyAuth.middleware.js"
  "backend/src/middleware/auth.middleware.js"
  "backend/src/middleware/idempotency.middleware.js"
  "backend/src/middleware/rateLimitApiKey.middleware.js"
  "backend/src/middleware/rbac.middleware.js"
  "backend/src/middleware/validate.middleware.js"
  "backend/src/queues/webhookQueue.js"
  "backend/src/routes/apiKey.item.routes.js"
  "backend/src/routes/apiKey.routes.js"
  "backend/src/routes/auth.routes.js"
  "backend/src/routes/delivery.item.routes.js"
  "backend/src/routes/delivery.routes.js"
  "backend/src/routes/endpoint.item.routes.js"
  "backend/src/routes/endpoint.routes.js"
  "backend/src/routes/event.routes.js"
  "backend/src/routes/health.routes.js"
  "backend/src/routes/project.routes.js"
  "backend/src/routes/user.routes.js"
  "backend/src/server.js"
  "backend/src/sockets/index.js"
  "backend/src/utils/apiKey.js"
  "backend/src/utils/asyncHandler.js"
  "backend/src/utils/audit.js"
  "backend/src/utils/crypto.js"
  "backend/src/utils/emailVerification.js"
  "backend/src/utils/jwt.js"
  "backend/src/utils/logger.js"
  "backend/src/utils/mailer.js"
  "backend/src/utils/signature.js"
  "backend/src/utils/tokenRevocation.js"
  "backend/src/utils/urlSafety.js"
  "backend/src/validators/apiKey.validator.js"
  "backend/src/validators/auth.validator.js"
  "backend/src/validators/endpoint.validator.js"
  "backend/src/validators/event.validator.js"
  "backend/src/validators/project.validator.js"
  "backend/src/validators/user.validator.js"
  "backend/test-helpers/mockDb.js"
  "backend/test/apiKey.test.js"
  "backend/test/auth.controller.test.js"
  "backend/test/crypto.test.js"
  "backend/test/jwt.test.js"
  "backend/test/project.controller.test.js"
  "backend/test/rbac.test.js"
  "backend/test/signature.test.js"
  "backend/test/urlSafety.test.js"
  "backend/test/webhookQueue.test.js"
  "sdk/index.js"
)

MIN_BYTES=50
missing=0
empty=0
ok=0

for f in "${FILES[@]}"; do
  if [ ! -f "$f" ]; then
    echo "MISSING     - $f"
    missing=$((missing+1))
  else
    size=$(wc -c < "$f")
    if [ "$size" -lt "$MIN_BYTES" ]; then
      echo "SUSPICIOUSLY EMPTY ($size bytes) - $f"
      empty=$((empty+1))
    else
      ok=$((ok+1))
    fi
  fi
done

echo ""
echo "=== $ok OK, $missing missing, $empty suspiciously empty (out of ${#FILES[@]} expected files) ==="

# Also check for nodemailer specifically, since this was a confirmed gap
if ! grep -q '"nodemailer"' backend/package.json 2>/dev/null; then
  echo "WARNING - nodemailer not found in backend/package.json (needed by utils/mailer.js)"
fi