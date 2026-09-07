// Rebuild inventory-size WebP assets from the preserved painted PNG masters.
import { createRequire } from 'node:module';
import { ARMAMENTS } from '../src/content/equipment.js';
const sharp = createRequire(import.meta.url)('sharp');
for (const item of ARMAMENTS) {
  const source = `art/painted-items-2026-09-07/${item.id}.png`;
  const metadata = await sharp(source).metadata();
  if (!metadata.hasAlpha) throw new Error(`${item.id}: missing transparency`);
  await sharp(source).resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 90 }).toFile(`assets/equipment/icon_${item.id}.webp`);
}
console.log(`Shipped ${ARMAMENTS.length} painted inventory illustrations.`);
