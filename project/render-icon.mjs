import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';

const svg = readFileSync('/tmp/favicon-teal.svg');
const png = await sharp(svg).png().toBuffer();
writeFileSync('/tmp/favicon-teal-sharp.png', png);
console.log('done');
