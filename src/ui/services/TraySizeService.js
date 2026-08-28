const PREFIX = 'ashenspire.ui.tray-size';
const fallback = new Map();

function key(id, edge) {
  return `${PREFIX}:${id}:${edge}`;
}

function browserStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function createTraySizeService(storage = browserStorage()) {
  return Object.freeze({
    read(id, edge) {
      try {
        const value = Number(storage?.getItem(key(id, edge)) ?? fallback.get(key(id, edge)));
        return Number.isFinite(value) && value > 0 ? value : null;
      } catch {
        return fallback.get(key(id, edge)) || null;
      }
    },
    write(id, edge, size) {
      const value = Math.round(size);
      fallback.set(key(id, edge), value);
      try {
        storage?.setItem(key(id, edge), String(value));
      } catch {
        // The in-memory copy preserves the interaction when browser storage is unavailable.
      }
      return value;
    },
  });
}

export const traySizeService = createTraySizeService();
