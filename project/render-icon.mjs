import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const svg = readFileSync(new URL('./public/favicon-teal.svg', import.meta.url));
for (const path of ['public/favicon-teal.png', 'app/icon.png', 'app/apple-icon.png']) {
  await sharp(svg).resize(1024, 1024).png().toFile(fileURLToPath(new URL(path, import.meta.url)));
}
console.log('Rendered WaterBoard icons from public/favicon-teal.svg');
