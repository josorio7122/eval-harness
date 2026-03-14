import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { datasetRepository } from './datasets/repository.js'
import { createDatasetService } from './datasets/service.js'
import { createDatasetRouter } from './datasets/router.js'
import { graderRepository } from './graders/repository.js'
import { createGraderService } from './graders/service.js'
import { createGraderRouter } from './graders/router.js'
import { experimentRepository } from './experiments/repository.js'
import { createExperimentService } from './experiments/service.js'
import { createExperimentRouter } from './experiments/router.js'
import { createExperimentRunner } from './experiments/runner.js'
import { evaluate } from './experiments/evaluator.js'

const app = new Hono()

app.use('*', cors())

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

const datasetService = createDatasetService(datasetRepository)
const datasetRouter = createDatasetRouter(datasetService)

const graderService = createGraderService(graderRepository)
const graderRouter = createGraderRouter(graderService)

const experimentRunner = createExperimentRunner(experimentRepository, evaluate)

const experimentService = createExperimentService({
  repo: experimentRepository,
  datasetRepo: datasetRepository,
  graderRepo: graderRepository,
  runner: experimentRunner,
})
const experimentRouter = createExperimentRouter(experimentService)

app.route('/', datasetRouter)
app.route('/', graderRouter)
app.route('/', experimentRouter)

serve(
  {
    fetch: app.fetch,
    port: Number(process.env['PORT'] ?? process.env['API_PORT'] ?? 3001),
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`)
  },
)
