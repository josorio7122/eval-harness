# Implementation Plan — Eval Harness

## Phases

### Phase 1: Monorepo Scaffolding
1. Scaffold Turborepo monorepo (`pnpm dlx create-turbo@latest`)
2. Create `packages/db` — Prisma schema matching data model (5 entities)
3. Create `packages/shared` — Result type, Zod schemas, API contract types
4. Docker Compose for PostgreSQL
5. `.env` + `.env.example` at root
6. ESLint + Prettier config (no-any rule)

### Phase 2: Backend — Datasets Module (TDD)
7. Scaffold Hono app in `apps/api`
8. Datasets: validator.ts (Zod schemas)
9. Datasets: repository.ts (Prisma CRUD)
10. Datasets: service.ts (Result pattern, business logic)
11. Datasets: router.ts (HTTP endpoints)
12. Dataset items: validator, repository, service, router
13. Dataset attributes: add/remove with schema conformance
14. Dataset CSV: template, import, export

### Phase 3: Backend — Graders Module (TDD)
15. Graders: validator.ts
16. Graders: repository.ts
17. Graders: service.ts
18. Graders: router.ts

### Phase 4: Backend — Experiments Module (TDD)
19. Experiments: validator.ts
20. Experiments: repository.ts + ExperimentResult repository
21. Experiments: service.ts (create, delete, rerun)
22. Experiments: router.ts (CRUD endpoints)
23. LLM integration (Vercel AI SDK + OpenRouter)
24. Evaluation queue (p-queue two-level)
25. SSE endpoint (GET /experiments/:id/events)
26. Experiment run orchestration (POST /experiments/:id/run)

### Phase 5: Frontend — Shell & Design System
27. Scaffold Vite + React app in `apps/web`
28. Install shadcn/ui, Tailwind v4, TanStack deps, Tremor, Motion, Lucide
29. Design system tokens (CSS custom properties from .interface-design/system.md)
30. App shell: sidebar navigation, layout

### Phase 6: Frontend — Datasets UI
31. Dataset list page (TanStack Table)
32. Dataset detail page (schema panel + items table)
33. Create/edit dataset forms (TanStack Form + Zod)
34. Add/remove attribute UI
35. CSV import/export UI

### Phase 7: Frontend — Graders UI
36. Grader list page
37. Grader detail page (rubric editor)
38. Create/edit grader forms

### Phase 8: Frontend — Experiments UI
39. Experiment list page (status indicators, progress)
40. Experiment create form (dataset + grader selection)
41. Results table (THE core view — verdict cells, hover popovers)
42. Aggregate stats banner (Tremor charts)
43. SSE hook (useExperimentSSE)
44. Live result cell updates
45. CSV export, re-run, delete

### Phase 9: Polish & Compliance Check
46. test.yml API smoke test file
47. Full spec compliance audit
48. Missing states (loading, empty, error) sweep
49. Final commit

## Current Step
→ Starting Phase 1, Step 1

## Progress Log
(updated after each step)
