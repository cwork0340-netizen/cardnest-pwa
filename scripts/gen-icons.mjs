// 產生 App 圖示（暖拿鐵：咖啡色滿版底、奶油色卡片、陶土色圓點）。
// 圖示一定要「滿版不透明」：四角透明的話 iPhone 會把透明處填黑。
// 執行：node scripts/gen-icons.mjs（需要 devDependency sharp）
import sharp from 'sharp'
import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { join, dirname } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))
const out = (name) => join(__dir, '../public', name)

// 卡片放在中央約 56% 的範圍內，maskable 圖示被裁成圓形或圓角方形時也不會被切到
const art = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#392F28"/>
  <rect x="124" y="172" width="264" height="172" rx="26" fill="#F3ECE0"/>
  <rect x="124" y="214" width="264" height="38" fill="#D9CDB9"/>
  <circle cx="338" cy="298" r="24" fill="#A95741"/>
  <rect x="152" y="292" width="92" height="12" rx="6" fill="#D9CDB9"/>
</svg>`

for (const [name, size] of [['icon-180.png', 180], ['icon-192.png', 192], ['icon-512.png', 512], ['icon-512-maskable.png', 512]]) {
  await sharp(Buffer.from(art(size))).png().toFile(out(name))
  console.log(`✓ ${name}`)
}

// 分頁圖示用的 SVG：圓角方形
writeFileSync(out('favicon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="7" fill="#392F28"/>
  <rect x="7.5" y="10.5" width="17" height="11" rx="1.8" fill="#F3ECE0"/>
  <rect x="7.5" y="13.2" width="17" height="2.4" fill="#D9CDB9"/>
  <circle cx="21.2" cy="18.6" r="1.6" fill="#A95741"/>
</svg>
`)
console.log('✓ favicon.svg')
