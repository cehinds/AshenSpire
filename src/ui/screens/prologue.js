import { prologueSceneMs, prologueTransitionMs } from '../../model/prologueTiming.js';
import { paintPrologueCharacter, placePrologueCharacter } from '../prologueCharacter.js';
import { el, button, openModal } from '../kit/index.js';
import { prologueArtwork } from '../assets.js';
import { builtInFor, ART_SOURCE_EVENT } from '../highResArt.js';
import { topVeil } from '../components/veil.js';
import { prologueConfig, prologueCopy, prologueTint, prologueDestination, prologueSequence, prologueResumePosition, prologueSceneArt, prologueBoxBackground, prologueStaging, PROLOGUE_DEFAULTS, PROLOGUE_LAYOUT, PROLOGUE_LAYOUTS } from '../../model/prologue.js';

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
export function mountPrologue(host, {settings = {}, run = {}, startScene = 0, preview = false, editorPreview = false, forceLayout = null, audio = null, onScene = () => {}, onFinish = () => {}, onSettings} = {}) {
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
  const caption = el('div',{class:'prologue-caption'},[title,speaker,dialogue,location]);
  // THE BUTTONS BELONG TO THE FRAME. They used to live inside the caption, so a
  // wireframe that floats the words into the middle of the picture floated
  // Continue into the middle with them (owner, with a screenshot). They stand
  // in a band along the bottom of the screen — under the words, but not part of
  // them — unless the owner asks for them back under the text.
  const inText = p.controlsPosition === 'text';
  const bar = el('div',{class:'prologue-bar'},[progress,controls]);
  if (inText) caption.append(progress,controls);
  root.append(stage,caption); if (!inText) root.append(bar);
  root.classList.toggle('prologue-controls-text',inText);
  root.classList.add(`prologue-controls-${['compact','normal','large'].includes(p.controlsSize) ? p.controlsSize : 'normal'}`);
  root.style.setProperty('--prologue-controls-align',{left:'flex-start',right:'flex-end'}[p.controlsAlign] || 'center');
  pause.hidden = p.showPause === false;
  // `skip` doubles as the preview's Close, which is not the player-facing skip
  // the setting is about.
  skip.hidden = !preview && p.showSkip === false;
  if (editorPreview) {
    root.classList.add('prologue-editor-still');
    controls.hidden = true;
    progress.hidden = true;
  }
  host.replaceChildren(root);
  // THE STAGING IS WRITTEN AS CSS CUSTOM PROPERTIES, and written again for each
  // scene: a scene that keeps its own staging (prologueStaging) answers every
  // one of these for itself, so one scene may letterbox while the rest fill the
  // frame. The classes say which wireframe is standing; the properties fill it
  // in; both are re-applied on entry rather than once at mount.
  // A DIAL IS WRITTEN ONLY WHEN IT IS TURNED. Writing every property on every
  // scene made the stylesheet's own defaults unreachable — and some of those
  // defaults are the player's, not ours: `.prologue-title{color:var(--gold)}`
  // follows the accent theme, and a hex the owner never chose was overwriting
  // crimson with gold. It also forced a filter and a backdrop pipeline on a
  // full-viewport plate for a profile that had touched nothing.
  const shipped = PROLOGUE_DEFAULTS.presentation;
  const dial = (node, name, value, key, format = String) => {
    if (value === undefined || value === shipped[key]) node.style.removeProperty(name);
    else node.style.setProperty(name, format(value));
  };
  function applyStaging(stage) {
    for (const name of Object.keys(PROLOGUE_LAYOUTS)) root.classList.toggle(`prologue-layout-${name}`, name === stage.layout);
    caption.dataset.position = String(stage.textPosition || 'bottom-center');
    root.classList.toggle('prologue-has-box', stage.textBox !== false);
    root.classList.toggle('prologue-box-hidden', stage.textBox !== false && stage.textBoxVisible === false);
    root.classList.toggle('prologue-fixed-caption', stage.captionFixedHeight === true);
    root.classList.toggle('prologue-banner-box', stage.bannerBox !== false);
    root.classList.toggle('prologue-outlined', stage.textOutline === true && Number(stage.textOutlineWidth) > 0);
    root.style.setProperty('--prologue-text-scale', String(stage.textScale ?? 1));
    root.style.setProperty('--prologue-text-align', stage.textAlign || 'center');
    root.style.setProperty('--prologue-box', prologueBoxBackground(stage));
    root.style.setProperty('--prologue-caption-vh', String(Number(stage.captionHeightVh) || 18));
    const bannerHex = /^#([0-9a-f]{6})$/i.exec(stage.bannerBoxColor || '#100e0c')?.[1] || '100e0c';
    const bannerRgb = [0, 2, 4].map(index => parseInt(bannerHex.slice(index, index + 2), 16));
    root.style.setProperty('--prologue-banner-box', `rgba(${bannerRgb.join(',')},${Math.max(0, Math.min(1, Number(stage.bannerBoxOpacity ?? 1)))})`);
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
    // The words, part by part.
    dial(root, '--prologue-title-color', stage.titleColor, 'titleColor');
    dial(root, '--prologue-speaker-color', stage.speakerColor, 'speakerColor');
    dial(root, '--prologue-dialogue-color', stage.dialogueColor, 'dialogueColor');
    dial(root, '--prologue-location-color', stage.locationColor, 'locationColor');
    dial(root, '--prologue-title-scale', stage.titleScale, 'titleScale');
    dial(root, '--prologue-speaker-scale', stage.speakerScale, 'speakerScale');
    dial(root, '--prologue-line-height', stage.lineHeight, 'lineHeight');
    dial(root, '--prologue-letter-spacing', stage.letterSpacing, 'letterSpacing', value => `${value}em`);
    dial(root, '--prologue-measure', stage.textMaxWidth, 'textMaxWidth', value => `${value}ch`);
    dial(root, '--prologue-font', stage.textFont, 'textFont', value => `var(--font-${value === 'display' ? 'display' : 'body'})`);
    // The container, in detail.
    dial(root, '--prologue-box-padding', stage.boxPadding, 'boxPadding', value => `${value}rem`);
    dial(root, '--prologue-box-radius', stage.boxRadius, 'boxRadius', value => `${value}px`);
    dial(root, '--prologue-box-border', stage.boxBorderWidth, 'boxBorderWidth', value => `${value}px`);
    dial(root, '--prologue-box-border-color', stage.boxBorderColor, 'boxBorderColor');
    // A backdrop filter is a compositing pipeline; at zero it is written away
    // entirely rather than left as a no-op blur over the whole caption.
    dial(root, '--prologue-box-backdrop', stage.boxBlur, 'boxBlur', value => `blur(${value}px)`);
    title.hidden = stage.titleVisible === false;
    speaker.hidden = stage.speakerVisible === false;
    progress.hidden = editorPreview || stage.progressStyle === 'hidden';
  }
  // THE PICTURE IS THE PLATE'S, and it is written on the plate rather than on
  // the frame: the two plates overlap for the length of a crossfade, and a
  // property on the frame reached the OUTGOING one too — so a scene that
  // mirrors or blurs its artwork flipped the scene before it in a single frame
  // and then faded over the result.
  function applyPlate(plate, stage) {
    const picture = ['imageBrightness','imageContrast','imageSaturation','imageBlur'];
    const filtered = picture.some(key => stage[key] !== shipped[key]);
    if (filtered) plate.style.setProperty('--prologue-filter', `brightness(${stage.imageBrightness ?? 1}) contrast(${stage.imageContrast ?? 1}) saturate(${stage.imageSaturation ?? 1}) blur(${Number(stage.imageBlur) || 0}px)`);
    dial(plate, '--prologue-flip', stage.imageFlip, 'imageFlip', value => value === true ? '-1' : '1');
    dial(plate, '--prologue-vignette', stage.vignette, 'vignette');
    dial(plate, '--prologue-backdrop', stage.backdropColor, 'backdropColor');
    dial(plate, '--prologue-letterbox', stage.letterboxColor, 'letterboxColor');
    // Fit, focus and scale go through custom properties rather than inline style
    // on the image, so a wireframe that must letterbox (which is a fact about the
    // frame, not about this setting) can still override the fit in CSS.
    dial(plate, '--prologue-fit', stage.imageFit, 'imageFit');
    if (stage.imageFocusX !== shipped.imageFocusX || stage.imageFocusY !== shipped.imageFocusY) {
      plate.style.setProperty('--prologue-focus', `${stage.imageFocusX ?? 50}% ${stage.imageFocusY ?? 50}%`);
    }
    dial(plate, '--prologue-scale', stage.imageScale, 'imageScale');
  }
  // The scenes play in the configured ORDER, over the configured SUBSET; the
  // numbers below stay indices into the authored list, which is what a paused
  // run recorded and what every setting key is named for.
  const order = editorPreview ? [Math.max(0, Math.min(config.scenes.length - 1, startScene))] : prologueSequence(config);
  // A run paused on a scene since switched off resumes on the next scene still
  // in the opening (prologueResumePosition), rather than on one it has watched.
  let position = editorPreview ? 0 : prologueResumePosition(config,Math.max(0,Math.min(config.scenes.length-1,startScene)));
  let sceneIndex = order[position], elapsed = 0;
  let stopped = false, paused = false, loading = false, serial = 0, last = 0, raf = 0;
  let animations = [], previous = null, reveal = null, delayMs = 0;
  const reduced = () => editorPreview || p.reduceMotion || settings.reducedMotion === true || document.body.classList.contains('reduced-motion') || prefersStill.matches;
  const ownerVeil = root.closest('.modal-veil');
  const blocked = () => document.hidden || (topVeil() && topVeil() !== ownerVeil);
  const transitionMs = (scene,stage) => prologueTransitionMs(scene,stage,reduced());
  function cleanup() {
    if (stopped) return;
    stopped = true; serial++; cancelAnimationFrame(raf);
    animations.forEach(a=>a.cancel());
    portrait.removeEventListener('change',rotate);
    document.removeEventListener('visibilitychange',visibility);
    document.removeEventListener(ART_SOURCE_EVENT,repaintActor);
  }
  function finish(reason) { if (stopped) return; cleanup(); onFinish(reason); }
  // The character painting, at whatever tier assetUrl() names now (ready()
  // retries a missing high-res painting with the built-in art).
  async function characterSource() {
    const source = new Image(); source.src = prologueArtwork(classId);
    await ready(source);
    return source;
  }
  // Art quality changed while this scene is up (Settings opened from the
  // pause): the canvas holds pixels, not a URL, so repaint it.
  let mountedActor = null;
  async function repaintActor() {
    const mounted = mountedActor;
    if (!mounted || stopped || mounted.token !== serial) return;
    const source = await characterSource();
    if (stopped || mountedActor !== mounted || mounted.token !== serial || !source.naturalWidth) return;
    paintPrologueCharacter(mounted.actor,source,p.shadowStrength);
  }
  function togglePause() { paused = !paused; last = 0; pause.textContent = paused ? config.labels.resume : config.labels.pause; }
  function visibility() { last = 0; }
  function rotate() { showScene(position,{resumeAt:elapsed,notify:false}); }
  function paintDelay(at) { caption.classList.toggle('prologue-text-waiting', at < delayMs && !reduced()); }
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
    // The plate is still detached here, so the document's missing-high-res
    // listener cannot see a failure: a high-res file that does not load
    // retries once with the built-in art (builtInFor) before it is hidden.
    let timeout;
    const decoded = () => Promise.race([image.decode(), new Promise(resolve=>{timeout=setTimeout(resolve,8000);})]);
    try { await decoded(); }
    catch {
      clearTimeout(timeout);
      const fallback = builtInFor(image.getAttribute('src'));
      if (fallback) {
        image.setAttribute('src', fallback);
        try { await decoded(); return; } catch { /* the built-in art is missing too */ }
      }
      image.hidden = true;
    }
    finally { clearTimeout(timeout); }
  }
  async function showScene(at,{resumeAt = 0,notify = true} = {}) {
    const token = ++serial; loading = true; next.disabled = true;
    position = Math.max(0,Math.min(order.length-1,at)); sceneIndex = order[position]; elapsed = resumeAt; last = 0;
    const scene = config.scenes[sceneIndex], layout = forceLayout || (portrait.matches ? 'mobile' : 'desktop');
    const copy = prologueCopy(scene,config,{classId,name:run.customization?.name || 'Forsaken',location:destination.name});
    if (notify) onScene(sceneIndex);
    const stage_ = prologueStaging(config,scene);
    const plate = el('div',{class:'prologue-plate'});
    applyPlate(plate,stage_);
    // The painting is the scene's CHOICE, not its name (prologueSceneArt), so
    // a resequenced opening can keep a scene's words over another's artwork —
    // and `null` is a scene with no painting at all, which is what an added
    // scene is until the owner points it at one.
    const art = prologueSceneArt(scene);
    const images = [];
    if (art) {
      const background = el('img',{class:'prologue-background',alt:'',src:prologueArtwork(art,layout,{classId,destinationArt:scene.id === 'step' ? destination.art : 'crownfall'})});
      images.push(background); plate.append(background);
    } else {
      plate.classList.add('prologue-plate-bare');
    }
    if (scene.character) {
      const actor = el('canvas',{class:'prologue-actor'});
      const source = await characterSource();
      if (stopped || token !== serial) return;
      if (source.naturalWidth) {
        paintPrologueCharacter(actor,source,p.shadowStrength);
        mountedActor = { actor, token };
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
    location.textContent = copy.location; location.hidden = !copy.location || stage_.locationVisible === false;
    // THE WHOLE LINE IS ALWAYS IN THE DOM, and the reveal only hides part of it:
    // a screen reader, a text search and `prefers-reduced-motion` all get the
    // finished narration, and nothing has to be re-typed when the scene is
    // resumed after a pause, a rotation or a tab switch.
    // The words may WAIT: the artwork holds alone for a beat before they arrive.
    delayMs = Math.max(0,Number(stage_.textDelaySeconds) || 0) * 1000;
    reveal = startReveal(copy.text,stage_);
    paintDelay(elapsed);
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
    // The counter is numbers, dots, or nothing. Dots are decorative — the same
    // fact is in the label, which is what a screen reader is given.
    if (stage_.progressStyle === 'dots') {
      // A NAME ON A PARAGRAPH IS NOT READ — `aria-label` is prohibited on the
      // paragraph role, so dots alone left an empty, unnamed element. The fact
      // is carried as text nobody sees rather than as an attribute nobody gets.
      progress.replaceChildren(
        el('span',{class:'sr-only',text:`Scene ${position+1} of ${order.length}`}),
        ...order.map((_,at)=>el('span',{class:`prologue-dot${at === position ? ' on' : ''}`,'aria-hidden':'true'})),
      );
    } else {
      progress.textContent = `${position+1} / ${order.length}`;
    }
    stage.append(plate);
    const duration = transitionMs(scene,stage_);
    if (duration) {
      const frames = scene.effect === 'ash' ? [{opacity:0,clipPath:'inset(0 0 100% 0)'},{opacity:1,clipPath:'inset(0)'}]
        : scene.effect === 'dip' ? [{opacity:0,offset:0},{opacity:0,offset:.5},{opacity:1,offset:1}] : [{opacity:0},{opacity:1}];
      animations.push(plate.animate(frames,{duration,fill:'both',easing:stage_.transitionEase || 'ease-in-out'}));
      if (previous && scene.effect === 'dip') animations.push(previous.animate([{opacity:1},{opacity:0}],{duration:duration/2,fill:'both'}));
    }
    const camera = cameraFrames(stage_,scene);
    if (!reduced() && camera) animations.push(plate.animate(camera,{duration:prologueSceneMs(scene),fill:'both',easing:stage_.cameraEase || 'linear'}));
    // A SCENE NOBODY IS WATCHING STILL HAS TO BE DRAWN. The entrance is paused at
    // `elapsed` — 0 for a new scene, which is a fully transparent plate — and
    // `tick` only advances it while the page is visible, unveiled and unpaused.
    // So a tab opened in the background, a screen behind a modal, a capture
    // tool, or Continue pressed while paused held the artwork at opacity 0 and
    // showed the caption over black.
    //
    // THE CLOCK IS WHAT MOVES, not the animations. Finishing them instead left
    // `elapsed` at 0 — the next tick rewound the fade it had just finished, and
    // it finished the CAMERA too, which then popped backwards when the page
    // came back. Advancing the clock past the entrance leaves every animation
    // where that moment in the scene actually puts it.
    if (paused || blocked()) elapsed = Math.max(elapsed,duration);
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
      paintDelay(elapsed);
      if (reveal) reveal(Math.max(0,elapsed-delayMs),reduced());
      // A scene may HOLD: the owner marks it, and it waits for Continue however
      // the opening is otherwise paced.
      if (!editorPreview && p.autoAdvance && !scene.waitForInput && elapsed >= prologueSceneMs(scene) && position < order.length-1) showScene(position+1);
    }
    last = now; raf = requestAnimationFrame(tick);
  }
  // The whole picture can be the Continue button, for a reader who would rather
  // not aim at one.
  if (!editorPreview && p.advanceOnClick === true) {
    stage.style.cursor = 'pointer';
    stage.addEventListener('click',()=>{ if (!loading && !paused) next.click(); });
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
    // Only pause if there is a way back: with Pause hidden, nothing else clears
    // it, and the opening would sit paused for the rest of the run.
    settingsButton.onclick = () => { if (!paused && !pause.hidden) togglePause(); onSettings(); };
    controls.insertBefore(settingsButton,skip);
  }
  if (!forceLayout) portrait.addEventListener('change',rotate);
  document.addEventListener('visibilitychange',visibility);
  document.addEventListener(ART_SOURCE_EVENT,repaintActor);
  // THE FRAME IS UP BEFORE THE ARTWORK IS. `showScene` applies the staging when
  // it appends the plate, which waits on the painting decoding (up to eight
  // seconds when the file is missing) — so the opening used to draw its first
  // scene in the shipped caption layout and jump into the chosen one later.
  applyStaging(prologueStaging(config,config.scenes[sceneIndex]));
  showScene(position); raf = requestAnimationFrame(tick); if (!editorPreview) next.focus({preventScroll:true});
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
