import { PrismaClient } from '@eval-harness/db'
import { PrismaPg } from '@prisma/adapter-pg'

let _prisma: PrismaClient | null = null

function getPrisma(): PrismaClient {
  if (!_prisma) {
    const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL']! })
    _prisma = new PrismaClient({ adapter })
  }
  return _prisma
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return (getPrisma() as unknown as Record<string | symbol, unknown>)[prop]
  },
})
