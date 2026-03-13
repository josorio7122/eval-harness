# Tech Stack Research

## Latest Versions (March 2026)
| Package | Version | Notes |
|---|---|---|
| Turborepo | 2.8.x | pnpm workspaces |
| Prisma | 7.4.x | Rust-free runtime, smaller types |
| Hono | 4.12.x | Lightweight, fast |
| Zod | 4.3.x | Latest major |
| Vite | 8.0.x | Rolldown bundler |
| shadcn/ui | latest | CLI-first, Radix primitives |
| Tailwind CSS | 4.2.x | No config file needed |
| TanStack Query | 5.90.x | React Query |
| TanStack Table | 8.21.x | v9 alpha — use v8 stable |
| TanStack Form | 1.28.x | |
| ESLint | 10.0.x | Flat config only |
| Prettier | 3.8.x | |
| typescript-eslint | 8.57.x | |
| Tremor | 4.0.x | Charting — shadcn compatible, Tailwind native |

## Result Pattern — hand-rolled
```ts
type Result<T, E = string> =
  | { success: true; data: T }
  | { success: false; error: E };
```
Discriminated union, type narrowing via `result.success`. No library needed.

## Charting — Tremor
- shadcn/ui compatible, Tailwind native, React 19 support
- BarChart, DonutChart, SparkChart out of box
- Uses Recharts internally
- 16.4k stars, acquired by Vercel
