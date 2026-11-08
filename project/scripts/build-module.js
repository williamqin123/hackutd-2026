import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

await build({
  absWorkingDir: fileURLToPath(new URL('../', import.meta.url)),
  entryPoints: ['spacetimedb/src/index.js'],
  outfile: 'spacetimedb/dist/module.js',
  bundle: true, format: 'esm', platform: 'neutral', target: 'es2022',
  external: ['spacetime:*'],
});
console.log('Built JavaScript Spacetime module: spacetimedb/dist/module.js');
