import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
const manifestPath = 'pose-studio/stances/update-stances/selections.json';
const manifest = JSON.parse(readFileSync(root + manifestPath, 'utf8'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const sourceBytes = new Map();
for (const sheet of manifest.sourceSheets) {
  const bytes = readFileSync(root + sheet.path);
  if (sheet.sha256 && sha(bytes) !== sheet.sha256) throw new Error(`Source changed: ${sheet.path}`);
  sourceBytes.set(sheet.path, bytes);
}
for (const choice of manifest.choices) {
  if (!sourceBytes.has(choice.sourcePath)) throw new Error(`Unlisted source sheet: ${choice.sourcePath}`);
  const [x0, y0, x1, y1] = choice.cropBounds;
  const sheet = manifest.sourceSheets.find(item => item.path === choice.sourcePath);
  if (x0 < 0 || y0 < 0 || x1 > sheet.width || y1 > sheet.height || x0 >= x1 || y0 >= y1) {
    throw new Error(`Invalid crop bounds for ${choice.id}`);
  }
}

const inputs = manifest.choices.map(choice => ({
  choice,
  dataUrl: `data:image/png;base64,${sourceBytes.get(choice.sourcePath).toString('base64')}`,
}));
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME ? { executablePath: process.env.CHROME } : {}) });
try {
  const page = await browser.newPage();
  const exported = await page.evaluate(async ({ inputs, manifest }) => {
    const decoded = [];
    for (const input of inputs) {
      const image = new Image();
      image.src = input.dataUrl;
      await image.decode();
      const { width, height } = image;
      const sheet = manifest.sourceSheets.find(item => item.path === input.choice.sourcePath);
      if (width !== sheet.width || height !== sheet.height) throw new Error(`Unexpected image dimensions: ${input.choice.sourcePath}`);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, width, height).data;
      const [cropX0, cropY0, cropX1, cropY1] = input.choice.cropBounds;
      let x0 = cropX1, y0 = cropY1, x1 = cropX0, y1 = cropY0;
      const cropWidth = cropX1 - cropX0, cropHeight = cropY1 - cropY0;
      const mask = new Uint8Array(cropWidth * cropHeight);
      const queue = new Int32Array(cropWidth * cropHeight);
      let seed = -1;
      const [expectedX0, expectedY0, expectedX1, expectedY1] = input.choice.sourceBounds;
      for (let y = expectedY0; y < expectedY1 && seed < 0; y++) for (let x = expectedX0; x < expectedX1; x++) {
        if (pixels[(y * width + x) * 4 + 3] > 32) { seed = (y - cropY0) * cropWidth + x - cropX0; break; }
      }
      if (seed < 0) throw new Error(`Selected figure has no opaque seed: ${input.choice.id}`);
      let head = 0, tail = 0;
      queue[tail++] = seed; mask[seed] = 1;
      while (head < tail) {
        const index = queue[head++], cx = index % cropWidth, cy = (index / cropWidth) | 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = cx + dx, ny = cy + dy;
          if ((dx === 0 && dy === 0) || nx < 0 || ny < 0 || nx >= cropWidth || ny >= cropHeight) continue;
          const ni = ny * cropWidth + nx;
          if (mask[ni]) continue;
          const alpha = pixels[((ny + cropY0) * width + nx + cropX0) * 4 + 3];
          if (alpha > 1) { mask[ni] = 1; queue[tail++] = ni; }
        }
      }
      const cropped = document.createElement('canvas');
      cropped.width = cropWidth; cropped.height = cropHeight;
      const croppedContext = cropped.getContext('2d');
      const cropData = croppedContext.createImageData(cropWidth, cropHeight);
      let retained = 0, excludedStrong = 0;
      for (let y = cropY0; y < cropY1; y++) for (let x = cropX0; x < cropX1; x++) {
        const local = (y - cropY0) * cropWidth + x - cropX0;
        const sourceIndex = (y * width + x) * 4, outputIndex = local * 4;
        if (mask[local]) {
          cropData.data.set(pixels.subarray(sourceIndex, sourceIndex + 4), outputIndex);
          if (pixels[sourceIndex + 3] > 32) {
            retained++;
            x0 = Math.min(x0, x); y0 = Math.min(y0, y);
            x1 = Math.max(x1, x + 1); y1 = Math.max(y1, y + 1);
          }
        } else if (pixels[sourceIndex + 3] > 32) excludedStrong++;
      }
      croppedContext.putImageData(cropData, 0, 0);
      if (!retained) throw new Error(`Selected component is empty: ${input.choice.id}`);
      if (JSON.stringify([x0, y0, x1, y1]) !== JSON.stringify(input.choice.sourceBounds)) {
        throw new Error(`Selected alpha bounds changed for ${input.choice.id}: ${[x0, y0, x1, y1]}`);
      }
      decoded.push({ ...input, image: cropped, alphaBounds: [x0, y0, x1, y1], cropWidth, cropHeight,
        cropOrigin: [cropX0, cropY0], excludedStrong });
    }

    const [maxWidth, maxHeight] = decoded.reduce(([w, h], item) => [
      Math.max(w, item.alphaBounds[2] - item.alphaBounds[0]),
      Math.max(h, item.alphaBounds[3] - item.alphaBounds[1]),
    ], [0, 0]);
    const scale = Math.min(420 / maxHeight, 470 / maxWidth);
    return decoded.map(item => {
      const { choice, image, alphaBounds } = item;
      const [cropX0, cropY0] = item.cropOrigin;
      const [x0, y0, x1, y1] = alphaBounds;
      const supportAnchor = choice.supportAnchor ?? { kind: 'alpha-bottom', sourceY: y1 };
      const supportY = supportAnchor.sourceY;
      if (!Number.isFinite(supportY) || supportY < y0 || supportY > y1) {
        throw new Error(`Invalid support anchor for ${choice.id}: ${supportY}`);
      }
      const left = Math.round(256 - ((x0 + x1) / 2 - cropX0) * scale);
      const top = choice.supportAnchor
        ? 464 - (supportY - cropY0) * scale
        : Math.round(464 - (y1 - cropY0) * scale);

      const full = document.createElement('canvas');
      full.width = full.height = 512;
      const ctx = full.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      const drawnW = Math.round(item.cropWidth * scale);
      const drawnH = Math.round(item.cropHeight * scale);
      const drawX = left;
      const drawY = top;
      ctx.drawImage(image, drawX, drawY, drawnW, drawnH);
      const output = ctx.getImageData(0, 0, 512, 512).data;
      let bx0 = 512, by0 = 512, bx1 = 0, by1 = 0;
      for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
        if (output[(y * 512 + x) * 4 + 3] > 32) {
          bx0 = Math.min(bx0, x); by0 = Math.min(by0, y);
          bx1 = Math.max(bx1, x + 1); by1 = Math.max(by1, y + 1);
        }
      }
      const expectedBottom = Math.round(464 + (y1 - supportY) * scale);
      if (Math.abs(by1 - expectedBottom) > 1) {
        throw new Error(`Support registration drift for ${choice.id}: bottom ${by1}, expected ${expectedBottom}`);
      }
      if (bx0 < 0 || by0 < 0 || bx1 > 512 || by1 > 512) throw new Error(`Output escaped frame for ${choice.id}`);
      const mobile = document.createElement('canvas');
      mobile.width = mobile.height = 256;
      const mobileCtx = mobile.getContext('2d');
      mobileCtx.imageSmoothingEnabled = true;
      mobileCtx.imageSmoothingQuality = 'high';
      mobileCtx.drawImage(full, 0, 0, 256, 256);
      return {
        choice, scale, sourceBounds: alphaBounds, excludedStrong: item.excludedStrong,
        supportAnchor: choice.supportAnchor,
        bounds: [bx0, by0, bx1, by1],
        full: full.toDataURL('image/webp', .9).split(',')[1],
        mobile: mobile.toDataURL('image/webp', .84).split(',')[1],
      };
    });
  }, { inputs, manifest });

  const catalogPath = root + 'src/content/alternativeSelectedStances.js';
  const match = readFileSync(catalogPath, 'utf8').match(/^export const alternativeSelectedStances = (.+);\r?$/m);
  if (!match) throw new Error('Unable to parse alternativeSelectedStances.js');
  const catalog = JSON.parse(match[1]);
  catalog.hashes ||= {};
  catalog.filePaths ||= {};
  catalog.weaponProfiles ||= {};
  const previous = catalog.weaponProfiles[manifest.id];
  for (const frame of Object.values(previous?.frames || {})) {
    for (const path of [frame.path, frame.lite]) {
      const file = path?.replace('assets-display/alternative/', '');
      if (file) { delete catalog.hashes[file]; delete catalog.filePaths[file]; }
    }
  }
  const frames = {};
  for (const item of exported) {
    const { choice } = item;
    const filename = `${manifest.id}-${choice.role}.webp`;
    const path = `assets-display/alternative/${filename}`;
    const lite = `assets-display/alternative/${manifest.id}-${choice.role}-mobile.webp`;
    const fullBytes = Buffer.from(item.full, 'base64');
    const mobileBytes = Buffer.from(item.mobile, 'base64');
    const fullHash = sha(fullBytes), mobileHash = sha(mobileBytes);
    mkdirSync(dirname(root + path), { recursive: true });
    writeFileSync(root + path, fullBytes);
    writeFileSync(root + lite, mobileBytes);
    const file = filename, mobileFile = `${manifest.id}-${choice.role}-mobile.webp`;
    catalog.hashes[file] = fullHash;
    catalog.hashes[mobileFile] = mobileHash;
    catalog.filePaths[file] = path;
    catalog.filePaths[mobileFile] = lite;
    frames[choice.role] = {
      path, lite, size: [512, 512], rasterSize: [512, 512], mobileRasterSize: [256, 256],
      bounds: item.bounds, anchor: [256, 464], sha256: fullHash, liteSha256: mobileHash,
      sourceOption: choice.sourceOption,
      source: { path: choice.sourcePath, width: 1536, height: 1024,
        sha256: manifest.sourceSheets.find(sheet => sheet.path === choice.sourcePath).sha256 },
      sourceBounds: item.sourceBounds, cropBounds: choice.cropBounds, scale: item.scale,
      supportAnchor: item.supportAnchor,
    };
  }
  catalog.weaponProfiles[manifest.id] = {
    classId: manifest.classId, weaponFamily: manifest.weaponFamily, selections: manifestPath, frames,
  };
  writeFileSync(catalogPath, '// Owner-selected held poses and weapon-specific pose profiles, exported from unchanged comparison artwork.\n' +
    `export const alternativeSelectedStances = ${JSON.stringify(catalog)};\n`);

  mkdirSync(root + 'pose-studio/stances/selected-projects', { recursive: true });
  const rig = { schemaVersion: 1, id: `alternative.selected-stances.${manifest.id}`,
    name: 'Reaver · greatsword pilot selections', canvas: { width: 512, height: 512 },
    assets: {}, poses: {}, animations: {}, queues: {} };
  for (const item of exported) {
    const choice = item.choice, role = choice.role;
    rig.assets[role] = { id: role, src: `data:image/webp;base64,${item.full}` };
    rig.poses[role] = { id: role, name: choice.label, reviewed: true,
      notes: `Owner-selected ${role} concept ${choice.sourceOption}; source pixels retained with crop and floor registration only.`,
      bones: [], layers: [{ id: 'figure', name: 'Selected figure', role: 'body', assetId: role,
        x: 0, y: 0, rotation: 0, scale: 1, opacity: 1, pivot: [256, 464], visible: true, locked: false,
        anchors: [{ id: 'floor', kind: 'joint', name: 'Floor', x: 256, y: 464 }] }] };
    rig.animations[role] = { id: role, name: role,
      frames: [{ id: `${role}-held`, poseId: role, duration: 260, event: '', overrides: {} }] };
  }
  rig.queues.review = { id: 'review', name: 'Selected weapon profile',
    items: Object.keys(frames).map(role => ({ id: role, animationId: role, repeats: 1, pause: 600 })) };
  writeFileSync(root + `pose-studio/stances/selected-projects/${manifest.id}.rig.json`, JSON.stringify(rig, null, 2) + '\n');
  console.log(`Exported ${exported.length} selected ${manifest.weaponFamily} figures at common scale ${exported[0].scale}.`);
  for (const item of exported) console.log(`  ${item.choice.role}: excluded ${item.excludedStrong} disconnected alpha>32 pixels inside crop.`);
} finally {
  await browser.close();
}
