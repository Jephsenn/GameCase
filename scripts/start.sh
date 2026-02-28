#!/bin/sh
set -e

echo "=== Running Prisma migrations ==="
npx prisma migrate deploy --schema=./prisma/schema.prisma
echo "=== Migrations complete ==="

echo "=== Starting Node server ==="
echo "NODE_ENV=$NODE_ENV"
echo "PORT=$PORT"
echo "Working directory: $(pwd)"
echo "Files in dist/: $(ls -la dist/ 2>&1 | head -5)"
exec node dist/index.js 2>&1
