import { WatchTogetherClient } from "./watchTogetherClient.js";

const DRIFT_SOFT_SECONDS = 0.1;
const DRIFT_HARD_SECONDS = 0.5;

function nowSeconds() {
  return Date.now() / 1000;
}

function projectedPosition(state = {}) {
  const position = Number(state.position || 0);
  if (state.status !== "playing") return position;
  const updatedAt = Date.parse(state.updated_at || "");
  if (!Number.isFinite(updatedAt)) return position;
  return position + Math.max(0, nowSeconds() - updatedAt / 1000) * Number(state.speed || 1);
}

export const WatchTogetherSync = {
  roomId: null,
  room: null,
  PlayerController: null,
  canControl: false,
  suppressLocalEvents: false,
  heartbeatTimer: null,
  pollTimer: null,
  reactionSince: null,
  voiceState: { muted: false, deafened: false, push_to_talk: false, speaking: false },
  listeners: [],
  overlayRoot: null,

  attach({ roomId, room = null, PlayerController, canControl = false, onUpdate = null } = {}) {
    this.detach();
    this.roomId = roomId ? String(roomId) : null;
    this.room = room;
    this.PlayerController = PlayerController;
    this.canControl = Boolean(canControl);
    this.onUpdate = onUpdate;
    if (!this.roomId || !PlayerController?.video) return;

    const video = PlayerController.video;
    const bind = (event, handler) => {
      video.addEventListener(event, handler);
      this.listeners.push(() => video.removeEventListener(event, handler));
    };
    bind("play", () => this.sendLocalPlayback("PLAY"));
    bind("pause", () => this.sendLocalPlayback("PAUSE"));
    bind("seeked", () => this.sendLocalPlayback("SEEK"));

    this.heartbeatTimer = setInterval(() => {
      WatchTogetherClient.heartbeat(this.roomId).catch(() => {});
      this.sendVoiceState().catch(() => {});
    }, 8000);
    this.pollTimer = setInterval(() => this.refresh(), 1500);
    this.refresh();
  },

  detach() {
    this.listeners.forEach((fn) => fn());
    this.listeners = [];
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.heartbeatTimer = null;
    this.pollTimer = null;
    if (this.roomId) {
      WatchTogetherClient.voice(this.roomId, { action: "leave" }).catch(() => {});
    }
    this.roomId = null;
    this.room = null;
    this.PlayerController = null;
    this.canControl = false;
    this.suppressLocalEvents = false;
  },

  async refresh() {
    if (!this.roomId) return null;
    const data = await WatchTogetherClient.getRoom(this.roomId).catch(() => null);
    if (!data?.room) return null;
    this.room = data.room;
    const me = await WatchTogetherClient.ensureProfile().catch(() => null);
    const member = (data.room.members || []).find((entry) => entry.user_id === me?.id);
    this.canControl = data.room.host_id === me?.id || member?.can_control === true;
    this.applyPlaybackState(data.room.playback_state || {});
    this.onUpdate?.(data.room);
    return data.room;
  },

  localPosition() {
    if (typeof this.PlayerController?.getCurrentTimeSeconds === "function") {
      return Number(this.PlayerController.getCurrentTimeSeconds() || 0);
    }
    return Number(this.PlayerController?.video?.currentTime || 0);
  },

  applyPlaybackState(state = {}) {
    const controller = this.PlayerController;
    const video = controller?.video;
    if (!video || !state) return;
    const target = projectedPosition(state);
    const local = this.localPosition();
    const drift = Math.abs(local - target);
    this.suppressLocalEvents = true;
    try {
      if (drift > DRIFT_HARD_SECONDS || (state.status !== "playing" && drift > DRIFT_SOFT_SECONDS)) {
        if (typeof controller.seekToSeconds === "function") {
          controller.seekToSeconds(target);
        } else {
          video.currentTime = target;
        }
      }
      if (state.status === "playing" && video.paused) {
        controller.resume?.();
      } else if (state.status !== "playing" && !video.paused) {
        controller.pause?.();
      }
    } finally {
      setTimeout(() => {
        this.suppressLocalEvents = false;
      }, 350);
    }
  },

  sendLocalPlayback(event) {
    if (!this.roomId || !this.canControl || this.suppressLocalEvents) return;
    const payload = {
      position: this.localPosition(),
      speed: Number(this.PlayerController?.video?.playbackRate || 1)
    };
    WatchTogetherClient.playback(this.roomId, event, payload).catch(() => {});
  },

  command(event, payload = {}) {
    if (!this.roomId) return Promise.resolve(null);
    return WatchTogetherClient.playback(this.roomId, event, {
      position: this.localPosition(),
      ...payload
    }).then(() => this.refresh());
  },

  setVoiceState(patch = {}) {
    this.voiceState = { ...this.voiceState, ...patch };
    return this.sendVoiceState();
  },

  sendVoiceState() {
    if (!this.roomId) return Promise.resolve(null);
    return WatchTogetherClient.voice(this.roomId, this.voiceState);
  },

  startDiscussion(timeout = 10) {
    if (!this.roomId) return Promise.resolve(null);
    return WatchTogetherClient.discussion(this.roomId, "start", { auto_resume: true, silence_timeout: timeout });
  },

  endDiscussion() {
    if (!this.roomId) return Promise.resolve(null);
    return WatchTogetherClient.discussion(this.roomId, "end");
  },

  react(emoji) {
    if (!this.roomId) return Promise.resolve(null);
    return WatchTogetherClient.react(this.roomId, emoji, this.localPosition());
  }
};
