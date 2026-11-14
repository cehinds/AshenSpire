// The one rule for the name a screen prints for the player's character: a name the player typed wins; with none, every
// screen shows the class name. "Forsaken" is the old default the creation field was pre-filled with, so a stored
// "Forsaken" counts as not typed. Casing is left to the CSS of each place.
const OLD_DEFAULT_NAME = 'forsaken';

/** CharacterDisplayName(customName, className) -> the name to print for the player's character. */
export function CharacterDisplayName(customName, className) {
  const typed = typeof customName === 'string' ? customName.trim() : '';
  if (!typed || typed.toLowerCase() === OLD_DEFAULT_NAME) return className || typed;
  return typed;
}
