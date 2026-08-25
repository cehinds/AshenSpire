import { buildStampHtml } from './buildstamp.js';
import { esc } from './tooltip.js';

function isActivation(input) {
  if (input.family === 'keyboard') return input.key === 'Enter' || input.key === ' ';
  if (input.family === 'controller') {
    return input.button === 0 || input.button === 9
      || input.action === 'confirm' || input.action === 'menu';
  }
  return false;
}
function familyForPointer(event) {
  return event.pointerType === 'touch' ? 'touch' : 'pointer';
}

export function mountStartupGate(app, {
  model,
  registerInputGate,
  onReveal,
} = {}) {
  if (!app || !model || model.component !== 'startup-gate') {
    throw new Error('mountStartupGate requires an app root and startup-gate Component Model');
  }
  if (typeof registerInputGate !== 'function' || typeof onReveal !== 'function') {
    throw new Error('mountStartupGate requires input registration and reveal callbacks');
  }

  const { properties, accessibility } = model;
  const particleHtml = properties.particles.map((particle) => (
    `<span class="startup-ash" data-particle="${esc(particle.id)}" style="--ash-left:${particle.leftPct}%;--ash-delay:${particle.delayMs}ms;--ash-duration:${particle.durationMs}ms;--ash-size:${particle.sizePx}px"></span>`
  )).join('');

  app.innerHTML = `
    <section class="screen startup-gate" data-component="startup-gate" data-input-family="${esc(properties.inputFamily)}" tabindex="0"
      role="${esc(accessibility.role)}" aria-label="${esc(accessibility.label)}">
      <div class="startup-ash-field" aria-hidden="true">${particleHtml}</div>
      <div class="startup-mark">
        ${properties.overline ? `<p class="startup-overline">${esc(properties.overline)}</p>` : ''}
        <h1 class="startup-wordmark">${esc(properties.wordmark)}</h1>
        ${properties.subtitle ? `<p class="startup-subtitle">${esc(properties.subtitle)}</p>` : ''}
        <div class="startup-rule" aria-hidden="true"><span></span></div>
        <p class="startup-prompt" aria-live="${esc(accessibility.promptLive)}">${esc(properties.prompts[properties.inputFamily])}</p>
      </div>
      ${buildStampHtml('startup')}
    </section>`;

  const root = app.querySelector('.startup-gate');
  const prompt = root.querySelector('.startup-prompt');
  let family = properties.inputFamily;
  let armed = null;
  let finished = false;
  let revealTimer = null;

  const setFamily = (next) => {
    if (!properties.prompts[next] || next === family) return;
    family = next;
    root.dataset.inputFamily = next;
    prompt.textContent = properties.prompts[next];
  };

  const finish = (source) => {
    if (finished) return;
    finished = true;
    armed = null;
    root.classList.add('is-revealing');
    root.setAttribute('aria-busy', 'true');
    const delay = document.body.classList.contains('reduced-motion') ? 140 : 180;
    revealTimer = setTimeout(() => {
      revealTimer = null;
      teardown(true);
      onReveal({ source, family });
    }, delay);
  };

  const claimInput = (input) => {
    if (input.phase === 'cancel') {
      if (!input.family || armed?.startsWith(`${input.family}:`)) armed = null;
      return false;
    }
    setFamily(input.family);
    if (!isActivation(input)) return false;
    if (finished) return true;
    const identity = input.family === 'keyboard'
      ? `${input.family}:${input.key}`
      : `${input.family}:${input.padIndex}:${input.button}`;
    if (input.phase === 'down') {
      if (!input.repeat) armed = identity;
      return true;
    }
    if (input.phase === 'up') {
      const completes = armed === identity;
      if (completes) {
        armed = null;
        finish(input.family);
      }
      return true;
    }
    return true;
  };

  const releaseInputGate = registerInputGate(claimInput);
  const onPointerMove = (event) => setFamily(familyForPointer(event));
  const onPointerDown = (event) => setFamily(familyForPointer(event));
  const onClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    // A touch pointer normally ends as a compatibility MouseEvent whose
    // pointerType is absent. Keep the family claimed on pointerdown instead
    // of relabelling that same physical gesture as a mouse click.
    finish(event.pointerType ? familyForPointer(event) : family);
  };

  root.addEventListener('pointermove', onPointerMove, { passive: true });
  root.addEventListener('pointerdown', onPointerDown, true);
  root.addEventListener('click', onClick, true);
  root.focus({ preventScroll: true });

  function teardown(releaseGate = true) {
    if (revealTimer != null) {
      clearTimeout(revealTimer);
      revealTimer = null;
    }
    if (releaseGate) releaseInputGate();
    root.removeEventListener('pointermove', onPointerMove);
    root.removeEventListener('pointerdown', onPointerDown, true);
    root.removeEventListener('click', onClick, true);
    armed = null;
  }

  return () => teardown(true);
}
