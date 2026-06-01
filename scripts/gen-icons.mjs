// Generates icon-192.png and icon-512.png from favicon.svg
// Requires: npm install -D sharp
import sharp from 'sharp'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { join, dirname } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))
const svg = readFileSync(join(__dir, '../public/favicon.svg'))

for (const size of [192, 512]) {
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(join(__dir, `../public/icon-${size}.png`))
  console.log(`✓ icon-${size}.png`)
}
