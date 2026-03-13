import pg from 'pg'
import { beforeAll, afterAll } from 'vitest'

const TEST_URL = 'postgresql://eval:eval@localhost:5432/eval_harness_test'

process.env['DATABASE_URL'] = TEST_URL

let client: pg.Client

beforeAll(async () => {
  client = new pg.Client({ connectionString: TEST_URL })
  await client.connect()
  await client.query(`
    TRUNCATE "ExperimentResult", "ExperimentGrader", "Experiment", "DatasetItem", "Dataset", "Grader" CASCADE
  `)
})

afterAll(async () => {
  if (client) {
    await client.end()
  }
})
