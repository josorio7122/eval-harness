import type { MiddlewareHandler } from 'hono'
import { logger } from '../lib/logger.js'

export const requestLogger: MiddlewareHandler = async (c, next) => {
  const start = Date.now()
  const { method, path } = c.req

  await next()

  const duration = Date.now() - start
  const status = c.res.status

  const logData = {
    method,
    path,
    status,
    duration,
  }

  if (status >= 500) {
    logger.error(logData, 'request error')
  } else if (status >= 400) {
    logger.warn(logData, 'request client error')
  } else {
    logger.info(logData, 'request completed')
  }
}
