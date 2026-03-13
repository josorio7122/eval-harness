import { prisma } from '../lib/prisma.js'

export const datasetRepository = {
  findAll() {
    return prisma.dataset.findMany({ orderBy: { name: 'asc' } })
  },

  findById(id: string) {
    return prisma.dataset.findUnique({ where: { id }, include: { items: true } })
  },

  findByName(name: string) {
    return prisma.dataset.findUnique({ where: { name } })
  },

  create(name: string) {
    return prisma.dataset.create({ data: { name } })
  },

  update(id: string, name: string) {
    return prisma.dataset.update({ where: { id }, data: { name } })
  },

  remove(id: string) {
    return prisma.dataset.delete({ where: { id } })
  },

  async addAttribute(id: string, attributeName: string) {
    const dataset = await prisma.dataset.findUniqueOrThrow({ where: { id } })
    const newAttributes = [...dataset.attributes, attributeName]

    await prisma.$transaction([
      prisma.dataset.update({
        where: { id },
        data: { attributes: newAttributes },
      }),
      prisma.$executeRaw`
        UPDATE "DatasetItem"
        SET values = values || ${JSON.stringify({ [attributeName]: '' })}::jsonb
        WHERE "datasetId" = ${id}::uuid
      `,
    ])

    return prisma.dataset.findUniqueOrThrow({ where: { id } })
  },

  async removeAttribute(id: string, attributeName: string) {
    const dataset = await prisma.dataset.findUniqueOrThrow({ where: { id } })
    const newAttributes = dataset.attributes.filter((a) => a !== attributeName)

    await prisma.$transaction([
      prisma.dataset.update({
        where: { id },
        data: { attributes: newAttributes },
      }),
      prisma.$executeRaw`
        UPDATE "DatasetItem"
        SET values = values - ${attributeName}
        WHERE "datasetId" = ${id}::uuid
      `,
    ])

    return prisma.dataset.findUniqueOrThrow({ where: { id } })
  },

  findItemsByDatasetId(datasetId: string) {
    return prisma.datasetItem.findMany({ where: { datasetId } })
  },

  findItemById(id: string) {
    return prisma.datasetItem.findUnique({ where: { id } })
  },

  createItem(datasetId: string, values: Record<string, string>) {
    return prisma.datasetItem.create({ data: { datasetId, values } })
  },

  updateItem(id: string, values: Record<string, string>) {
    return prisma.datasetItem.update({ where: { id }, data: { values } })
  },

  removeItem(id: string) {
    return prisma.datasetItem.delete({ where: { id } })
  },

  countItems(datasetId: string) {
    return prisma.datasetItem.count({ where: { datasetId } })
  },
}
