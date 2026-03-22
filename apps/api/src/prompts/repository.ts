import { type PrismaClient } from '@eval-harness/db'
import { ok, tryCatch } from '@eval-harness/shared'

type ModelParams = {
  temperature?: number
  maxTokens?: number
  topP?: number
}

type CreatePromptInput = {
  name: string
  systemPrompt: string
  userPrompt: string
  modelId: string
  modelParams?: ModelParams
}

type CreateVersionInput = {
  systemPrompt: string
  userPrompt: string
  modelId: string
  modelParams?: ModelParams
}

export function createPromptRepository(prisma: PrismaClient) {
  return {
    findAll() {
      return tryCatch(async () => {
        const prompts = await prisma.prompt.findMany({
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            versions: {
              select: {
                id: true,
                promptId: true,
                version: true,
                systemPrompt: true,
                userPrompt: true,
                modelId: true,
                modelParams: true,
                createdAt: true,
              },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
            _count: {
              select: { versions: true },
            },
          },
        })

        const result = prompts
          .map((p) => ({
            id: p.id,
            name: p.name,
            versionCount: p._count.versions,
            latestVersion: p.versions[0] ?? null,
          }))
          .sort((a, b) => {
            const aTime = a.latestVersion?.createdAt.getTime() ?? 0
            const bTime = b.latestVersion?.createdAt.getTime() ?? 0
            return bTime - aTime
          })

        return ok(result)
      })
    },

    findById(id: string) {
      return tryCatch(async () => {
        const prompt = await prisma.prompt.findFirstOrThrow({
          where: { id, deletedAt: null },
          select: {
            id: true,
            name: true,
            versions: {
              select: {
                id: true,
                promptId: true,
                version: true,
                systemPrompt: true,
                userPrompt: true,
                modelId: true,
                modelParams: true,
                createdAt: true,
              },
              orderBy: { version: 'desc' },
            },
          },
        })
        return ok(prompt)
      })
    },

    /** Returns null when no match — used by services to check name availability. */
    findByName(name: string) {
      return prisma.prompt.findFirst({
        where: { name, deletedAt: null },
        select: { id: true, name: true },
      })
    },

    create(input: CreatePromptInput) {
      return tryCatch(async () => {
        const prompt = await prisma.$transaction(async (tx) => {
          const created = await tx.prompt.create({
            data: { name: input.name },
            select: { id: true, name: true },
          })

          const version = await tx.promptVersion.create({
            data: {
              promptId: created.id,
              version: 1,
              systemPrompt: input.systemPrompt,
              userPrompt: input.userPrompt,
              modelId: input.modelId,
              modelParams: input.modelParams ?? {},
            },
            select: {
              id: true,
              promptId: true,
              version: true,
              systemPrompt: true,
              userPrompt: true,
              modelId: true,
              modelParams: true,
              createdAt: true,
            },
          })

          return { ...created, versions: [version] }
        })

        return ok(prompt)
      })
    },

    updateName(id: string, name: string) {
      return tryCatch(async () => {
        const prompt = await prisma.prompt.update({
          where: { id },
          data: { name },
          select: {
            id: true,
            name: true,
            deletedAt: true,
          },
        })
        return ok(prompt)
      })
    },

    createVersion(promptId: string, input: CreateVersionInput) {
      return tryCatch(async () => {
        const aggregate = await prisma.promptVersion.aggregate({
          where: { promptId },
          _max: { version: true },
        })

        const nextVersion = (aggregate._max.version ?? 0) + 1

        const version = await prisma.promptVersion.create({
          data: {
            promptId,
            version: nextVersion,
            systemPrompt: input.systemPrompt,
            userPrompt: input.userPrompt,
            modelId: input.modelId,
            modelParams: input.modelParams ?? {},
          },
          select: {
            id: true,
            promptId: true,
            version: true,
            systemPrompt: true,
            userPrompt: true,
            modelId: true,
            modelParams: true,
            createdAt: true,
          },
        })

        return ok(version)
      })
    },

    findLatestVersion(promptId: string) {
      return tryCatch(async () => {
        await prisma.prompt.findFirstOrThrow({ where: { id: promptId, deletedAt: null } })
        const version = await prisma.promptVersion.findFirstOrThrow({
          where: { promptId },
          orderBy: { version: 'desc' },
          select: {
            id: true,
            promptId: true,
            version: true,
            systemPrompt: true,
            userPrompt: true,
            modelId: true,
            modelParams: true,
            createdAt: true,
          },
        })
        return ok(version)
      })
    },

    findVersionById(promptId: string, versionId: string) {
      return tryCatch(async () => {
        const version = await prisma.promptVersion.findFirstOrThrow({
          where: { id: versionId, promptId },
          select: {
            id: true,
            promptId: true,
            version: true,
            systemPrompt: true,
            userPrompt: true,
            modelId: true,
            modelParams: true,
            createdAt: true,
          },
        })
        return ok(version)
      })
    },

    remove(id: string) {
      return tryCatch(async () => {
        await prisma.prompt.findFirstOrThrow({ where: { id, deletedAt: null } })
        await prisma.prompt.update({
          where: { id },
          data: { deletedAt: new Date() },
        })
        return ok({ deleted: true as const })
      })
    },
  }
}
