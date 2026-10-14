// Electron and script-opened windows honor window.close(). A normal browser
// tab may refuse it without throwing, so keep an explicit, recoverable screen.
export function mountQuitScreen(app, {
  savedRun = false,
  onBack,
  closeWindow = () => window.close(),
  windowClosed = () => window.closed,
  schedule = setTimeout,
  cancel = clearTimeout,
}) {
  app.innerHTML = `
    <div class="screen farewell">
      <h1 class="title-big">THE EMBER GUTTERS</h1>
      <p class="subtitle" style="text-align:center" role="status" id="farewell-status">${savedRun ? 'Your climb is saved. ' : ''}Closing Ashen Spire…</p>
      <button class="subtle" id="farewell-back" data-back>Return to title</button>
    </div>`;
  const status = app.querySelector('#farewell-status');
  const back = app.querySelector('#farewell-back');
  const closeTimer = schedule(() => {
    try { closeWindow(); } catch { /* Refusal is reported below, including silent refusal. */ }
    if (!windowClosed()) {
      status.textContent = `${savedRun ? 'Your climb is saved. ' : ''}Your browser kept this window open. You can close it now, or return to the title.`;
    }
  }, 120);
  back.addEventListener('click', () => {
    cancel(closeTimer);
    onBack();
  });
  back.focus({ preventScroll: true });
}
