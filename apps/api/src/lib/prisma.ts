import { PrismaClient } from '@eval-harness/db'
import { PrismaPg } from '@prisma/adapter-pg'
import { logger } from './logger.js'

let _prisma: PrismaClient | null = null

function getPrisma(): PrismaClient {
  if (!_prisma) {
    const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL']! })
    _prisma = new PrismaClient({ adapter })
    logger.info('prisma client initialized')
  }
  return _prisma
}

export const prisma = new Proxy<PrismaClient>({} as never, {
  get(_target, prop, receiver) {
    return Reflect.get(getPrisma(), prop, receiver)
  },
})
