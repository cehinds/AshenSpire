import { prologueSceneMs, prologueTransitionMs } from '../../model/prologueTiming.js';
import { paintPrologueCharacter, placePrologueCharacter } from '../prologueCharacter.js';
import { el, button, openModal } from '../kit/index.js';
import { prologueArtwork } from '../assets.js';
import { topVeil } from '../components/veil.js';
import { prologueConfig, prologueCopy, prologueTint, prologueDestination, prologueSequence, prologueResumePosition, prologueSceneArt, prologueBoxBackground, PROLOGUE_LAYOUT } from '../../model/prologue.js';

// One renderer serves both the real opening and the settings preview. Its only
// writes are explicit callbacks; previewing cannot create a run or consume RNG.
export function mountPrologue(host, {settings = {}, run = {}, startScene = 0, preview = false, onScene = () => {}, onFinish = () => {}, onSettings} = {}) {
  const config = prologueConfig(settings), p = config.presentation;
  const classId = run.class || p.previewClass;
  const destination = prologueDestination(run);
  const portrait = matchMedia(`(max-width: ${PROLOGUE_LAYOUT.sizing.mobileBreakpoint}px) and (orientation: portrait)`);
  const prefersStill = matchMedia('(prefers-reduced-motion: reduce)');
  const root = el('section',{class:`prologue-screen prologue-layout-${config.presentation.layout || 'caption'}`, 'aria-label':'Opening sequence'});
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
  // THE PRESENTATION IS SET ONCE, AS CSS CUSTOM PROPERTIES, because every one
  // of these is a value the stylesheet already wants (a colour, a length, an
  // alignment) and none of them changes between scenes. The classes say which
  // wireframe is standing; the properties fill it in.
  caption.dataset.position = String(p.textPosition || 'bottom-center');
  root.classList.toggle('prologue-has-box', p.textBox !== false);
  root.classList.toggle('prologue-box-hidden', p.textBox !== false && p.textBoxVisible === false);
  root.classList.toggle('prologue-outlined', p.textOutline === true && Number(p.textOutlineWidth) > 0);
  root.style.setProperty('--prologue-text-scale', String(p.textScale ?? 1));
  root.style.setProperty('--prologue-text-align', p.textAlign || 'center');
  root.style.setProperty('--prologue-box', prologueBoxBackground(p));
  root.style.setProperty('--prologue-outline-color', p.textOutlineColor || '#100e0c');
  root.style.setProperty('--prologue-outline-width', `${Number(p.textOutlineWidth) || 0}px`);
  // Fit, focus and scale go through custom properties rather than inline style
  // on the image, so a wireframe that must letterbox (which is a fact about the
  // frame, not about this setting) can still override the fit in CSS.
  root.style.setProperty('--prologue-fit', p.imageFit || 'cover');
  root.style.setProperty('--prologue-focus', `${p.imageFocusX ?? 50}% ${p.imageFocusY ?? 50}%`);
  root.style.setProperty('--prologue-scale', String(Number(p.imageScale) || 1));
  // The scenes play in the configured ORDER, over the configured SUBSET; the
  // numbers below stay indices into the authored list, which is what a paused
  // run recorded and what every setting key is named for.
  const order = prologueSequence(config);
  // A run paused on a scene since switched off resumes on the next scene still
  // in the opening (prologueResumePosition), rather than on one it has watched.
  let position = prologueResumePosition(config,Math.max(0,Math.min(config.scenes.length-1,startScene)));
  let sceneIndex = order[position], elapsed = 0;
  let stopped = false, paused = false, loading = false, serial = 0, last = 0, raf = 0;
  let animations = [], previous = null;
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
    const plate = el('div',{class:'prologue-plate'});
    // The painting is the scene's CHOICE, not its name (prologueSceneArt), so
    // a resequenced opening can keep a scene's words over another's artwork.
    const background = el('img',{class:'prologue-background',alt:'',src:prologueArtwork(prologueSceneArt(scene),layout,{classId})});
    const images = [background]; plate.append(background);
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
    // THE CLAMP BELONGS TO THE PAINTING, NOT THE SCENE. `night`'s plate is
    // already dark and blue, and a full tint wash over it reads as a stain —
    // but a scene can now borrow another scene's art, so keying the clamp to
    // the scene id both washed that plate at full strength under another
    // scene's name and clamped a bright plate drawn under `night`'s.
    wash.style.opacity = String(prologueSceneArt(scene) === 'night' ? Math.min(.06,p.wash) : p.wash);
    plate.append(wash);
    if (scene.banner) plate.append(el('div',{class:`prologue-banner banner-${p.bannerPosition === 'bottom' ? 'bottom' : 'top'}`},el('span',{class:'prologue-banner-text',text:copy.title})));
    await Promise.all(images.map(ready));
    if (stopped || token !== serial) return;
    animations.forEach(a=>a.cancel()); animations=[];
    for (const child of [...stage.children]) if (child !== previous) child.remove();
    if (previous) previous.style.opacity = '1';
    title.textContent = copy.title; speaker.textContent = copy.speaker; dialogue.textContent = copy.text;
    location.textContent = copy.location; location.hidden = !copy.location;
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
    if (!reduced() && scene.effect === 'push') animations.push(plate.animate([{transform:'scale(1)'},{transform:`scale(${PROLOGUE_LAYOUT.motion.zoom})`}],{duration:prologueSceneMs(scene),fill:'both',easing:'linear'}));
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
      if (p.autoAdvance && elapsed >= prologueSceneMs(scene) && position < order.length-1) showScene(position+1);
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
