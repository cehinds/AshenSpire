import test from 'node:test';
import assert from 'node:assert/strict';
import { withKitDom } from './helpers/kit-dom.mjs';
import { categoryNav, railItem } from '../src/ui/kit/index.js';
import { renderCreationStepFace, createCreationStepNavigation } from '../src/ui/components/creationPageParts.js';

test('shared category selector keeps its default text face and accessible label', () => withKitDom(() => {
  const item = railItem({ label: 'Display', current: true, member: 'display' });
  const nav = categoryNav({ items: [item], ariaLabel: 'Settings', face: () => 'Display', label: text => `Settings: ${text}` });
  nav.sync();
  assert.equal(nav.toggle.querySelector('.as-catnav-face').textContent, 'Display');
  assert.equal(nav.toggle.getAttribute('aria-label'), 'Settings: Display');
  assert.equal(nav.toggle.getAttribute('aria-expanded'), 'false');
}));

test('creation face renderer keeps section and live count in separate aligned slots', () => withKitDom(() => {
  const item = railItem({ label: 'Class', current: true, member: 'class' });
  let index = 1;
  const nav = categoryNav({ items: [item], face: () => 'Class', label: text => text,
    renderFace: (face, name) => renderCreationStepFace(face, { name, index, count: 8 }),
  });
  nav.sync();
  const face = nav.toggle.querySelector('.as-catnav-face');
  assert.equal(face.children[0].className, 'cc-step-name');
  assert.equal(face.children[0].textContent, 'Class');
  assert.equal(face.children[1].textContent, '1 of 8');
  index = 8;
  nav.sync();
  assert.equal(face.children.length, 2);
  assert.equal(face.children[1].textContent, '8 of 8');
  assert.equal(nav.toggle.children[1].className, 'as-catnav-caret');
}));


test('creation navigation selects the first step before its initial progress callback when currentId is omitted', () => withKitDom(dom => {
  dom.document.documentElement = dom.document.body;
  const observed = [];
  const navigation = createCreationStepNavigation({ steps: [{ id: 'class', label: 'Class' }, { id: 'review', label: 'Review' }],
    labels: { currentStep: (step, index, total) => {
      observed.push([step.id, index, total]);
      return `${index + 1} of ${total} · ${step.label}`;
    } },
  });
  assert.deepEqual(observed[0], ['class', 0, 2]);
  assert.equal(navigation.querySelector('.cc-step-name').textContent, 'Class');
  assert.equal(navigation.querySelector('.cc-step-count').textContent, '1 of 2');
  assert.equal(navigation.navigation.toggle.getAttribute('aria-label'), '1 of 2 · Class');
  navigation.update('review');
  assert.equal(navigation.querySelector('.cc-step-name').textContent, 'Review');
  assert.equal(navigation.querySelector('.cc-step-count').textContent, '2 of 2');
  navigation.destroy();
}));


test('empty creation navigation never calls a current-step callback without a step', () => withKitDom(dom => {
  dom.document.documentElement = dom.document.body;
  let calls = 0;
  const navigation = createCreationStepNavigation({ steps: [], labels: {
    title: 'Creation steps', currentStep: step => { calls++; return step.label; },
  } });
  assert.equal(calls, 0);
  assert.equal(navigation.navigation.toggle.getAttribute('aria-label'), 'Creation steps');
  navigation.navigation.sync();
  assert.equal(calls, 0);
  navigation.destroy();
}));
