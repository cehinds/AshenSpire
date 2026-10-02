// Rebuild the bow presentation bindings from the authored unarmed outfit sets.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const path = resolve(root, 'content/config/ui/presentation/equipmentAnimations.json');
const source = JSON.parse(readFileSync(path, 'utf8'));
const data = source.components;
const copy = value => structuredClone(value);

data.motionProfiles.bow = copy(data.motionProfiles.unarmed);
data.motionProfiles.bow.clips.bowReady = { frames: ['BOW-01'], frameMs: 150, impactIndex: 0 };
data.motionProfiles.bow.clips.bowAttack = {
  frames: Array.from({ length: 7 }, (_, index) => `BOW-${String(index + 1).padStart(2, '0')}`),
  frameMs: 150,
  impactIndex: 4,
};
data.motionProfiles.bow.references = {
  ...data.motionProfiles.bow.references,
  idle: 'bowReady', bowAttack: 'bowAttack', menu: 'bowReady',
};

data.bindings = data.bindings.filter(binding => !binding.setId.endsWith('Bow'));
for (const binding of data.bindings.filter(binding => binding.rightGroup === 'empty' && binding.leftGroup === 'empty')) {
  const sourceSet = data.sets[binding.setId];
  const outfit = sourceSet.frames['STANCE-READY'].file.split('/')[3];
  const setId = `${binding.setId.replace(/Unarmed$/, '')}Bow`;
  const frames = copy(sourceSet.frames);
  for (let index = 1; index <= 7; index++) {
    const name = `BOW-${String(index).padStart(2, '0')}`;
    frames[name] = {
      file: `assets/animations/bow/${outfit}/${name}.webp`,
      box: { x0: 60, y0: 70, x1: 580, y1: 590 },
    };
  }
  data.sets[setId] = {
    ...copy(sourceSet), motionProfile: 'bow',
    authoredEquipment: { rightGroup: 'bow', leftGroup: 'empty' }, frames,
  };
  for (const hand of ['right', 'left']) data.bindings.push({
    classId: binding.classId, armourId: binding.armourId,
    rightGroup: hand === 'right' ? 'bow' : 'empty',
    leftGroup: hand === 'left' ? 'bow' : 'empty', setId,
  });
}
writeFileSync(path, `${JSON.stringify(source, null, 2)}\n`);
console.log('bow-animation-config: registered 32 outfits and both bow hand slots');
