const PREFIX = 'ashenspire.ui.tray-size';
const sessionValues = new Map();

function key(id, edge) {
  return `${PREFIX}:${id}:${edge}`;
}

function browserStorage() {
  // Tray geometry is play-session state, not a profile preference. The default
  // service deliberately stays in memory so reload/new play starts authored.
  return null;
}

export function createTraySizeService(storage = browserStorage()) {
  return Object.freeze({
    read(id, edge) {
      try {
        const value = Number(storage?.getItem(key(id, edge)) ?? sessionValues.get(key(id, edge)));
        return Number.isFinite(value) && value > 0 ? value : null;
      } catch {
        return sessionValues.get(key(id, edge)) || null;
      }
    },
    write(id, edge, size) {
      const value = Math.round(size);
      sessionValues.set(key(id, edge), value);
      try {
        storage?.setItem(key(id, edge), String(value));
      } catch {
        // The in-memory copy preserves the interaction when browser storage is unavailable.
      }
      return value;
    },
    reset() {
      sessionValues.clear();
      if (!storage) return;
      try {
        for (let index = storage.length - 1; index >= 0; index -= 1) {
          const candidate = storage.key(index);
          if (candidate?.startsWith(`${PREFIX}:`)) storage.removeItem(candidate);
        }
      } catch {
        // In-memory state is already reset; unavailable storage cannot retain it.
      }
    },
  });
}

export const traySizeService = createTraySizeService();
