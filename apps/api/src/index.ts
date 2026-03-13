import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { datasetRepository } from './datasets/repository.js'
import { createDatasetService } from './datasets/service.js'
import { createDatasetRouter } from './datasets/router.js'

const app = new Hono()

app.use('*', cors())

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

const datasetService = createDatasetService(datasetRepository)
const datasetRouter = createDatasetRouter(datasetService)

app.route('/', datasetRouter)

serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
