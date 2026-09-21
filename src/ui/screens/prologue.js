import { prologueSceneMs, prologueTransitionMs } from '../../model/prologueTiming.js';
import { paintPrologueCharacter, placePrologueCharacter } from '../prologueCharacter.js';
import { el, button, openModal } from '../kit/index.js';
import { prologueArtwork } from '../assets.js';
import { topVeil } from '../components/veil.js';
import { prologueConfig, prologueCopy, prologueTint, prologueDestination, prologueSequence, prologueResumePosition, prologueSceneArt, prologueBoxBackground, prologueStaging, PROLOGUE_LAYOUT, PROLOGUE_LAYOUTS } from '../../model/prologue.js';

/**
 * cameraFrames(stage, scene) → the drift a scene holds on, or null for still.
 *
 * `auto` is the rule the opening shipped with — a slow push zooms in, and
 * nothing else moves — kept as a value rather than as the absence of one, so a
 * scene can say "held still" and mean it while the opening still pushes.
 */
function cameraFrames(stage, scene) {
  const amount = Number(stage.cameraAmount) || 0;
  const move = stage.camera === 'auto' ? (scene.effect === 'push' ? 'in' : 'none') : stage.camera;
  if (!amount || !move || move === 'none') return null;
  const zoom = 1 + amount / 100;
  // A pan has to zoom a little first, or it drags the plate's edge into frame.
  const pan = (x, y) => [
    { transform: `scale(${zoom}) translate(${-x / 2}%, ${-y / 2}%)` },
    { transform: `scale(${zoom}) translate(${x / 2}%, ${y / 2}%)` },
  ];
  if (move === 'in') return [{ transform: 'scale(1)' }, { transform: `scale(${zoom})` }];
  if (move === 'out') return [{ transform: `scale(${zoom})` }, { transform: 'scale(1)' }];
  if (move === 'left') return pan(amount, 0);
  if (move === 'right') return pan(-amount, 0);
  if (move === 'up') return pan(0, amount);
  if (move === 'down') return pan(0, -amount);
  return null;
}

/**
 * The reveal is a CLIP OVER FINISHED TEXT, not text typed into the DOM.
 *
 * The narration is written once and in full; the part not yet reached is drawn
 * in transparent ink. It stays in the document and in the accessibility tree,
 * so a screen reader is never made to wait for a typewriter; the paragraph never
 * reflows as words arrive; a pause, a rotation or a tab switch resumes mid-word
 * without re-typing; and reduced motion is one branch: show everything.
 */
function revealSteps(text, stage) {
  const speed = Math.max(1, Number(stage.revealSpeed) || 45);
  if (stage.reveal === 'typewriter') return { total: text.length, msPer: 1000 / speed };
  if (stage.reveal === 'lines') return { total: text.split('\n').length, msPer: 10000 / speed, lines: true };
  return null;
}

// One renderer serves both the real opening and the settings preview. Its only
// writes are explicit callbacks; previewing cannot create a run or consume RNG.
export function mountPrologue(host, {settings = {}, run = {}, startScene = 0, preview = false, audio = null, onScene = () => {}, onFinish = () => {}, onSettings} = {}) {
  const config = prologueConfig(settings), p = config.presentation;
  const classId = run.class || p.previewClass;
  const destination = prologueDestination(run);
  const portrait = matchMedia(`(max-width: ${PROLOGUE_LAYOUT.sizing.mobileBreakpoint}px) and (orientation: portrait)`);
  const prefersStill = matchMedia('(prefers-reduced-motion: reduce)');
  const root = el('section',{class:'prologue-screen', 'aria-label':'Opening sequence'});
  const stage = el('div',{class:'prologue-stage','aria-hidden':'true'});
  const title = el('h1',{class:'prologue-title'});
  const speaker = el('p',{class:'prologue-speaker'});
  const dialogue = el('p',{class:'prologue-dialogue'});
  const location = el('p',{class:'prologue-location'});
  const progress = el('p',{class:'prologue-progress','aria-live':'off'});
  const next = button({label:config.labels.continue,weight:'primary'});
  const pause = button({label:config.labels.pause});
  const skip = button({label:preview ? config.labels.close : config.labels.skip});
  const controls = el('div',{class:'prologue-controls'},[pause,skip,next]);
  const caption = el('div',{class:'prologue-caption'},[title,speaker,dialogue,location,progress,controls]);
  root.append(stage,caption); host.replaceChildren(root);
  // THE STAGING IS WRITTEN AS CSS CUSTOM PROPERTIES, and written again for each
  // scene: a scene that keeps its own staging (prologueStaging) answers every
  // one of these for itself, so one scene may letterbox while the rest fill the
  // frame. The classes say which wireframe is standing; the properties fill it
  // in; both are re-applied on entry rather than once at mount.
  function applyStaging(stage) {
    for (const name of Object.keys(PROLOGUE_LAYOUTS)) root.classList.toggle(`prologue-layout-${name}`, name === stage.layout);
    caption.dataset.position = String(stage.textPosition || 'bottom-center');
    root.classList.toggle('prologue-has-box', stage.textBox !== false);
    root.classList.toggle('prologue-box-hidden', stage.textBox !== false && stage.textBoxVisible === false);
    root.classList.toggle('prologue-outlined', stage.textOutline === true && Number(stage.textOutlineWidth) > 0);
    root.style.setProperty('--prologue-text-scale', String(stage.textScale ?? 1));
    root.style.setProperty('--prologue-text-align', stage.textAlign || 'center');
    root.style.setProperty('--prologue-box', prologueBoxBackground(stage));
    root.style.setProperty('--prologue-outline-color', stage.textOutlineColor || '#100e0c');
    root.style.setProperty('--prologue-outline-width', `${Number(stage.textOutlineWidth) || 0}px`);
    // BARE NUMBERS, because a percentage margin measures the container's WIDTH
    // on both axes — 40% "top and bottom" was 40% of the width, which pushed
    // the plate off a wide screen. The stylesheet multiplies them by container
    // query units, so each axis measures the axis it names.
    root.style.setProperty('--prologue-inset-x', String(Number(stage.textInsetX) || 0));
    root.style.setProperty('--prologue-inset-y', String(Number(stage.textInsetY) || 0));
    // Fit, focus and scale go through custom properties rather than inline style
    // on the image, so a wireframe that must letterbox (which is a fact about the
    // frame, not about this setting) can still override the fit in CSS.
    root.style.setProperty('--prologue-fit', stage.imageFit || 'cover');
    root.style.setProperty('--prologue-focus', `${stage.imageFocusX ?? 50}% ${stage.imageFocusY ?? 50}%`);
    root.style.setProperty('--prologue-scale', String(Number(stage.imageScale) || 1));
  }
  // The scenes play in the configured ORDER, over the configured SUBSET; the
  // numbers below stay indices into the authored list, which is what a paused
  // run recorded and what every setting key is named for.
  const order = prologueSequence(config);
  // A run paused on a scene since switched off resumes on the next scene still
  // in the opening (prologueResumePosition), rather than on one it has watched.
  let position = prologueResumePosition(config,Math.max(0,Math.min(config.scenes.length-1,startScene)));
  let sceneIndex = order[position], elapsed = 0;
  let stopped = false, paused = false, loading = false, serial = 0, last = 0, raf = 0;
  let animations = [], previous = null, reveal = null;
  const reduced = () => p.reduceMotion || settings.reducedMotion === true || document.body.classList.contains('reduced-motion') || prefersStill.matches;
  const ownerVeil = root.closest('.modal-veil');
  const blocked = () => document.hidden || (topVeil() && topVeil() !== ownerVeil);
  const transitionMs = scene => prologueTransitionMs(scene,p,reduced());
  function cleanup() {
    if (stopped) return;
    stopped = true; serial++; cancelAnimationFrame(raf);
    animations.forEach(a=>a.cancel());
    portrait.removeEventListener('change',rotate);
    document.removeEventListener('visibilitychange',visibility);
  }
  function finish(reason) { if (stopped) return; cleanup(); onFinish(reason); }
  function togglePause() { paused = !paused; last = 0; pause.textContent = paused ? config.labels.resume : config.labels.pause; }
  function visibility() { last = 0; }
  function rotate() { showScene(position,{resumeAt:elapsed,notify:false}); }
  function startReveal(text, stage) {
    const steps = revealSteps(text, stage);
    if (!steps || reduced()) { dialogue.textContent = text; return null; }
    const said = el('span',{class:'prologue-said'});
    const unsaid = el('span',{class:'prologue-unsaid'});
    dialogue.replaceChildren(said,unsaid);
    const split = count => {
      if (!steps.lines) return count;
      const lines = text.split('\n');
      return lines.slice(0,count).join('\n').length + (count && count < lines.length ? 1 : 0);
    };
    const paint = (at, still) => {
      const reached = still ? steps.total : Math.min(steps.total, Math.floor(at / steps.msPer));
      const cut = split(reached);
      if (said.textContent.length === cut) return;
      said.textContent = text.slice(0,cut);
      unsaid.textContent = text.slice(cut);
    };
    said.textContent = ''; unsaid.textContent = text;
    paint(0,false);
    return paint;
  }
  async function ready(image) {
    // Missing art must not strand a new run. Keep readable text and controls.
    let timeout;
    try { await Promise.race([image.decode(), new Promise(resolve=>{timeout=setTimeout(resolve,8000);})]); }
    catch { image.hidden = true; }
    finally { clearTimeout(timeout); }
  }
  async function showScene(at,{resumeAt = 0,notify = true} = {}) {
    const token = ++serial; loading = true; next.disabled = true;
    position = Math.max(0,Math.min(order.length-1,at)); sceneIndex = order[position]; elapsed = resumeAt; last = 0;
    const scene = config.scenes[sceneIndex], layout = portrait.matches ? 'mobile' : 'desktop';
    const copy = prologueCopy(scene,config,{classId,name:run.customization?.name || 'Forsaken',location:destination.name});
    if (notify) onScene(sceneIndex);
    const stage_ = prologueStaging(config,scene);
    const plate = el('div',{class:'prologue-plate'});
    // The painting is the scene's CHOICE, not its name (prologueSceneArt), so
    // a resequenced opening can keep a scene's words over another's artwork —
    // and `null` is a scene with no painting at all, which is what an added
    // scene is until the owner points it at one.
    const art = prologueSceneArt(scene);
    const images = [];
    if (art) {
      const background = el('img',{class:'prologue-background',alt:'',src:prologueArtwork(art,layout,{classId})});
      images.push(background); plate.append(background);
    } else {
      plate.classList.add('prologue-plate-bare');
    }
    if (scene.character) {
      const source = new Image(); source.src = prologueArtwork(classId);
      const actor = el('canvas',{class:'prologue-actor'});
      await ready(source);
      if (stopped || token !== serial) return;
      if (source.naturalWidth) {
        paintPrologueCharacter(actor,source,p.shadowStrength);
        placePrologueCharacter(actor,scene.actor[layout]);
        plate.append(actor);
      }
    }
    const wash = el('div',{class:'prologue-wash'});
    wash.style.background = prologueTint(config,settings,run.customization);
    // THE WASH IS A SETTING, NOT AN EXCEPTION IN CODE. `night`'s dark plate used
    // to be clamped by a branch that named the scene — which washed that plate
    // at full strength the moment another scene borrowed it, and clamped a
    // bright plate drawn under `night`'s name. The scene's own staging says it
    // now, and `night` ships with its own staging and a 0.06 wash.
    wash.style.opacity = String(stage_.wash);
    plate.append(wash);
    if (scene.banner) plate.append(el('div',{class:`prologue-banner banner-${p.bannerPosition === 'bottom' ? 'bottom' : 'top'}`},el('span',{class:'prologue-banner-text',text:copy.title})));
    await Promise.all(images.map(ready));
    if (stopped || token !== serial) return;
    animations.forEach(a=>a.cancel()); animations=[];
    for (const child of [...stage.children]) if (child !== previous) child.remove();
    if (previous) previous.style.opacity = '1';
    applyStaging(stage_);
    title.textContent = copy.title; speaker.textContent = copy.speaker;
    location.textContent = copy.location; location.hidden = !copy.location;
    // THE WHOLE LINE IS ALWAYS IN THE DOM, and the reveal only hides part of it:
    // a screen reader, a text search and `prefers-reduced-motion` all get the
    // finished narration, and nothing has to be re-typed when the scene is
    // resumed after a pause, a rotation or a tab switch.
    reveal = startReveal(copy.text,stage_);
    // A scene may take the music with it, and may open on a sound — but only
    // when the scene is actually being ENTERED. `notify` is false when the same
    // scene is re-drawn in place (a rotation, a breakpoint change), and a
    // stinger that fired again on every rotation was the scene announcing
    // itself twice. Silence is the `quiet` context, never stopMusic(): the
    // engine remembers where it is, and stopping without moving left the map
    // silent after the opening.
    if (notify && audio && scene.music && scene.music !== 'keep') audio.music?.(scene.music);
    if (notify && audio && scene.stinger && scene.stinger !== 'none') audio.sfx?.(scene.stinger);
    next.textContent = position === order.length-1 ? config.labels.setForth : config.labels.continue;
    progress.textContent = `${position+1} / ${order.length}`;
    stage.append(plate);
    const duration = transitionMs(scene);
    if (duration) {
      const frames = scene.effect === 'ash' ? [{opacity:0,clipPath:'inset(0 0 100% 0)'},{opacity:1,clipPath:'inset(0)'}]
        : scene.effect === 'dip' ? [{opacity:0,offset:0},{opacity:0,offset:.5},{opacity:1,offset:1}] : [{opacity:0},{opacity:1}];
      animations.push(plate.animate(frames,{duration,fill:'both',easing:'ease-in-out'}));
      if (previous && scene.effect === 'dip') animations.push(previous.animate([{opacity:1},{opacity:0}],{duration:duration/2,fill:'both'}));
    }
    const camera = cameraFrames(stage_,scene);
    if (!reduced() && camera) animations.push(plate.animate(camera,{duration:prologueSceneMs(scene),fill:'both',easing:'linear'}));
    animations.forEach(a=>{a.pause(); a.currentTime=elapsed;});
    previous = plate; loading = false; next.disabled = false; last = 0;
  }
  function tick(now) {
    if (stopped || !root.isConnected) { cleanup(); return; }
    if (!paused && !loading && !blocked()) {
      elapsed += last ? Math.min(now-last,250)*p.speed : 0;
      if (reduced()) animations.forEach(a=>a.finish());
      else animations.forEach(a=>{a.currentTime=elapsed;});
      const scene = config.scenes[sceneIndex];
      if (reveal) reveal(elapsed,reduced());
      // A scene may HOLD: the owner marks it, and it waits for Continue however
      // the opening is otherwise paced.
      if (p.autoAdvance && !scene.waitForInput && elapsed >= prologueSceneMs(scene) && position < order.length-1) showScene(position+1);
    }
    last = now; raf = requestAnimationFrame(tick);
  }
  pause.onclick = togglePause;
  next.onclick = () => { if (!loading) position === order.length-1 ? finish('completed') : showScene(position+1); };
  skip.onclick = () => finish(preview ? 'preview' : 'skipped');
  if (preview) {
    const replay = button({label:config.labels.replay});
    replay.onclick = () => { paused = false; pause.textContent = config.labels.pause; showScene(0); };
    controls.insertBefore(replay,skip);
  }
  if (onSettings) {
    const settingsButton = button({label:config.labels.settings});
    settingsButton.onclick = () => { if (!paused) togglePause(); onSettings(); };
    controls.insertBefore(settingsButton,skip);
  }
  portrait.addEventListener('change',rotate);
  document.addEventListener('visibilitychange',visibility);
  // THE FRAME IS UP BEFORE THE ARTWORK IS. `showScene` applies the staging when
  // it appends the plate, which waits on the painting decoding (up to eight
  // seconds when the file is missing) — so the opening used to draw its first
  // scene in the shipped caption layout and jump into the chosen one later.
  applyStaging(prologueStaging(config,config.scenes[sceneIndex]));
  showScene(position); raf = requestAnimationFrame(tick); next.focus({preventScroll:true});
  return cleanup;
}

export function previewPrologue(settings) {
  let cleanup;
  const door = openModal({size:'xl',title:'Opening preview',bodyClassName:'prologue-preview-body',onClose:()=>cleanup?.()});
  const config = prologueConfig(settings);
  cleanup = mountPrologue(door.body,{settings,preview:true,
    startScene:config.scenes.findIndex(s=>s.id===config.presentation.previewScene),
    onFinish:()=>door.close()});
  return door;
}
