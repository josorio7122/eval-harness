# executor+executor+executor dispatch

## Task
[executor] ## Objective
Set up `packages/shared` at `/Users/josorio/Code/mini-skills/packages/shared` — the shared TypeScript package for Result type, Zod schemas, and API contract types.

## Steps

1. cd into `packages/shared`
2. Run `pnpm init` to create package.json
3. Use npm pkg set to configure:
   ```bash
   npm pkg set name="@eval-harness/shared"
   npm pkg set private=true
   npm pkg set type="module"
   npm pkg set main="./src/index.ts"
   npm pkg set types="./src/index.ts"
   ```
   A

## Output
## Executor #1: ## Objective
Set up `packages/shared` at `/Users/josorio/Code/mini-skills/packages/shared` — the shared TypeScript package for Result type, Zod schemas, and API contract types.

## Steps

1. cd into `packages/shared`
2. Run `pnpm init` to create package.json
3. Use npm pkg set to configure:
   ```bash
   npm pkg set name="@eval-harness/shared"
   npm pkg set private=true
   npm pkg set type="module"
   npm pkg set main="./src/index.ts"
   npm pkg set types="./src/index.ts"
   ```
   Also set exports: `npm pkg set exports='{ ".": "./src/index.ts" }' --json`

4. Add dependencies:
   ```bash
   pnpm add zod@latest
   pnpm add -D typescript@latest
   ```

5. Create tsconfig.json — since packages/typescript-config exists, check if there's a base config we can extend. If so, extend it. If not, create minimal strict tsconfig:
   ```bash
   cat ../typescript-config/*.json
   ```
   Then write `tsconfig.json` that extends the base config and sets:
   - `compilerOptions.outDir: "./dist"`
   - `include: ["src"]`

6. Create the source files:

   **`src/index.ts`** — re-exports everything:
   ```ts
   export { ok, fail } from './result.js'
   export type { Result } from './result.js'
   ```

   **`src/result.ts`** — the Result pattern:
   ```ts
   export type Result<T, E = string> =
     | { success: true; data: T }
     | { success: false; error: E }

   export const ok = <T>(data: T): Result<T, never> => ({ success: true, data })
   export const fail = <E = string>(error: E): Result<never, E> => ({ success: false, error })
   ```

7. Do NOT commit yet — we'll batch commit with other setup.

## Boundaries
- Do NOT add Zod schemas yet (we'll add them per module)
- Do NOT hand-write package.json — use npm pkg set
- Keep it minimal — just Result type for now
Everything is clean. Here's a summary of what was done:

**`packages/shared` is ready (no commit yet, as instructed)**

### Files created

- `package.json` — `@eval-harness/shared`, `private: true`, `type: "module"`, points `main`/`types`/`exports` all at `src/index.ts`
- `tsconfig.json` — extends `@repo/typescript-config/base.json`, sets `outDir: ./dist`, includes `src/`
- `src/result.ts` — `Result<T, E>` union type + `ok()` and `fail()` constructors
- `src/index.ts` — re-exports `ok`, `fail`, and `Result` from `result.js`

### Dependencies installed

- `zod@4.3.6` (runtime)
- `typescript@5.9.3` (dev)

### Deviation

- `@repo/typescript-config` is the correct package name (not `@eval-harness/typescript-config`) — the extends path in `tsconfig.json` was fixed accordingly.

## Executor #2: ## Objective
Set up `packages/db` at `/Users/josorio/Code/mini-skills/packages/db` — the Prisma database package.

## Steps

1. cd into `packages/db`
2. Run `pnpm init` to create package.json
3. Use npm pkg set to configure:
   ```bash
   npm pkg set name="@eval-harness/db"
   npm pkg set private=true
   npm pkg set type="module"
   npm pkg set main="./src/index.ts"
   npm pkg set types="./src/index.ts"
   ```
   Also set exports: `npm pkg set exports='{ ".": "./src/index.ts" }' --json`

4. Add dependencies:
   ```bash
   pnpm add prisma@latest @prisma/client@latest
   pnpm add -D typescript@latest
   ```

5. Initialize Prisma:
   ```bash
   pnpm exec prisma init --datasource-provider postgresql
   ```
   This creates `prisma/schema.prisma` and possibly a `.env` file.

6. If prisma init created a `.env` in packages/db, delete it — we use the root .env.

7. Edit the Prisma schema (`prisma/schema.prisma`) to define ALL 5 entities per the data model. Read the implementation doc at `/Users/josorio/Code/mini-skills/docs/implementation.md` for exact types:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Dataset {
  id         String        @id @default(uuid()) @db.Uuid
  name       String        @unique
  attributes String[]      @default(["input", "expected_output"])
  items      DatasetItem[]
  experiments Experiment[]
}

model DatasetItem {
  id        String   @id @default(uuid()) @db.Uuid
  datasetId String   @db.Uuid
  values    Json
  dataset   Dataset  @relation(fields: [datasetId], references: [id], onDelete: Cascade)
  results   ExperimentResult[]

  @@index([datasetId])
}

model Grader {
  id          String   @id @default(uuid()) @db.Uuid
  name        String   @unique
  description String   @default("")
  rubric      String
  experiments ExperimentGrader[]
  results     ExperimentResult[]
}

model Experiment {
  id        String   @id @default(uuid()) @db.Uuid
  name      String
  datasetId String   @db.Uuid
  status    String   @default("queued")
  dataset   Dataset  @relation(fields: [datasetId], references: [id], onDelete: Cascade)
  graders   ExperimentGrader[]
  results   ExperimentResult[]

  @@index([datasetId])
}

model ExperimentGrader {
  experimentId String     @db.Uuid
  graderId     String     @db.Uuid
  experiment   Experiment @relation(fields: [experimentId], references: [id], onDelete: Cascade)
  grader       Grader     @relation(fields: [graderId], references: [id], onDelete: Cascade)

  @@id([experimentId, graderId])
  @@index([graderId])
}

model ExperimentResult {
  id            String      @id @default(uuid()) @db.Uuid
  experimentId  String      @db.Uuid
  datasetItemId String      @db.Uuid
  graderId      String      @db.Uuid
  verdict       String
  reason        String      @default("")
  experiment    Experiment  @relation(fields: [experimentId], references: [id], onDelete: Cascade)
  datasetItem   DatasetItem @relation(fields: [datasetItemId], references: [id], onDelete: Cascade)
  grader        Grader      @relation(fields: [graderId], references: [id], onDelete: Cascade)

  @@unique([experimentId, datasetItemId, graderId])
  @@index([experimentId])
  @@index([datasetItemId])
  @@index([graderId])
}
```

Note: The spec says `graderIds: uuid[]` on Experiment, but Prisma many-to-many needs a join table. Use `ExperimentGrader` as the join table.

8. Create `src/index.ts`:
```ts
export { PrismaClient } from '@prisma/client'
export type { Dataset, DatasetItem, Grader, Experiment, ExperimentGrader, ExperimentResult } from '@prisma/client'
```

9. Check for tsconfig — extend from typescript-config if available (check `cat ../typescript-config/*.json`). Write tsconfig.json that extends the base.

10. Do NOT run prisma migrate yet (no DB running). Do NOT commit yet.

## Boundaries
- Use the EXACT data model from implementation.md
- graderIds array on Experiment becomes ExperimentGrader join table
- All IDs are UUID
- Cascade deletes on all foreign keys
- Do NOT hand-write package.json — use npm pkg set
Everything is in order. Here's a summary of what was done:

## Task Complete: packages/db setup

**Status:** done
**Commit:** (not committed per task instructions — "Do NOT commit yet")

### What was done

- Ran `pnpm init` to scaffold `package.json`
- Configured package via `npm pkg set`: name `@eval-harness/db`, private, ESM, main/types/exports pointing to `./src/index.ts`
- Added `prisma@7.5.0`, `@prisma/client@7.5.0`, `dotenv@17.3.1` as deps; `typescript@5.9.3` as devDep
- Ran `pnpm exec prisma init --datasource-provider postgresql` (Prisma 7 CLI)
- Deleted the generated `.env` (we use the root `.env`)
- Updated `prisma.config.ts` to load from `../../.env` (monorepo root) instead of a local `.env`
- Wrote `prisma/schema.prisma` with all 5 models: `Dataset`, `DatasetItem`, `Grader`, `Experiment`, `ExperimentGrader` (join table), `ExperimentResult` — all UUIDs, cascade deletes, proper indexes and unique constraints
- Created `src/index.ts` re-exporting `PrismaClient` and all entity types from the generated client path
- Created `tsconfig.json` extending `@repo/typescript-config/base.json`
- Validated schema: ✅ `The schema at prisma/schema.prisma is valid 🚀`

### Files changed

- `package.json`: Configured via CLI — `@eval-harness/db`, private, ESM module
- `prisma/schema.prisma`: All 5 entities with UUIDs, cascade deletes, indexes — Prisma 7 format (no `url` in datasource, uses `prisma.config.ts`)
- `prisma.config.ts`: Updated to load `DATABASE_URL` from monorepo root `.env`
- `src/index.ts`: Re-exports `PrismaClient` + all 6 entity types
- `tsconfig.json`: Extends `@repo/typescript-config/base.json`

### Deviations

- **[Rule 3 - Blocker] Prisma 7 schema format differs from plan**: Prisma 7 generates `provider = "prisma-client"` (not `"prisma-client-js"`) and moves `datasource.url` out of `schema.prisma` into `prisma.config.ts`. Adapted the schema accordingly while keeping all model definitions identical to the spec.
- **[Rule 2 - Critical] Root `.env` loading**: Added `dotenv` dependency and updated `prisma.config.ts` to explicitly resolve `../../.env` (monorepo root), ensuring `DATABASE_URL` is found when running Prisma commands from `packages/db`.

## Executor #3: ## Objective
Create Docker Compose for PostgreSQL and .env files at `/Users/josorio/Code/mini-skills`.

## Steps

1. Write `docker-compose.yml` at the monorepo root:
```yaml
services:
  postgres:
    image: postgres:17
    container_name: eval-harness-db
    environment:
      POSTGRES_USER: eval
      POSTGRES_PASSWORD: eval
      POSTGRES_DB: eval_harness
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

2. Write `.env.example` at the monorepo root:
```env
# Database
DATABASE_URL="postgresql://eval:eval@localhost:5432/eval_harness"

# LLM
OPENROUTER_API_KEY="sk-or-v1-your-key-here"
LLM_JUDGE_MODEL="google/gemini-2.5-flash-preview"

# API
API_PORT=3001

# Frontend
VITE_API_URL="http://localhost:3001"
```

3. Write `.env` at the monorepo root (actual values):
```env
# Database
DATABASE_URL="postgresql://eval:eval@localhost:5432/eval_harness"

# LLM
OPENROUTER_API_KEY=""
LLM_JUDGE_MODEL="google/gemini-2.5-flash-preview"

# API
API_PORT=3001

# Frontend
VITE_API_URL="http://localhost:3001"
```
Note: OPENROUTER_API_KEY is empty — user will fill it from their .zshrc.

4. Make sure `.env` is in `.gitignore`. Read the current `.gitignore` and add `.env` if not present. Also add:
   - `.env` 
   - `!.env.example`

5. Do NOT commit yet.

## Boundaries
- PostgreSQL 17 (latest stable)
- Credentials match what's in .env: eval/eval/eval_harness
- Port 5432 standard
- .env never committed, .env.example always committed
Git confirms: `.env` is ignored, `.env.example` is explicitly un-ignored (tracked), and `docker-compose.yml` is not ignored (tracked). All good.

---

Here's what was created:

**`docker-compose.yml`** — PostgreSQL 17 service with `eval-harness-db` container, credentials `eval/eval/eval_harness`, port `5432`, and a named `pgdata` volume.

**`.env.example`** — Template with placeholder `OPENROUTER_API_KEY` — safe to commit.

**`.env`** — Live config with empty `OPENROUTER_API_KEY` for the user to fill from `.zshrc` — never committed.

**`.gitignore`** — Added `!.env.example` right after the `.env` rule so the example file is always tracked despite the broad `.env` ignore pattern.

To start Postgres: `docker compose up -d`
