// A JSON bridge for authoring tools in other languages. Pixel limits and
// compression stay in mobileart-policy.mjs instead of being copied by exporters.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { policyFor, twinDimensions } from './mobileart-policy.mjs';

export function artExportPlan(rows) {
  if (!Array.isArray(rows)) throw new TypeError('Expected an array of {path,width,height} asset records');
  return rows.map(({path,width,height}) => {
    if (typeof path !== 'string' || !path || !Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1)
      throw new TypeError('Each asset needs a policy path and positive integer pixel dimensions');
    const policy=policyFor(path.replace(/^assets\//,''));
    return {...twinDimensions({width,height},policy),quality:policy.quality,alphaQuality:policy.alphaQuality};
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  process.stdout.write(JSON.stringify(artExportPlan(JSON.parse(readFileSync(0,'utf8'))))+'\n');
