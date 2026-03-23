import { build } from 'esbuild'

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  outfile: 'dist/index.js',
  minify: true,
  sourcemap: 'linked',
  plugins: [
    {
      name: 'bundle-workspace-packages',
      setup(build) {
        // Handle all non-relative imports
        build.onResolve({ filter: /^[^./]|^\.[^./]|^\.\.[^/]/ }, (args) => {
          // Bundle @eval-harness/* workspace packages
          if (args.path.startsWith('@eval-harness/')) {
            return null
          }
          // Everything else is external (npm packages, node builtins)
          return { external: true }
        })
      },
    },
  ],
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
})

console.log('Build complete: apps/api/dist/index.js')
