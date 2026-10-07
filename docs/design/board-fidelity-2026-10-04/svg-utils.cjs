// Pure native-SVG helper. Use a different instance prefix for every inline copy.
function namespaceSvg(source, instancePrefix) {
  if(!/^[A-Za-z][A-Za-z0-9_-]*$/.test(instancePrefix))throw new Error('SVG instance prefix must be a simple identifier');
  const ids=[...source.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
  for(const id of ids) {
    source=source.replaceAll(`id="${id}"`,`id="${instancePrefix}-${id}"`)
      .replaceAll(`url(#${id})`,`url(#${instancePrefix}-${id})`)
      .replaceAll(`href="#${id}"`,`href="#${instancePrefix}-${id}"`);
  }
  return source;
}
module.exports={namespaceSvg};
