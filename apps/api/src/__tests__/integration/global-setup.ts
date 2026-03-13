import pg from 'pg'
import { execSync } from 'child_process'
import path from 'path'

const TEST_DB = 'eval_harness_test'
const BASE_URL = 'postgresql://eval:eval@localhost:5432'
const TEST_URL = `${BASE_URL}/${TEST_DB}`

export async function setup() {
  const client = new pg.Client({ connectionString: `${BASE_URL}/postgres` })
  await client.connect()

  const result = await client.query(
    `SELECT 1 FROM pg_database WHERE datname = $1`,
    [TEST_DB],
  )
  if (result.rowCount === 0) {
    await client.query(`CREATE DATABASE ${TEST_DB}`)
  }
  await client.end()

  const dbPkgDir = path.resolve(__dirname, '../../../../../packages/db')
  execSync(`pnpm exec prisma db push --skip-generate`, {
    cwd: dbPkgDir,
    env: { ...process.env, DATABASE_URL: TEST_URL },
    stdio: 'pipe',
  })

  process.env['DATABASE_URL_TEST'] = TEST_URL
}

export async function teardown() {
  // Leave test DB for inspection
}
