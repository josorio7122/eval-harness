import { config } from 'dotenv'
import { resolve } from 'path'
import { defineConfig } from 'prisma/config'

// Load from monorepo root .env (two levels up from packages/db)
config({ path: resolve(import.meta.dirname, '../../.env') })

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env['DATABASE_URL'],
  },
})
