import PQueue from 'p-queue'
import { EventEmitter } from 'events'
import type { experimentRepository } from './repository.js'
import type { ExperimentStatus } from './repository.js'

export const experimentEvents = new EventEmitter()

const experimentQueue = new PQueue({ concurrency: 2 })

type Repo = Pick<typeof experimentRepository, 'updateStatus' | 'createResult'>

type EvaluateFn = (
  rubric: string,
  itemAttributes: Record<string, string>,
) => Promise<{ verdict: string; reason: string }>

async function evaluateCell(
  evaluate: EvaluateFn,
  repo: Repo,
  experimentId: string,
  item: { id: string; values: Record<string, string> },
  grader: { id: string; rubric: string },
) {
  let verdict: string
  let reason: string
  let isError: boolean

  try {
    const result = await evaluate(grader.rubric, item.values)
    verdict = result.verdict
    reason = result.reason
    isError = false
  } catch (err) {
    verdict = 'error'
    reason = err instanceof Error ? err.message : 'Unknown error'
    isError = true
  }

  const saveResult = await repo.createResult({
    experimentId,
    datasetRevisionItemId: item.id,
    graderId: grader.id,
    verdict,
    reason,
  })

  return { saved: saveResult.success ? saveResult.data : null, isError }
}

export const createExperimentRunner = (repo: Repo, evaluate: EvaluateFn) => ({
  async enqueue(
    experimentId: string,
    datasetItems: Array<{ id: string; values: Record<string, string> }>,
    graders: Array<{ id: string; rubric: string }>,
  ): Promise<void> {
    await experimentQueue.add(async () => {
      const statusResult = await repo.updateStatus(experimentId, 'running')
      if (!statusResult.success) {
        experimentEvents.emit(experimentId, {
          type: 'error',
          experimentId,
          error: statusResult.error,
        })
        return
      }

      const totalCells = datasetItems.length * graders.length
      let cellsCompleted = 0

      const evalQueue = new PQueue({ concurrency: 4 })

      const tasks = datasetItems.flatMap((item) =>
        graders.map((grader) =>
          evalQueue.add(async () => {
            const cellResult = await evaluateCell(evaluate, repo, experimentId, item, grader)

            cellsCompleted++
            experimentEvents.emit(experimentId, {
              type: 'progress',
              experimentId,
              cellsCompleted,
              totalCells,
              status: 'running',
              result: cellResult.saved,
            })

            return cellResult
          }),
        ),
      )

      const results = await Promise.all(tasks)
      const errorCount = results.filter((r) => r?.isError).length

      const finalStatus: ExperimentStatus = errorCount === totalCells ? 'failed' : 'complete'
      await repo.updateStatus(experimentId, finalStatus)

      if (finalStatus === 'failed') {
        experimentEvents.emit(experimentId, {
          type: 'error',
          experimentId,
          error: 'All evaluations failed',
        })
      } else {
        experimentEvents.emit(experimentId, {
          type: 'completed',
          experimentId,
          cellsCompleted,
          totalCells,
          status: finalStatus,
        })
      }
    })
  },
})
