import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from './lib/logger.js'
import { requestLogger } from './middleware/request-logger.js'
import { prisma } from './lib/prisma.js'
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
import { generateOutput } from './experiments/generator.js'
import { createPromptRepository } from './prompts/repository.js'
import { createPromptService } from './prompts/service.js'
import { createPromptRouter } from './prompts/router.js'

const app = new Hono()

app.use('*', cors())
app.use('*', requestLogger)

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

const datasetService = createDatasetService(datasetRepository)
const datasetRouter = createDatasetRouter(datasetService)

const graderService = createGraderService(graderRepository)
const graderRouter = createGraderRouter(graderService)

const experimentRunner = createExperimentRunner(experimentRepository, evaluate, generateOutput)

const promptRepository = createPromptRepository(prisma)
const promptService = createPromptService(promptRepository)
const promptRouter = createPromptRouter(promptService)

const experimentService = createExperimentService({
  repo: experimentRepository,
  datasetRepo: datasetRepository,
  graderRepo: graderRepository,
  promptRepo: promptRepository,
  runner: experimentRunner,
})
const experimentRouter = createExperimentRouter(experimentService)

app.route('/', datasetRouter)
app.route('/', graderRouter)
app.route('/', experimentRouter)
app.route('/', promptRouter)

serve(
  {
    fetch: app.fetch,
    port: Number(process.env['PORT'] ?? process.env['API_PORT'] ?? 3001),
  },
  (info) => {
    logger.info({ port: info.port }, 'server started')
  },
)
