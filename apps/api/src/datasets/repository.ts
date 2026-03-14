import { prisma } from '../lib/prisma.js'
import { ok, tryCatch } from '@eval-harness/shared'
import { randomUUID } from 'crypto'

/** Returns the most recent revision for a dataset. Throws if no revisions exist. */
async function getLatestRevisionOrThrow(datasetId: string) {
  return prisma.datasetRevision.findFirstOrThrow({
    where: { datasetId },
    orderBy: { createdAt: 'desc' },
    include: { items: { orderBy: { createdAt: 'asc' } } },
  })
}

async function createRevision(
  datasetId: string,
  options: {
    schemaVersionDelta: number
    attributes: string[]
    items: Array<{ itemId: string; values: Record<string, string>; createdAt?: Date }>
    currentSchemaVersion?: number
  },
) {
  const baseVersion =
    options.currentSchemaVersion ??
    (
      await prisma.datasetRevision.findFirst({
        where: { datasetId },
        orderBy: { createdAt: 'desc' },
      })
    )?.schemaVersion ??
    0
  const newSchemaVersion = baseVersion + options.schemaVersionDelta

  return prisma.datasetRevision.create({
    data: {
      datasetId,
      schemaVersion: newSchemaVersion,
      attributes: options.attributes,
      items: {
        create: options.items.map((item) => ({
          itemId: item.itemId,
          values: item.values,
          ...(item.createdAt !== undefined ? { createdAt: item.createdAt } : {}),
        })),
      },
    },
    include: { items: { orderBy: { createdAt: 'asc' } } },
  })
}

type RevisionWithItems = Awaited<ReturnType<typeof createRevision>>

async function buildDatasetResponse(datasetId: string, revision: RevisionWithItems) {
  const dataset = await prisma.dataset.findUniqueOrThrow({ where: { id: datasetId } })
  return {
    id: dataset.id,
    name: dataset.name,
    attributes: revision.attributes,
    schemaVersion: revision.schemaVersion,
    items: revision.items,
  }
}

export const datasetRepository = {
  async findAll() {
    return tryCatch(async () => {
      const datasets = await prisma.dataset.findMany({
        orderBy: { name: 'asc' },
        include: {
          revisions: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: { _count: { select: { items: true } } },
          },
        },
      })

      return ok(
        datasets.map((ds) => ({
          id: ds.id,
          name: ds.name,
          attributes: ds.revisions[0]?.attributes ?? [],
          itemCount: ds.revisions[0]?._count.items ?? 0,
        })),
      )
    })
  },

  async findById(id: string) {
    return tryCatch(async () => {
      const latest = await getLatestRevisionOrThrow(id)
      return ok(await buildDatasetResponse(id, latest))
    })
  },

  /** Returns null when no match — used by services to check name availability. */
  findByName(name: string) {
    return prisma.dataset.findUnique({ where: { name } })
  },

  async create(name: string) {
    return tryCatch(async () => {
      const dataset = await prisma.dataset.create({ data: { name } })

      const revision = await createRevision(dataset.id, {
        schemaVersionDelta: 1,
        attributes: ['input', 'expected_output'],
        items: [],
      })

      return ok(await buildDatasetResponse(dataset.id, revision))
    })
  },

  async update(id: string, name: string) {
    return tryCatch(async () => {
      const dataset = await prisma.dataset.update({ where: { id }, data: { name } })
      return ok(dataset)
    })
  },

  async remove(id: string) {
    return tryCatch(async () => {
      await prisma.dataset.delete({ where: { id } })
      return ok({ deleted: true as const })
    })
  },

  async addAttribute(id: string, attributeName: string) {
    return tryCatch(async () => {
      const latest = await getLatestRevisionOrThrow(id)

      const newAttributes = [...latest.attributes, attributeName]
      const newItems = latest.items.map((item) => ({
        itemId: item.itemId,
        values: { ...(item.values as Record<string, string>), [attributeName]: '' },
        createdAt: item.createdAt,
      }))

      const revision = await createRevision(id, {
        schemaVersionDelta: 1,
        attributes: newAttributes,
        items: newItems,
        currentSchemaVersion: latest.schemaVersion,
      })

      return ok(await buildDatasetResponse(id, revision))
    })
  },

  async removeAttribute(id: string, attributeName: string) {
    return tryCatch(async () => {
      const latest = await getLatestRevisionOrThrow(id)

      const newAttributes = latest.attributes.filter((a) => a !== attributeName)
      const newItems = latest.items.map((item) => {
        const values = { ...(item.values as Record<string, string>) }
        delete values[attributeName]
        return { itemId: item.itemId, values, createdAt: item.createdAt }
      })

      const revision = await createRevision(id, {
        schemaVersionDelta: 1,
        attributes: newAttributes,
        items: newItems,
        currentSchemaVersion: latest.schemaVersion,
      })

      return ok(await buildDatasetResponse(id, revision))
    })
  },

  async findItemsByDatasetId(datasetId: string) {
    return tryCatch(async () => {
      const latest = await getLatestRevisionOrThrow(datasetId)
      return ok(latest.items)
    })
  },

  async findItemById(itemId: string) {
    return tryCatch(async () => {
      const item = await prisma.datasetRevisionItem.findFirstOrThrow({
        where: { itemId },
        orderBy: { revision: { createdAt: 'desc' } },
      })
      return ok(item)
    })
  },

  async createItem(datasetId: string, values: Record<string, string>) {
    return tryCatch(async () => {
      const latest = await getLatestRevisionOrThrow(datasetId)

      const newItemId = randomUUID()
      const existingItems = latest.items.map((item) => ({
        itemId: item.itemId,
        values: item.values as Record<string, string>,
        createdAt: item.createdAt,
      }))

      const revision = await createRevision(datasetId, {
        schemaVersionDelta: 0,
        attributes: latest.attributes,
        items: [...existingItems, { itemId: newItemId, values }],
      })

      return ok(revision.items.find((i) => i.itemId === newItemId)!)
    })
  },

  async updateItem(itemId: string, values: Record<string, string>) {
    return tryCatch(async () => {
      const existingItem = await prisma.datasetRevisionItem.findFirstOrThrow({
        where: { itemId },
        orderBy: { revision: { createdAt: 'desc' } },
        include: { revision: true },
      })

      const datasetId = existingItem.revision.datasetId
      const latest = await getLatestRevisionOrThrow(datasetId)

      const newItems = latest.items.map((item) => ({
        itemId: item.itemId,
        values: item.itemId === itemId ? values : (item.values as Record<string, string>),
        createdAt: item.createdAt,
      }))

      const revision = await createRevision(datasetId, {
        schemaVersionDelta: 0,
        attributes: latest.attributes,
        items: newItems,
      })

      return ok(revision.items.find((i) => i.itemId === itemId)!)
    })
  },

  async removeItem(itemId: string) {
    return tryCatch(async () => {
      const existingItem = await prisma.datasetRevisionItem.findFirstOrThrow({
        where: { itemId },
        orderBy: { revision: { createdAt: 'desc' } },
        include: { revision: true },
      })

      const datasetId = existingItem.revision.datasetId
      const latest = await getLatestRevisionOrThrow(datasetId)

      const newItems = latest.items
        .filter((item) => item.itemId !== itemId)
        .map((item) => ({
          itemId: item.itemId,
          values: item.values as Record<string, string>,
          createdAt: item.createdAt,
        }))

      await createRevision(datasetId, {
        schemaVersionDelta: 0,
        attributes: latest.attributes,
        items: newItems,
      })

      return ok({ deleted: true as const })
    })
  },

  async countItems(datasetId: string) {
    return tryCatch(async () => {
      const latest = await getLatestRevisionOrThrow(datasetId)
      return ok(latest.items.length)
    })
  },

  async importItems(datasetId: string, valuesArray: Record<string, string>[]) {
    return tryCatch(async () => {
      const latest = await getLatestRevisionOrThrow(datasetId)

      const existingItems = latest.items.map((item) => ({
        itemId: item.itemId,
        values: item.values as Record<string, string>,
        createdAt: item.createdAt,
      }))

      const newItems = valuesArray.map((values) => ({
        itemId: randomUUID(),
        values,
      }))

      const revision = await createRevision(datasetId, {
        schemaVersionDelta: 0,
        attributes: latest.attributes,
        items: [...existingItems, ...newItems],
      })

      return ok(revision)
    })
  },

  async findRevisions(datasetId: string) {
    return tryCatch(async () => {
      const revisions = await prisma.datasetRevision.findMany({
        where: { datasetId },
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { items: true, experiments: true } } },
      })

      return ok(
        revisions.map((r, i) => ({
          id: r.id,
          schemaVersion: r.schemaVersion,
          attributes: r.attributes,
          createdAt: r.createdAt,
          itemCount: r._count.items,
          experimentCount: r._count.experiments,
          isCurrent: i === 0,
        })),
      )
    })
  },

  async findRevisionById(datasetId: string, revisionId: string) {
    return tryCatch(async () => {
      const revision = await prisma.datasetRevision.findFirstOrThrow({
        where: { id: revisionId, datasetId },
        include: {
          items: { orderBy: { createdAt: 'asc' } },
          experiments: { select: { id: true, name: true, status: true } },
        },
      })

      return ok({
        id: revision.id,
        schemaVersion: revision.schemaVersion,
        attributes: revision.attributes,
        createdAt: revision.createdAt,
        items: revision.items,
        experiments: revision.experiments,
      })
    })
  },
}
