import { createRequire } from 'node:module';
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const packagePath = require.resolve('maplibre-gl/package.json');
const { version } = JSON.parse(await readFile(packagePath, 'utf8'));
const source = path.join(path.dirname(packagePath), 'dist');
const destination = fileURLToPath(new URL(`../public/maplibre/${version}/`, import.meta.url));

await mkdir(destination, { recursive: true });
for (const filename of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) {
  await copyFile(path.join(source, filename), path.join(destination, filename));
}
console.log(`Prepared MapLibre worker at /maplibre/${version}/maplibre-gl-worker.mjs`);
