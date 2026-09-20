import { paintPrologueCharacter, placePrologueCharacter } from '../prologueCharacter.js';
import { el, button, openModal } from '../kit/index.js';
import { prologueArtwork } from '../assets.js';
import { topVeil } from '../components/veil.js';
import { prologueConfig, prologueCopy, prologueTint, prologueDestination, PROLOGUE_LAYOUT } from '../../model/prologue.js';

// One renderer serves both the real opening and the settings preview. Its only
// writes are explicit callbacks; previewing cannot create a run or consume RNG.
export function mountPrologue(host, {settings = {}, run = {}, startScene = 0, preview = false, onScene = () => {}, onFinish = () => {}, onSettings} = {}) {
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
  let sceneIndex = Math.max(0,Math.min(config.scenes.length-1,startScene)), elapsed = 0;
  let stopped = false, paused = false, loading = false, serial = 0, last = 0, raf = 0;
  let animations = [], previous = null;
  const reduced = () => p.reduceMotion || settings.reducedMotion === true || document.body.classList.contains('reduced-motion') || prefersStill.matches;
  const ownerVeil = root.closest('.modal-veil');
  const blocked = () => document.hidden || (topVeil() && topVeil() !== ownerVeil);
  const transitionMs = scene => reduced() || scene.effect === 'still' ? 0 : p.transitionSeconds*1000;
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
  function rotate() { showScene(sceneIndex,{resumeAt:elapsed,notify:false}); }
  async function ready(image) {
    // Missing art must not strand a new run. Keep readable text and controls.
    let timeout;
    try { await Promise.race([image.decode(), new Promise(resolve=>{timeout=setTimeout(resolve,8000);})]); }
    catch { image.hidden = true; }
    finally { clearTimeout(timeout); }
  }
  async function showScene(index,{resumeAt = 0,notify = true} = {}) {
    const token = ++serial; loading = true; sceneIndex = index; elapsed = resumeAt; last = 0;
    const scene = config.scenes[index], layout = portrait.matches ? 'mobile' : 'desktop';
    const copy = prologueCopy(scene,config,{classId,name:run.customization?.name || 'Forsaken',location:destination.name});
    title.textContent = copy.title; speaker.textContent = copy.speaker; dialogue.textContent = copy.text;
    location.textContent = copy.location; location.hidden = !copy.location;
    next.textContent = index === config.scenes.length-1 ? config.labels.setForth : config.labels.continue;
    progress.textContent = `${index+1} / ${config.scenes.length}`;
    if (notify) onScene(index);
    const plate = el('div',{class:'prologue-plate'});
    const background = el('img',{class:'prologue-background',alt:'',src:prologueArtwork(scene.id,layout,{destinationArt:scene.id === 'step' ? destination.art : null})});
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
    wash.style.opacity = String(scene.id === 'night' ? Math.min(.06,p.wash) : p.wash);
    plate.append(wash);
    await Promise.all(images.map(ready));
    if (stopped || token !== serial) return;
    animations.forEach(a=>a.cancel()); animations=[];
    for (const child of [...stage.children]) if (child !== previous) child.remove();
    if (previous) previous.style.opacity = '1';
    stage.append(plate);
    const duration = transitionMs(scene);
    if (duration) {
      const frames = scene.effect === 'ash' ? [{opacity:0,clipPath:'inset(0 0 100% 0)'},{opacity:1,clipPath:'inset(0)'}]
        : scene.effect === 'dip' ? [{opacity:0,offset:0},{opacity:0,offset:.5},{opacity:1,offset:1}] : [{opacity:0},{opacity:1}];
      animations.push(plate.animate(frames,{duration,fill:'both',easing:'ease-in-out'}));
      if (previous && scene.effect === 'dip') animations.push(previous.animate([{opacity:1},{opacity:0}],{duration:duration/2,fill:'both'}));
      if (scene.effect === 'push') animations.push(plate.animate([{transform:'scale(1)'},{transform:`scale(${PROLOGUE_LAYOUT.motion.zoom})`}],{duration:duration+scene.seconds*1000,fill:'both',easing:'linear'}));
    }
    animations.forEach(a=>{a.pause(); a.currentTime=elapsed;});
    previous = plate; loading = false; last = 0;
  }
  function tick(now) {
    if (stopped || !root.isConnected) { cleanup(); return; }
    if (!paused && !loading && !blocked()) {
      elapsed += last ? Math.min(now-last,250)*p.speed : 0;
      if (reduced()) animations.forEach(a=>a.finish());
      else animations.forEach(a=>{a.currentTime=elapsed;});
      const scene = config.scenes[sceneIndex];
      if (p.autoAdvance && elapsed >= transitionMs(scene)+scene.seconds*1000 && sceneIndex < config.scenes.length-1) showScene(sceneIndex+1);
    }
    last = now; raf = requestAnimationFrame(tick);
  }
  pause.onclick = togglePause;
  next.onclick = () => sceneIndex === config.scenes.length-1 ? finish('completed') : showScene(sceneIndex+1);
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
  showScene(sceneIndex); raf = requestAnimationFrame(tick); next.focus({preventScroll:true});
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
