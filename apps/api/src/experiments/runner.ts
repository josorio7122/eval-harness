import PQueue from 'p-queue'
import { EventEmitter } from 'events'
import type { experimentRepository } from './repository.js'
import type { ExperimentStatus } from './repository.js'
import type { GenerateParams, GenerateResult } from './generator.js'
import { logger } from '../lib/logger.js'

export const experimentEvents = new EventEmitter()

const experimentQueue = new PQueue({ concurrency: 2 })

type Repo = Pick<typeof experimentRepository, 'updateStatus' | 'createResult' | 'createOutput'>

type EvaluateFn = (params: {
  rubric: string
  itemAttributes: Record<string, string>
  modelId: string
  output?: string
}) => Promise<{ verdict: string; reason: string }>

type GenerateFn = (params: GenerateParams) => Promise<GenerateResult>

async function evaluateCell(params: {
  evaluate: EvaluateFn
  repo: Repo
  experimentId: string
  item: { id: string; values: Record<string, string> }
  grader: { id: string; rubric: string }
  modelId: string
  output?: string
}) {
  const { evaluate, repo, experimentId, item, grader, modelId, output } = params
  let verdict: string
  let reason: string
  let isError: boolean

  try {
    const result = await evaluate({
      rubric: grader.rubric,
      itemAttributes: item.values,
      modelId,
      output,
    })
    verdict = result.verdict
    reason = result.reason
    isError = false
  } catch (err) {
    verdict = 'error'
    reason = err instanceof Error ? err.message : 'Unknown error'
    isError = true
    logger.error(
      { experimentId, itemId: item.id, graderId: grader.id, error: reason },
      'evaluation cell failed',
    )
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

export const createExperimentRunner = (repo: Repo, evaluate: EvaluateFn, generate: GenerateFn) => ({
  async enqueue(params: {
    experimentId: string
    datasetItems: Array<{ id: string; values: Record<string, string> }>
    graders: Array<{ id: string; rubric: string }>
    modelId: string
    promptVersion: {
      systemPrompt: string
      userPrompt: string
      modelId: string
      modelParams: Record<string, unknown>
    }
  }): Promise<void> {
    const { experimentId, datasetItems, graders, modelId, promptVersion } = params
    await experimentQueue.add(async () => {
      logger.info(
        { experimentId, itemCount: datasetItems.length, graderCount: graders.length, modelId },
        'experiment started',
      )
      const statusResult = await repo.updateStatus(experimentId, 'running')
      if (!statusResult.success) {
        logger.error({ experimentId, error: statusResult.error }, 'experiment status update failed')
        experimentEvents.emit(experimentId, {
          type: 'error',
          experimentId,
          error: statusResult.error,
        })
        return
      }

      const totalCells = datasetItems.length * graders.length
      let cellsCompleted = 0

      const llmRunQueue = new PQueue({ concurrency: 2 })
      const evalQueue = new PQueue({ concurrency: 4 })
      const allGradingPromises: Promise<unknown>[] = []

      const generationTasks = datasetItems.map((item) =>
        llmRunQueue.add(async () => {
          const input = item.values['input'] ?? ''
          const result = await generate({
            systemPrompt: promptVersion.systemPrompt,
            userPrompt: promptVersion.userPrompt,
            modelId: promptVersion.modelId,
            modelParams: promptVersion.modelParams,
            input,
          })

          await repo.createOutput({
            experimentId,
            datasetRevisionItemId: item.id,
            output: result.output,
            error: result.error,
          })

          if (result.error) {
            // Write error cells immediately without blocking the llmRunQueue slot
            for (const grader of graders) {
              await repo.createResult({
                experimentId,
                datasetRevisionItemId: item.id,
                graderId: grader.id,
                verdict: 'error',
                reason: result.error,
              })
              cellsCompleted++
              experimentEvents.emit(experimentId, {
                type: 'progress',
                experimentId,
                cellsCompleted,
                totalCells,
                status: 'running',
                result: null,
              })
            }
            return
          }

          // Generation succeeded — enqueue grading for this item on evalQueue
          // llmRunQueue slot is freed immediately after this function returns
          for (const grader of graders) {
            const gradingPromise = evalQueue.add(async () => {
              const cellResult = await evaluateCell({
                evaluate,
                repo,
                experimentId,
                item,
                grader,
                modelId,
                output: result.output,
              })

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
            })
            allGradingPromises.push(gradingPromise as Promise<unknown>)
          }
        }),
      )

      // Wait for all generations to complete (which also enqueues all grading tasks)
      await Promise.all(generationTasks)
      // Wait for all grading to complete
      const gradingResults = await Promise.all(allGradingPromises)

      // Count errors: generation error cells + grading errors
      const typedResults = gradingResults as Array<{ isError: boolean } | null | undefined>
      const errorCount = typedResults.filter((r) => r?.isError).length
      // Also count cells where cellsCompleted incremented with result: null (generation errors)
      const generationErrorCells = totalCells - typedResults.length

      const totalErrors = errorCount + generationErrorCells
      const finalStatus: ExperimentStatus = totalErrors === totalCells ? 'failed' : 'complete'
      logger.info({ experimentId, totalCells, totalErrors, finalStatus }, 'experiment finished')
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
