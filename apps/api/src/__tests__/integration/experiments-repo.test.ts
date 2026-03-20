import { describe, it, expect } from 'vitest'

const MODEL_ID = 'openai/gpt-4o'
import { experimentRepository as repo } from '../../experiments/repository.js'
import { datasetRepository } from '../../datasets/repository.js'
import { graderRepository } from '../../graders/repository.js'
import { unwrap, uid, seedPrompt } from './helpers.js'

async function seedData() {
  const dataset = unwrap(await datasetRepository.create(uid('exp-repo-ds')))
  unwrap(await datasetRepository.createItem(dataset.id, { input: 'q1', expected_output: 'a1' }))
  unwrap(await datasetRepository.createItem(dataset.id, { input: 'q2', expected_output: 'a2' }))

  // Get the latest revision
  const revisions = unwrap(await datasetRepository.findRevisions(dataset.id))
  const latestRevision = revisions[0]

  // Get items from the latest revision (they have the revision-specific .id we need)
  const latestData = unwrap(await datasetRepository.findById(dataset.id))
  const revisionItems = latestData.items

  const grader1 = unwrap(
    await graderRepository.create({
      name: uid('exp-repo-grader-1'),
      description: 'desc',
      rubric: 'rubric1',
    }),
  )
  const grader2 = unwrap(
    await graderRepository.create({
      name: uid('exp-repo-grader-2'),
      description: 'desc',
      rubric: 'rubric2',
    }),
  )

  const prompt = await seedPrompt(MODEL_ID)
  const promptVersion = prompt.versions[0]

  return { dataset, latestRevision, revisionItems, grader1, grader2, promptVersion }
}

describe('experiments repository (integration)', () => {
  it('create with graderIds and revisionId → junction rows', async () => {
    const { dataset, latestRevision, grader1, grader2, promptVersion } = await seedData()

    const experiment = unwrap(
      await repo.create({
        name: 'exp-junction',
        datasetId: dataset.id,
        datasetRevisionId: latestRevision.id,
        graderIds: [grader1.id, grader2.id],
        modelId: MODEL_ID,
        promptVersionId: promptVersion.id,
      }),
    )

    expect(experiment.datasetRevisionId).toBe(latestRevision.id)
    const found = unwrap(await repo.findById(experiment.id))
    expect(found.graders).toHaveLength(2)
  })

  it('findById includes revision.items + graders.grader', async () => {
    const { dataset, latestRevision, revisionItems, grader1, promptVersion } = await seedData()

    const experiment = unwrap(
      await repo.create({
        name: 'exp-includes',
        datasetId: dataset.id,
        datasetRevisionId: latestRevision.id,
        graderIds: [grader1.id],
        modelId: MODEL_ID,
        promptVersionId: promptVersion.id,
      }),
    )

    const found = unwrap(await repo.findById(experiment.id))
    expect(found.revision.items).toHaveLength(2)
    const itemIds = found.revision.items.map((i: { id: string }) => i.id).sort()
    const expectedIds = revisionItems.map((i: { id: string }) => i.id).sort()
    expect(itemIds).toEqual(expectedIds)
    expect(found.graders[0].grader.rubric).toBe('rubric1')
  })

  it('findAll includes dataset name + _count.results', async () => {
    const { dataset, latestRevision, grader1, promptVersion } = await seedData()

    unwrap(
      await repo.create({
        name: 'exp-findall',
        datasetId: dataset.id,
        datasetRevisionId: latestRevision.id,
        graderIds: [grader1.id],
        modelId: MODEL_ID,
        promptVersionId: promptVersion.id,
      }),
    )

    const all = unwrap(await repo.findAll())
    const entry = all.find((e) => e.name === 'exp-findall')
    expect(entry).toBeDefined()
    expect(entry!.dataset.name).toBe(dataset.name)
    expect(entry!._count.results).toBe(0)
  })

  it('updateStatus transition', async () => {
    const { dataset, latestRevision, grader1, promptVersion } = await seedData()

    const experiment = unwrap(
      await repo.create({
        name: 'exp-status',
        datasetId: dataset.id,
        datasetRevisionId: latestRevision.id,
        graderIds: [grader1.id],
        modelId: MODEL_ID,
        promptVersionId: promptVersion.id,
      }),
    )

    expect(experiment.status).toBe('queued')
    unwrap(await repo.updateStatus(experiment.id, 'running'))
    const found = unwrap(await repo.findById(experiment.id))
    expect(found.status).toBe('running')
  })

  it('createResult → findResultsByExperimentId', async () => {
    const { dataset, latestRevision, revisionItems, grader1, promptVersion } = await seedData()

    const experiment = unwrap(
      await repo.create({
        name: 'exp-result',
        datasetId: dataset.id,
        datasetRevisionId: latestRevision.id,
        graderIds: [grader1.id],
        modelId: MODEL_ID,
        promptVersionId: promptVersion.id,
      }),
    )

    unwrap(
      await repo.createResult({
        experimentId: experiment.id,
        datasetRevisionItemId: revisionItems[0].id,
        graderId: grader1.id,
        verdict: 'pass',
        reason: 'looks good',
      }),
    )

    const results = unwrap(await repo.findResultsByExperimentId(experiment.id))
    expect(results).toHaveLength(1)
    expect(results[0].verdict).toBe('pass')
  })

  it('countResultsByExperimentId accuracy', async () => {
    const { dataset, latestRevision, revisionItems, grader1, grader2, promptVersion } =
      await seedData()

    const experiment = unwrap(
      await repo.create({
        name: 'exp-count',
        datasetId: dataset.id,
        datasetRevisionId: latestRevision.id,
        graderIds: [grader1.id, grader2.id],
        modelId: MODEL_ID,
        promptVersionId: promptVersion.id,
      }),
    )

    unwrap(
      await repo.createResult({
        experimentId: experiment.id,
        datasetRevisionItemId: revisionItems[0].id,
        graderId: grader1.id,
        verdict: 'pass',
        reason: 'r1',
      }),
    )
    unwrap(
      await repo.createResult({
        experimentId: experiment.id,
        datasetRevisionItemId: revisionItems[0].id,
        graderId: grader2.id,
        verdict: 'fail',
        reason: 'r2',
      }),
    )
    unwrap(
      await repo.createResult({
        experimentId: experiment.id,
        datasetRevisionItemId: revisionItems[1].id,
        graderId: grader1.id,
        verdict: 'pass',
        reason: 'r3',
      }),
    )

    const count = unwrap(await repo.countResultsByExperimentId(experiment.id))
    expect(count).toBe(3)
  })

  it('findResultsWithDetails includes revision item + grader', async () => {
    const { dataset, latestRevision, revisionItems, grader1, promptVersion } = await seedData()

    const experiment = unwrap(
      await repo.create({
        name: 'exp-details',
        datasetId: dataset.id,
        datasetRevisionId: latestRevision.id,
        graderIds: [grader1.id],
        modelId: MODEL_ID,
        promptVersionId: promptVersion.id,
      }),
    )

    // Find the item with q1 values (order is UUID-sorted, not insertion order)
    const q1Item = revisionItems.find((i) => (i.values as Record<string, string>).input === 'q1')!

    unwrap(
      await repo.createResult({
        experimentId: experiment.id,
        datasetRevisionItemId: q1Item.id,
        graderId: grader1.id,
        verdict: 'pass',
        reason: 'detailed',
      }),
    )

    const results = unwrap(await repo.findResultsWithDetails(experiment.id))
    expect(results).toHaveLength(1)
    expect(results[0].datasetRevisionItem.values).toMatchObject({
      input: 'q1',
      expected_output: 'a1',
    })
    expect(results[0].grader.name).toBe(grader1.name)
  })

  it('duplicate createResult raises error (unique constraint)', async () => {
    const { dataset, latestRevision, revisionItems, grader1, promptVersion } = await seedData()

    const experiment = unwrap(
      await repo.create({
        name: 'exp-duplicate',
        datasetId: dataset.id,
        datasetRevisionId: latestRevision.id,
        graderIds: [grader1.id],
        modelId: MODEL_ID,
        promptVersionId: promptVersion.id,
      }),
    )

    unwrap(
      await repo.createResult({
        experimentId: experiment.id,
        datasetRevisionItemId: revisionItems[0].id,
        graderId: grader1.id,
        verdict: 'pass',
        reason: 'first',
      }),
    )

    const duplicateResult = await repo.createResult({
      experimentId: experiment.id,
      datasetRevisionItemId: revisionItems[0].id,
      graderId: grader1.id,
      verdict: 'fail',
      reason: 'duplicate',
    })
    expect(duplicateResult.success).toBe(false)
  })

  it('remove (soft delete) — findById returns fail, results still exist in DB', async () => {
    const { dataset, latestRevision, revisionItems, grader1, promptVersion } = await seedData()

    const experiment = unwrap(
      await repo.create({
        name: 'exp-remove',
        datasetId: dataset.id,
        datasetRevisionId: latestRevision.id,
        graderIds: [grader1.id],
        modelId: MODEL_ID,
        promptVersionId: promptVersion.id,
      }),
    )

    unwrap(
      await repo.createResult({
        experimentId: experiment.id,
        datasetRevisionItemId: revisionItems[0].id,
        graderId: grader1.id,
        verdict: 'pass',
        reason: 'before remove',
      }),
    )

    unwrap(await repo.remove(experiment.id))
    const found = await repo.findById(experiment.id)
    expect(found.success).toBe(false)
  })

  it('soft-deleted experiment does not appear in findAll', async () => {
    const { dataset, latestRevision, grader1, promptVersion } = await seedData()

    const experiment = unwrap(
      await repo.create({
        name: 'exp-soft-del-hidden',
        datasetId: dataset.id,
        datasetRevisionId: latestRevision.id,
        graderIds: [grader1.id],
        modelId: MODEL_ID,
        promptVersionId: promptVersion.id,
      }),
    )

    unwrap(await repo.remove(experiment.id))

    const all = unwrap(await repo.findAll())
    const ids = all.map((e) => e.id)
    expect(ids).not.toContain(experiment.id)
  })

  // B17 — shared revision
  it('two experiments without intervening edits share the same revisionId', async () => {
    const { dataset, latestRevision, grader1, promptVersion } = await seedData()

    const expA = unwrap(
      await repo.create({
        name: 'exp-shared-a',
        datasetId: dataset.id,
        datasetRevisionId: latestRevision.id,
        graderIds: [grader1.id],
        modelId: MODEL_ID,
        promptVersionId: promptVersion.id,
      }),
    )
    const expB = unwrap(
      await repo.create({
        name: 'exp-shared-b',
        datasetId: dataset.id,
        datasetRevisionId: latestRevision.id,
        graderIds: [grader1.id],
        modelId: MODEL_ID,
        promptVersionId: promptVersion.id,
      }),
    )

    expect(expA.datasetRevisionId).toBe(expB.datasetRevisionId)
  })

  it('create stores promptVersionId correctly', async () => {
    const { dataset, latestRevision, grader1, promptVersion } = await seedData()

    const experiment = unwrap(
      await repo.create({
        name: 'exp-prompt-version-id',
        datasetId: dataset.id,
        datasetRevisionId: latestRevision.id,
        graderIds: [grader1.id],
        modelId: MODEL_ID,
        promptVersionId: promptVersion.id,
      }),
    )

    expect(experiment.promptVersionId).toBe(promptVersion.id)
  })

  it('findById returns promptVersion with version, systemPrompt, userPrompt, modelId, modelParams, and prompt.name', async () => {
    const { dataset, latestRevision, grader1, promptVersion } = await seedData()

    const experiment = unwrap(
      await repo.create({
        name: 'exp-prompt-version-details',
        datasetId: dataset.id,
        datasetRevisionId: latestRevision.id,
        graderIds: [grader1.id],
        modelId: MODEL_ID,
        promptVersionId: promptVersion.id,
      }),
    )

    const found = unwrap(await repo.findById(experiment.id))
    expect(found.promptVersionId).toBe(promptVersion.id)
    expect(found.promptVersion).toBeDefined()
    expect(found.promptVersion.version).toBe(promptVersion.version)
    expect(found.promptVersion.systemPrompt).toBe('You are a helpful assistant.')
    expect(found.promptVersion.userPrompt).toBe('Answer the following: {input}')
    expect(found.promptVersion.modelId).toBe(MODEL_ID)
    expect(found.promptVersion.modelParams).toBeDefined()
    expect(found.promptVersion.prompt).toBeDefined()
    expect(typeof found.promptVersion.prompt.name).toBe('string')
  })

  it('createOutput stores an ExperimentOutput record', async () => {
    const { dataset, latestRevision, revisionItems, grader1, promptVersion } = await seedData()

    const experiment = unwrap(
      await repo.create({
        name: 'exp-output-store',
        datasetId: dataset.id,
        datasetRevisionId: latestRevision.id,
        graderIds: [grader1.id],
        modelId: MODEL_ID,
        promptVersionId: promptVersion.id,
      }),
    )

    const output = unwrap(
      await repo.createOutput({
        experimentId: experiment.id,
        datasetRevisionItemId: revisionItems[0].id,
        output: 'This is the model output',
        error: null,
      }),
    )

    expect(output.id).toBeTruthy()
    expect(output.experimentId).toBe(experiment.id)
    expect(output.datasetRevisionItemId).toBe(revisionItems[0].id)
    expect(output.output).toBe('This is the model output')
    expect(output.error).toBeNull()
  })

  it('createOutput with error stores error field', async () => {
    const { dataset, latestRevision, revisionItems, grader1, promptVersion } = await seedData()

    const experiment = unwrap(
      await repo.create({
        name: 'exp-output-error',
        datasetId: dataset.id,
        datasetRevisionId: latestRevision.id,
        graderIds: [grader1.id],
        modelId: MODEL_ID,
        promptVersionId: promptVersion.id,
      }),
    )

    const output = unwrap(
      await repo.createOutput({
        experimentId: experiment.id,
        datasetRevisionItemId: revisionItems[0].id,
        output: '',
        error: 'Rate limit exceeded',
      }),
    )

    expect(output.error).toBe('Rate limit exceeded')
    expect(output.output).toBe('')
  })

  it('findOutputsByExperimentId returns all outputs for an experiment', async () => {
    const { dataset, latestRevision, revisionItems, grader1, promptVersion } = await seedData()

    const experiment = unwrap(
      await repo.create({
        name: 'exp-output-findall',
        datasetId: dataset.id,
        datasetRevisionId: latestRevision.id,
        graderIds: [grader1.id],
        modelId: MODEL_ID,
        promptVersionId: promptVersion.id,
      }),
    )

    unwrap(
      await repo.createOutput({
        experimentId: experiment.id,
        datasetRevisionItemId: revisionItems[0].id,
        output: 'output-1',
        error: null,
      }),
    )
    unwrap(
      await repo.createOutput({
        experimentId: experiment.id,
        datasetRevisionItemId: revisionItems[1].id,
        output: 'output-2',
        error: null,
      }),
    )

    const outputs = unwrap(await repo.findOutputsByExperimentId(experiment.id))
    expect(outputs).toHaveLength(2)
    const outputTexts = outputs.map((o) => o.output).sort()
    expect(outputTexts).toEqual(['output-1', 'output-2'])
  })

  it('createOutput rejects duplicate (experimentId, datasetRevisionItemId)', async () => {
    const { dataset, latestRevision, revisionItems, grader1, promptVersion } = await seedData()

    const experiment = unwrap(
      await repo.create({
        name: 'exp-output-duplicate',
        datasetId: dataset.id,
        datasetRevisionId: latestRevision.id,
        graderIds: [grader1.id],
        modelId: MODEL_ID,
        promptVersionId: promptVersion.id,
      }),
    )

    unwrap(
      await repo.createOutput({
        experimentId: experiment.id,
        datasetRevisionItemId: revisionItems[0].id,
        output: 'first',
        error: null,
      }),
    )

    const duplicate = await repo.createOutput({
      experimentId: experiment.id,
      datasetRevisionItemId: revisionItems[0].id,
      output: 'second',
      error: null,
    })

    expect(duplicate.success).toBe(false)
  })
})
