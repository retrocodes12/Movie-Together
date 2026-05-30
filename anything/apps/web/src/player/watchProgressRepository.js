/**
 * Watch Progress Repository
 * Stores progress in localStorage keyed by videoId.
 * Adapted from Nuvio's watchProgressRepository for browser-local storage.
 */

const STORAGE_KEY = "mt_watch_progress";
const MAX_ITEMS = 200;

function loadStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (_) {
    return {};
  }
}

function saveStore(store) {
  try {
    // Prune oldest if over limit
    const keys = Object.keys(store);
    if (keys.length > MAX_ITEMS) {
      const sorted = keys.sort(
        (a, b) => (store[a].updatedAt || 0) - (store[b].updatedAt || 0),
      );
      sorted.slice(0, keys.length - MAX_ITEMS).forEach((k) => delete store[k]);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (_) {
    // storage full / SSR
  }
}

export const watchProgressRepository = {
  save({ videoId, currentTime, duration, roomId }) {
    if (!videoId || currentTime == null) return;
    const store = loadStore();
    store[String(videoId)] = {
      videoId,
      currentTime: Number(currentTime) || 0,
      duration: Number(duration) || 0,
      roomId: roomId || null,
      updatedAt: Date.now(),
    };
    saveStore(store);
  },

  get(videoId) {
    if (!videoId) return null;
    const store = loadStore();
    return store[String(videoId)] || null;
  },

  getResumeTime(videoId) {
    const entry = this.get(videoId);
    if (!entry) return 0;
    // Don't resume in last 5% or if very close to start
    const pct = entry.duration > 0 ? entry.currentTime / entry.duration : 0;
    if (pct > 0.95 || entry.currentTime < 5) return 0;
    return entry.currentTime;
  },

  remove(videoId) {
    if (!videoId) return;
    const store = loadStore();
    delete store[String(videoId)];
    saveStore(store);
  },

  clear() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
  },
};
