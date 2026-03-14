# Eval Harness Web

React 19 frontend for the eval harness. Dense, data-focused interface for managing datasets, graders, and experiment results.

## Quick Start

```bash
# From monorepo root
pnpm dev
```

Frontend runs on `http://localhost:5173`. Requires the API at `http://localhost:3001`.

## Stack

| Layer     | Tech                                                |
| --------- | --------------------------------------------------- |
| Framework | React 19 + Vite                                     |
| Routing   | React Router 7                                      |
| State     | TanStack Query (server state) + useState (UI state) |
| UI        | shadcn/ui (Base UI v4) + Tailwind CSS 4             |
| Charts    | Recharts                                            |
| Icons     | Lucide React                                        |

## Structure

```
src/
├── components/
│   ├── datasets/        — Dataset list, detail, items, revisions, CSV import/export
│   ├── graders/         — Grader list, detail, form editing
│   ├── experiments/     — Experiment list, detail, results table, charts
│   ├── shared/          — DataTable, PageHeader, EmptyState, ConfirmDeleteDialog
│   └── ui/              — shadcn/ui primitives (Button, Dialog, Table, etc.)
├── hooks/               — TanStack Query hooks per domain
├── lib/                 — API client, utilities
├── pages/               — Thin route handlers
└── App.tsx              — Router + providers
```

## Pages

| Route            | View                                      |
| ---------------- | ----------------------------------------- |
| /                | Redirects to /datasets                    |
| /datasets        | Dataset list                              |
| /datasets/:id    | Dataset detail (items, schema, revisions) |
| /graders         | Grader list                               |
| /graders/:id     | Grader detail (edit form)                 |
| /experiments     | Experiment list                           |
| /experiments/:id | Experiment detail (results table, charts) |

## Environment Variables

| Variable     | Default               | Description  |
| ------------ | --------------------- | ------------ |
| VITE_API_URL | http://localhost:3001 | API base URL |
