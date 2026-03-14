# Eval Harness API

Hono REST API for the eval harness. Manages datasets, graders, and experiments.

## Quick Start

```bash
# From monorepo root
pnpm dev
```

API runs on `http://localhost:3001` (configurable via `API_PORT` env var).

## Architecture

Each domain follows the layered module pattern:

```
datasets/
  validator.ts    — Zod schemas for request validation
  repository.ts   — Prisma queries, returns Result<T>
  service.ts      — Business logic, returns Result<T>
  router.ts       — HTTP layer, maps Result to status codes
```

Same pattern for `graders/` and `experiments/`.

## API Endpoints

### Datasets

| Method | Path                                | Description            |
| ------ | ----------------------------------- | ---------------------- |
| GET    | /datasets                           | List all datasets      |
| POST   | /datasets                           | Create dataset         |
| GET    | /datasets/:id                       | Get dataset with items |
| PATCH  | /datasets/:id                       | Rename dataset         |
| DELETE | /datasets/:id                       | Soft-delete dataset    |
| POST   | /datasets/:id/attributes            | Add attribute          |
| DELETE | /datasets/:id/attributes/:name      | Remove attribute       |
| GET    | /datasets/:id/revisions             | List revisions         |
| GET    | /datasets/:id/revisions/:revisionId | Get revision detail    |
| GET    | /datasets/:id/csv/template          | Download CSV template  |
| POST   | /datasets/:id/csv/import            | Import items from CSV  |
| GET    | /datasets/:id/csv/export            | Export items as CSV    |

### Graders

| Method | Path         | Description        |
| ------ | ------------ | ------------------ |
| GET    | /graders     | List all graders   |
| POST   | /graders     | Create grader      |
| GET    | /graders/:id | Get grader         |
| PATCH  | /graders/:id | Update grader      |
| DELETE | /graders/:id | Soft-delete grader |

### Experiments

| Method | Path                        | Description                      |
| ------ | --------------------------- | -------------------------------- |
| GET    | /experiments                | List all experiments             |
| POST   | /experiments                | Create experiment (auto-runs)    |
| GET    | /experiments/:id            | Get experiment with results      |
| DELETE | /experiments/:id            | Delete experiment                |
| POST   | /experiments/:id/rerun      | Re-run (creates new + auto-runs) |
| GET    | /experiments/:id/events     | SSE stream for progress          |
| GET    | /experiments/:id/csv/export | Export results as CSV            |

## Environment Variables

| Variable           | Required                | Default | Description                  |
| ------------------ | ----------------------- | ------- | ---------------------------- |
| DATABASE_URL       | Yes                     | —       | PostgreSQL connection string |
| OPENROUTER_API_KEY | For running experiments | —       | OpenRouter API key           |
| API_PORT           | No                      | 3001    | Server port                  |
| LOG_LEVEL          | No                      | info    | Pino log level (debug, info, warn, error) |

## Testing

```bash
# Unit tests
pnpm --filter api run test

# From monorepo root
pnpm test
```

See [docs/test.yml](../../docs/test.yml) for curl-based smoke tests.
