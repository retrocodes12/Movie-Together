/**
 * HLS.js Engine — direct port from NuvioMedia/NuvioWeb
 */
function getHlsConstructor() {
  return globalThis.Hls || null;
}

export const hlsJsEngine = {
  name: "hls.js",

  isSupported() {
    const Hls = getHlsConstructor();
    return Boolean(
      Hls && typeof Hls.isSupported === "function" && Hls.isSupported(),
    );
  },

  getConstructor() {
    return getHlsConstructor();
  },

  create(config = {}) {
    const Hls = getHlsConstructor();
    if (!Hls) return null;
    return new Hls({
      enableWorker: true,
      lowLatencyMode: false,
      backBufferLength: 90,
      ...config,
    });
  },

  getAudioTracks(instance) {
    const trackList = instance?.audioTracks;
    if (!trackList) return [];
    try {
      return Array.from(trackList).filter(Boolean);
    } catch (_) {
      return [];
    }
  },

  getSelectedAudioTrackIndex(instance) {
    const idx = Number(instance?.audioTrack);
    if (!Number.isFinite(idx) || idx < 0) return -1;
    return idx;
  },

  setAudioTrack(instance, index) {
    const idx = Number(index);
    const tracks = this.getAudioTracks(instance);
    if (!Number.isFinite(idx) || idx < 0 || idx >= tracks.length) return false;
    try {
      instance.audioTrack = idx;
      return true;
    } catch (_) {
      return false;
    }
  },

  getSubtitleTracks(instance) {
    if (!instance?.subtitleTracks) return [];
    try {
      return Array.from(instance.subtitleTracks).filter(Boolean);
    } catch (_) {
      return [];
    }
  },

  setSubtitleTrack(instance, index) {
    if (!instance) return false;
    try {
      instance.subtitleTrack = index;
      instance.subtitleDisplay = index >= 0;
      return true;
    } catch (_) {
      return false;
    }
  },

  getLevels(instance) {
    if (!instance?.levels) return [];
    try {
      return Array.from(instance.levels).filter(Boolean);
    } catch (_) {
      return [];
    }
  },

  getCurrentLevel(instance) {
    return instance?.currentLevel ?? -1;
  },

  setLevel(instance, level) {
    if (!instance) return;
    instance.currentLevel = level;
  },
};
