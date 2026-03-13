import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { datasetRepository } from './datasets/repository.js'
import { createDatasetService } from './datasets/service.js'
import { createDatasetRouter } from './datasets/router.js'
import { graderRepository } from './graders/repository.js'
import { createGraderService } from './graders/service.js'
import { createGraderRouter } from './graders/router.js'

const app = new Hono()

app.use('*', cors())

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

const datasetService = createDatasetService(datasetRepository)
const datasetRouter = createDatasetRouter(datasetService)

const graderService = createGraderService(graderRepository)
const graderRouter = createGraderRouter(graderService)

app.route('/', datasetRouter)
app.route('/', graderRouter)

serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
