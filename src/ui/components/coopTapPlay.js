// Co-op card tap rule, the same as solo's (owner, 2026-10-18 14:15: "make sure I
// don't auto play a card when I click on it once"): the first click on a card
// SELECTS it and the NEXT click on the selected card plays it, however long
// after, with no timing window. Playing is opt-in to one click: oneTap() is read
// at click time, so toggling Settings mid-fight changes the next click.
// selectBeforePlay false (a friendly-target card) means the click's own play is
// already the selecting step (it arms the seat choice), so it never waits.
// The capture listener runs before shared inspection lights the card in its
// bubble phase, so it sees whether the card was already selected.
export function wireCoopTapPlay(card, { selectBeforePlay = true, oneTap = () => false, onPlay }) {
  let selectingClick = false;
  card.addEventListener('click', () => {
    selectingClick = selectBeforePlay && !oneTap()
      && !card.classList.contains('selected') && !card.classList.contains('inspection-selected');
  }, true);
  card.addEventListener('click', () => { if (!selectingClick) onPlay(); });
}
