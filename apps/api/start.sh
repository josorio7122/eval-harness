#!/bin/sh
set -e
echo "Running Prisma migrations..."
cd /app/packages/db
npx prisma migrate deploy
cd /app
echo "Starting API server..."
exec node apps/api/dist/index.js
