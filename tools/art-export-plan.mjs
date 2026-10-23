// A JSON bridge for authoring tools in other languages. Pixel limits and
// compression stay in mobileart-policy.mjs instead of being copied by exporters.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { policyFor, twinDimensions } from './mobileart-policy.mjs';

export function artExportPlan(rows, { profile = 'mobile' } = {}) {
  if (!['mobile', 'desktop-scenes'].includes(profile)) throw new TypeError('Unknown export profile');
  if (!Array.isArray(rows)) throw new TypeError('Expected an array of {path,width,height} asset records');
  return rows.map(({path,width,height}) => {
    if (typeof path !== 'string' || !path || !Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1)
      throw new TypeError('Each asset needs a policy path and positive integer pixel dimensions');
    const relative = path.replace(/^assets\//,'');
    if (profile === 'desktop-scenes') {
      if (!/^environments\/scene-[a-zA-Z0-9-]+\.webp$/.test(relative)) throw new TypeError('Desktop scene profile requires a reviewed scene layer path');
      const scale = Math.min(1, 1280 / width, 720 / height);
      return { width: Math.round(width * scale), height: Math.round(height * scale), quality: 78, alphaQuality: 80 };
    }
    const policy=policyFor(relative);
    return {...twinDimensions({width,height},policy),quality:policy.quality,alphaQuality:policy.alphaQuality};
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  process.stdout.write(JSON.stringify(artExportPlan(JSON.parse(readFileSync(0,'utf8')), { profile: process.argv.includes('--desktop-scenes') ? 'desktop-scenes' : 'mobile' }))+'\n');
