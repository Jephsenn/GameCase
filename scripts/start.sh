#!/bin/sh
set -e

echo "=== Running Prisma migrations ==="
npx prisma migrate deploy --schema=./prisma/schema.prisma
echo "=== Migrations complete ==="

echo "=== Starting Node server ==="
exec node dist/index.js
