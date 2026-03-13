import { prisma } from '../lib/prisma.js'
import { randomUUID } from 'crypto'

async function getLatestRevision(datasetId: string) {
  return prisma.datasetRevision.findFirst({
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
    options.currentSchemaVersion ?? (await getLatestRevision(datasetId))?.schemaVersion ?? 0
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

export const datasetRepository = {
  async findAll() {
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

    return datasets.map((ds) => ({
      id: ds.id,
      name: ds.name,
      itemCount: ds.revisions[0]?._count.items ?? 0,
    }))
  },

  async findById(id: string) {
    const dataset = await prisma.dataset.findUnique({ where: { id } })
    if (!dataset) return null

    const latest = await getLatestRevision(id)
    if (!latest) return null

    return {
      id: dataset.id,
      name: dataset.name,
      attributes: latest.attributes,
      schemaVersion: latest.schemaVersion,
      items: latest.items,
    }
  },

  findByName(name: string) {
    return prisma.dataset.findUnique({ where: { name } })
  },

  async create(name: string) {
    const dataset = await prisma.dataset.create({ data: { name } })

    const revision = await createRevision(dataset.id, {
      schemaVersionDelta: 1,
      attributes: ['input', 'expected_output'],
      items: [],
    })

    return {
      id: dataset.id,
      name: dataset.name,
      attributes: revision.attributes,
      schemaVersion: revision.schemaVersion,
      items: revision.items,
    }
  },

  async update(id: string, name: string) {
    return prisma.dataset.update({ where: { id }, data: { name } })
  },

  async remove(id: string) {
    return prisma.dataset.delete({ where: { id } })
  },

  async addAttribute(id: string, attributeName: string) {
    const latest = await getLatestRevision(id)
    if (!latest) throw new Error('Dataset has no revisions')

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

    const dataset = await prisma.dataset.findUniqueOrThrow({ where: { id } })
    return {
      id: dataset.id,
      name: dataset.name,
      attributes: revision.attributes,
      schemaVersion: revision.schemaVersion,
      items: revision.items,
    }
  },

  async removeAttribute(id: string, attributeName: string) {
    const latest = await getLatestRevision(id)
    if (!latest) throw new Error('Dataset has no revisions')

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

    const dataset = await prisma.dataset.findUniqueOrThrow({ where: { id } })
    return {
      id: dataset.id,
      name: dataset.name,
      attributes: revision.attributes,
      schemaVersion: revision.schemaVersion,
      items: revision.items,
    }
  },

  async findItemsByDatasetId(datasetId: string) {
    const latest = await getLatestRevision(datasetId)
    return latest?.items ?? []
  },

  async findItemById(itemId: string) {
    const item = await prisma.datasetRevisionItem.findFirst({
      where: { itemId },
      orderBy: { revision: { createdAt: 'desc' } },
    })
    return item
  },

  async createItem(datasetId: string, values: Record<string, string>) {
    const latest = await getLatestRevision(datasetId)
    if (!latest) throw new Error('Dataset has no revisions')

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

    return revision.items.find((i) => i.itemId === newItemId)!
  },

  async updateItem(itemId: string, values: Record<string, string>) {
    const existingItem = await prisma.datasetRevisionItem.findFirst({
      where: { itemId },
      orderBy: { revision: { createdAt: 'desc' } },
      include: { revision: true },
    })
    if (!existingItem) throw new Error('Item not found')

    const datasetId = existingItem.revision.datasetId
    const latest = await getLatestRevision(datasetId)
    if (!latest) throw new Error('Dataset has no revisions')

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

    return revision.items.find((i) => i.itemId === itemId)!
  },

  async removeItem(itemId: string) {
    const existingItem = await prisma.datasetRevisionItem.findFirst({
      where: { itemId },
      orderBy: { revision: { createdAt: 'desc' } },
      include: { revision: true },
    })
    if (!existingItem) throw new Error('Item not found')

    const datasetId = existingItem.revision.datasetId
    const latest = await getLatestRevision(datasetId)
    if (!latest) throw new Error('Dataset has no revisions')

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
  },

  async countItems(datasetId: string) {
    const latest = await getLatestRevision(datasetId)
    return latest?.items.length ?? 0
  },

  async importItems(datasetId: string, valuesArray: Record<string, string>[]) {
    const latest = await getLatestRevision(datasetId)
    if (!latest) throw new Error('Dataset has no revisions')

    const existingItems = latest.items.map((item) => ({
      itemId: item.itemId,
      values: item.values as Record<string, string>,
      createdAt: item.createdAt,
    }))

    const newItems = valuesArray.map((values) => ({
      itemId: randomUUID(),
      values,
    }))

    await createRevision(datasetId, {
      schemaVersionDelta: 0,
      attributes: latest.attributes,
      items: [...existingItems, ...newItems],
    })
  },

  async findRevisions(datasetId: string) {
    const revisions = await prisma.datasetRevision.findMany({
      where: { datasetId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { items: true, experiments: true } } },
    })

    return revisions.map((r, i) => ({
      id: r.id,
      schemaVersion: r.schemaVersion,
      attributes: r.attributes,
      createdAt: r.createdAt,
      itemCount: r._count.items,
      experimentCount: r._count.experiments,
      isCurrent: i === 0,
    }))
  },

  async findRevisionById(datasetId: string, revisionId: string) {
    const revision = await prisma.datasetRevision.findFirst({
      where: { id: revisionId, datasetId },
      include: {
        items: { orderBy: { createdAt: 'asc' } },
        experiments: { select: { id: true, name: true, status: true } },
      },
    })
    if (!revision) return null

    return {
      id: revision.id,
      schemaVersion: revision.schemaVersion,
      attributes: revision.attributes,
      createdAt: revision.createdAt,
      items: revision.items,
      experiments: revision.experiments,
    }
  },
}
