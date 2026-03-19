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
      let phase1Completed = 0

      // Phase 1: LLM Generation
      const llmRunQueue = new PQueue({ concurrency: 2 })
      const outputMap = new Map<string, { output: string; error: string | null }>()

      const phase1Tasks = datasetItems.map((item) =>
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

          outputMap.set(item.id, result)

          phase1Completed++
          experimentEvents.emit(experimentId, {
            type: 'progress',
            experimentId,
            cellsCompleted: 0,
            totalCells,
            status: 'running',
            phase: 'generating',
            generationCompleted: phase1Completed,
            generationTotal: datasetItems.length,
          })
        }),
      )

      await Promise.all(phase1Tasks)

      // For items that failed generation, write error grading cells immediately
      const failedItems = datasetItems.filter((item) => outputMap.get(item.id)?.error != null)
      for (const item of failedItems) {
        const errorMsg = outputMap.get(item.id)!.error!
        for (const grader of graders) {
          await repo.createResult({
            experimentId,
            datasetRevisionItemId: item.id,
            graderId: grader.id,
            verdict: 'error',
            reason: errorMsg,
          })
          cellsCompleted++
        }
      }

      // Phase 2: Grading (only for items that succeeded generation)
      const successItems = datasetItems.filter((item) => outputMap.get(item.id)?.error == null)

      const evalQueue = new PQueue({ concurrency: 4 })

      const phase2Tasks = successItems.flatMap((item) =>
        graders.map((grader) =>
          evalQueue.add(async () => {
            const output = outputMap.get(item.id)!.output
            const cellResult = await evaluateCell({
              evaluate,
              repo,
              experimentId,
              item,
              grader,
              modelId,
              output,
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
          }),
        ),
      )

      const phase2Results = await Promise.all(phase2Tasks)

      // Count all errors: phase1 errors (failed items × graders) + phase2 errors
      const phase1ErrorCount = failedItems.length * graders.length
      const phase2ErrorCount = phase2Results.filter((r) => r?.isError).length
      const errorCount = phase1ErrorCount + phase2ErrorCount

      const finalStatus: ExperimentStatus = errorCount === totalCells ? 'failed' : 'complete'
      logger.info({ experimentId, totalCells, errorCount, finalStatus }, 'experiment finished')
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
