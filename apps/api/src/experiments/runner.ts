import PQueue from 'p-queue'
import { EventEmitter } from 'events'
import type { experimentRepository } from './repository.js'

export type ExperimentEvents = EventEmitter

export const experimentEvents = new EventEmitter()

const experimentQueue = new PQueue({ concurrency: 2 })

type Repo = Pick<
  typeof experimentRepository,
  'updateStatus' | 'createResult'
>

type EvaluateFn = (
  rubric: string,
  itemAttributes: Record<string, string>,
) => Promise<{ verdict: string; reason: string }>

export const createExperimentRunner = (repo: Repo, evaluate: EvaluateFn) => ({
  async enqueue(
    experimentId: string,
    datasetItems: Array<{ id: string; values: Record<string, string> }>,
    graders: Array<{ id: string; rubric: string }>,
  ): Promise<void> {
    await repo.updateStatus(experimentId, 'queued')

    await experimentQueue.add(async () => {
      await repo.updateStatus(experimentId, 'running')

      const totalCells = datasetItems.length * graders.length
      let cellsCompleted = 0
      let errorCount = 0

      const evalQueue = new PQueue({ concurrency: 4 })

      const tasks = datasetItems.flatMap((item) =>
        graders.map((grader) =>
          evalQueue.add(async () => {
            try {
              const result = await evaluate(grader.rubric, item.values)
              await repo.createResult({
                experimentId,
                datasetItemId: item.id,
                graderId: grader.id,
                verdict: result.verdict,
                reason: result.reason,
              })
            } catch (err) {
              errorCount++
              await repo.createResult({
                experimentId,
                datasetItemId: item.id,
                graderId: grader.id,
                verdict: 'error',
                reason: err instanceof Error ? err.message : 'Unknown error',
              })
            }

            cellsCompleted++
            experimentEvents.emit(experimentId, {
              type: 'progress',
              experimentId,
              cellsCompleted,
              totalCells,
              status: 'running',
            })
          }),
        ),
      )

      await Promise.all(tasks)

      const finalStatus = errorCount === totalCells ? 'failed' : 'complete'
      await repo.updateStatus(experimentId, finalStatus)

      if (finalStatus === 'failed') {
        experimentEvents.emit(experimentId, {
          type: 'error',
          experimentId,
          error: 'All evaluations failed',
        })
      }

      experimentEvents.emit(experimentId, {
        type: 'completed',
        experimentId,
        cellsCompleted,
        totalCells,
        status: finalStatus,
      })
    })
  },
})
