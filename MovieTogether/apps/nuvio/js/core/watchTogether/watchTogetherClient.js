import { WATCH_TOGETHER_API_BASE_URL } from "../../config.js";
import { LocalStore } from "../storage/localStore.js";

const DEVICE_KEY = "nuvio.watchTogether.deviceId";
const PROFILE_KEY = "nuvio.watchTogether.profile";

function apiBase() {
  return String(WATCH_TOGETHER_API_BASE_URL || "").replace(/\/$/, "");
}

function apiUrl(path) {
  return `${apiBase()}${path}`;
}

async function request(path, options = {}) {
  const response = await fetch(apiUrl(path), options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Watch Together request failed: ${response.status}`);
  }
  return data;
}

function randomId(prefix) {
  const value = globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${value}`;
}

function getDeviceId() {
  let id = LocalStore.get(DEVICE_KEY);
  if (!id) {
    id = randomId("nuvio");
    LocalStore.set(DEVICE_KEY, id);
  }
  return id;
}

function defaultProfile() {
  const suffix = String(getDeviceId()).replace(/[^a-z0-9]/gi, "").slice(-6).toLowerCase() || "guest";
  return {
    display_name: `Nuvio ${suffix.toUpperCase()}`,
    username: `nuvio_${suffix}`
  };
}

export const WatchTogetherClient = {
  getDeviceId,

  async ensureProfile() {
    const deviceId = getDeviceId();
    const existing = await request(`/api/profile?device_id=${encodeURIComponent(deviceId)}`).catch(() => ({ user: null }));
    if (existing.user) {
      LocalStore.set(PROFILE_KEY, existing.user);
      return existing.user;
    }
    const profile = LocalStore.get(PROFILE_KEY) || defaultProfile();
    const created = await request("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        device_id: deviceId,
        username: String(profile.username || defaultProfile().username).toLowerCase(),
        display_name: profile.display_name || defaultProfile().display_name,
        avatar_url: profile.avatar_url || "nuvio"
      })
    });
    LocalStore.set(PROFILE_KEY, created.user);
    return created.user;
  },

  async createRoomFromNuvio({ params = {}, stream = {}, streamUrl = "", isPublic = false, maxMembers = 10 } = {}) {
    await this.ensureProfile();
    const title = params.itemTitle || params.playerTitle || params.fallbackTitle || "Nuvio Watch Party";
    const body = {
      device_id: getDeviceId(),
      name: `${title} Watch Together`,
      movie_title: title,
      movie_description: params.description || params.playerSubtitle || "",
      movie_genre: params.genres || "",
      movie_year: Number.parseInt(params.year || params.playerReleaseYear || "", 10) || null,
      movie_poster_url: params.poster || params.playerBackdropUrl || params.logo || null,
      stream_url: streamUrl || stream.url || stream.externalUrl || "",
      selected_stream: stream,
      content_type: params.itemType || "movie",
      content_id: params.itemId || params.videoId || null,
      max_members: maxMembers,
      is_public: isPublic
    };
    return request("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  },

  joinRoom(roomId, inviteCode = "") {
    return request(`/api/rooms/${roomId}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id: getDeviceId(), invite_code: inviteCode })
    });
  },

  getRoom(roomId) {
    return request(`/api/rooms/${roomId}`);
  },

  leaveRoom(roomId) {
    return request(`/api/rooms/${roomId}/leave`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id: getDeviceId() })
    });
  },

  heartbeat(roomId) {
    return request(`/api/rooms/${roomId}/heartbeat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id: getDeviceId() })
    });
  },

  playback(roomId, event, payload = {}) {
    return request(`/api/rooms/${roomId}/playback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id: getDeviceId(), event, payload })
    });
  },

  voice(roomId, payload = {}) {
    return request(`/api/rooms/${roomId}/voice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id: getDeviceId(), ...payload })
    });
  },

  discussion(roomId, action, extras = {}) {
    return request(`/api/rooms/${roomId}/discussion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id: getDeviceId(), action, ...extras })
    });
  },

  react(roomId, emoji, playbackPosition = 0) {
    return request("/api/reactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id: getDeviceId(), room_id: roomId, emoji, playback_position: playbackPosition })
    });
  },

  async getReactions(roomId, since) {
    const query = since ? `&since=${encodeURIComponent(since)}` : "";
    return request(`/api/reactions?room_id=${roomId}${query}`);
  },

  inviteUrl(room) {
    const code = room?.invite_code || room?.inviteCode || "";
    const origin = globalThis.location?.origin || "";
    return `${origin}/join/${code}`;
  }
};
