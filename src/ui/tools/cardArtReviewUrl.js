/** The game root for a card-art review module URL: src/ui/tools/x.js is three directories below it,
 * so a deployment prefix such as /AshenSpire/ is kept. */
export const gameRootURL = moduleURL => new URL('../../../', moduleURL);
