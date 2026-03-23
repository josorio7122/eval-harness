import { build } from 'esbuild'

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  outfile: 'dist/index.js',
  // Bundle @eval-harness/* workspace packages (they're .ts source)
  // Externalize everything else
  external: [
    // Prisma — WASM runtime, can't be bundled
    '@prisma/*',
    '@prisma/client',
    '@prisma/adapter-pg',
    // Node builtins
    'node:*',
    // npm dependencies (must stay external — installed in node_modules)
    '@hono/*',
    '@openrouter/*',
    'hono',
    'hono/*',
    'ai',
    'csv-parser',
    'dotenv',
    'dotenv/*',
    'json-2-csv',
    'p-queue',
    'pg',
    'pino',
    'pino-pretty',
    'zod',
  ],
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
})

console.log('Build complete: apps/api/dist/index.js')
