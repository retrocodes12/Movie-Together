/**
 * DASH.js Engine — direct port from NuvioMedia/NuvioWeb
 */
function getDashGlobal() {
  return globalThis.dashjs || null;
}

export const dashJsEngine = {
  name: "dash.js",

  isSupported() {
    const dashjs = getDashGlobal();
    if (!dashjs || typeof dashjs.MediaPlayer !== "function") return false;
    try {
      const player = dashjs.MediaPlayer();
      return Boolean(player && typeof player.create === "function");
    } catch (_) {
      return false;
    }
  },

  createPlayer() {
    const dashjs = getDashGlobal();
    return dashjs?.MediaPlayer?.().create?.() || null;
  },

  getEvents() {
    return getDashGlobal()?.MediaPlayer?.events || {};
  },

  initialize(player, videoElement, url, autoPlay = false) {
    if (!player || !videoElement) return false;
    try {
      player.initialize(videoElement, url, autoPlay);
      return true;
    } catch (_) {
      return false;
    }
  },

  getAudioTracks(player) {
    try {
      return player?.getTracksFor?.("audio") || [];
    } catch (_) {
      return [];
    }
  },

  getCurrentAudioTrack(player) {
    try {
      return player?.getCurrentTrackFor?.("audio") || null;
    } catch (_) {
      return null;
    }
  },

  setAudioTrack(player, track) {
    try {
      player?.setCurrentTrack?.(track);
      return true;
    } catch (_) {
      return false;
    }
  },

  getTextTracks(player) {
    try {
      return player?.getTracksFor?.("text") || [];
    } catch (_) {
      return [];
    }
  },

  setTextTrack(player, index) {
    try {
      player?.setTextTrack?.(index);
      return true;
    } catch (_) {
      return false;
    }
  },
};
