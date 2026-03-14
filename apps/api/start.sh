#!/bin/sh
set -e
echo "Running Prisma db push..."
cd /app/packages/db
npx prisma db push --skip-generate
cd /app
echo "Starting API server..."
exec node apps/api/dist/index.js
