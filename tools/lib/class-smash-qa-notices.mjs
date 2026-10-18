// audio.js warmSample uses synth immediately and probes these optional filenames.
const optionalIds = new Set(['holdTick','cardPlay','hit_heavy','hit_medium','hit_light','beat','holdCommit','relic']);
export function optionalClassSmashAudioProbe(url, status, buildUrl) {
  if (status !== 404) return false;
  try {
    const actual=new URL(url), base=new URL('assets/sfx/',buildUrl);
    if(actual.origin!==base.origin || !actual.pathname.startsWith(base.pathname))return false;
    const name=actual.pathname.slice(base.pathname.length);
    return name.endsWith('.ogg') && optionalIds.has(name.slice(0,-4));
  }catch{return false;}
}
export function classSmashConsoleNotice(text) {
  if(text.startsWith('Blocked call to navigator.vibrate'))return 'vibration-blocked';
  // Keep this raw text; response handling separately identifies its URL/status
  // and rejects unknown URLs or any status other than the permitted exact404.
  if(/^Failed to load resource:.*404/.test(text))return 'http404-console';
  return null;
}
