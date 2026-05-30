/**
 * RoomSyncService
 *
 * Production-quality room synchronization layer.
 *
 * Architecture:
 *   • Server-Sent Events (SSE) for real-time server→client push
 *   • REST mutations for client→server events (PLAY, PAUSE, SEEK …)
 *   • Heartbeat loop for presence tracking + host-migration support
 *   • Automatic reconnect with exponential backoff
 *   • State recovery after reconnect (server is source of truth)
 *
 * This replaces Socket.IO on the serverless platform while preserving
 * the same event semantics (PLAY, PAUSE, SEEK, SYNC, HOST_CHANGED …).
 */

import {
  SyncEvents,
  PlaybackEvents,
  HEARTBEAT_INTERVAL,
  SEEK_SYNC_THRESHOLD,
} from "./types";

const BASE_URL = process.env.EXPO_PUBLIC_BASE_URL || "";

// ── Reconnect config ───────────────────────────────────────────────────────
const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 15000, 30000]; // ms
const MAX_RECONNECT_ATTEMPTS = 10;

// ── Playback drift correction ──────────────────────────────────────────────
const DRIFT_THRESHOLD_S = SEEK_SYNC_THRESHOLD; // seconds
const POSITION_SAMPLE_INTERVAL = 5000; // ms — local position update rate

class RoomSyncService {
  constructor() {
    this._roomId = null;
    this._deviceId = null;
    this._userId = null;

    // SSE
    this._eventSource = null;
    this._sseConnected = false;
    this._reconnectAttempts = 0;
    this._reconnectTimer = null;
    this._pollTimer = null; // fallback polling timer

    // Heartbeat
    this._heartbeatTimer = null;

    // Local playback clock
    this._positionTimer = null;
    this._localPosition = 0;
    this._positionSyncedAt = null; // Date.now() when position was last synced from server
    this._isPlaying = false;

    // Listeners — key: SyncEventType, value: Set<Function>
    this._listeners = new Map();

    // Pending mutations (optimistic)
    this._pendingMutations = new Map();
  }

  // ── Public API ─────────────────────────────────────────────────────────

  /**
   * Connect to a room's sync stream.
   * @param {string} roomId
   * @param {string} deviceId
   * @param {number} userId
   */
  connect(roomId, deviceId, userId) {
    if (this._roomId === roomId && this._sseConnected) return;

    this.disconnect();

    this._roomId = String(roomId);
    this._deviceId = deviceId;
    this._userId = userId;
    this._reconnectAttempts = 0;

    this._openSSE();
    this._startHeartbeat();
  }

  disconnect() {
    this._closeSSE();
    this._stopHeartbeat();
    this._stopPositionClock();
    if (this._pollTimer) {
      clearTimeout(this._pollTimer);
      this._pollTimer = null;
    }
    this._roomId = null;
    this._deviceId = null;
    this._userId = null;
    this._sseConnected = false;
    this._reconnectAttempts = 0;
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
  }

  /** Subscribe to sync events. Returns unsubscribe fn. */
  on(eventType, callback) {
    if (!this._listeners.has(eventType)) {
      this._listeners.set(eventType, new Set());
    }
    this._listeners.get(eventType).add(callback);
    return () => this._listeners.get(eventType)?.delete(callback);
  }

  /** Send a playback command to the server (host only). */
  async sendPlaybackEvent(event, payload = {}) {
    if (!this._roomId || !this._deviceId) {
      throw new Error("Not connected to a room");
    }

    const mutationId = `${event}_${Date.now()}`;
    this._pendingMutations.set(mutationId, { event, payload, ts: Date.now() });

    try {
      const res = await fetch(
        `${BASE_URL}/api/rooms/${this._roomId}/playback`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ device_id: this._deviceId, event, payload }),
        },
      );

      if (!res.ok) {
        const err = await res
          .json()
          .catch(() => ({ error: "Playback command failed" }));
        this._pendingMutations.delete(mutationId);
        throw new Error(err.error || "Playback command failed");
      }

      const data = await res.json();
      this._pendingMutations.delete(mutationId);

      // Apply confirmed state immediately (optimistic confirmation)
      this._applyPlaybackState(data.playback_state, data.server_time);
      this._emit(event, {
        playback_state: data.playback_state,
        server_time: data.server_time,
      });

      return data;
    } catch (err) {
      this._pendingMutations.delete(mutationId);
      throw err;
    }
  }

  /** Request current server state (any member). */
  async requestSync() {
    if (!this._roomId || !this._deviceId) return null;
    try {
      const res = await fetch(
        `${BASE_URL}/api/rooms/${this._roomId}/playback`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ device_id: this._deviceId, event: "SYNC" }),
        },
      );
      if (!res.ok) return null;
      const data = await res.json();
      this._applyPlaybackState(data.playback_state, data.server_time);
      this._emit(SyncEvents.SYNC, data);
      return data;
    } catch (e) {
      console.error("RoomSync requestSync error:", e);
      return null;
    }
  }

  /** Get locally interpolated playback position (seconds). */
  getCurrentPosition() {
    if (!this._isPlaying || !this._positionSyncedAt) return this._localPosition;
    const elapsed = (Date.now() - this._positionSyncedAt) / 1000;
    return this._localPosition + elapsed;
  }

  get isConnected() {
    return this._sseConnected;
  }
  get roomId() {
    return this._roomId;
  }

  // ── SSE ───────────────────────────────────────────────────────────────

  _openSSE() {
    if (!this._roomId || !this._deviceId) return;

    this._closeSSE();

    const url = `${BASE_URL}/api/rooms/${this._roomId}/stream?device_id=${encodeURIComponent(this._deviceId)}`;

    // React Native / Expo doesn't have native EventSource — use fetch-based polling fallback
    // We implement a compatible interface using the platform-available fetch streaming
    this._startSSEFetch(url);
  }

  async _startSSEFetch(url) {
    if (!this._roomId) return;

    try {
      const controller = new AbortController();
      this._sseAbortController = controller;

      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "text/event-stream", "Cache-Control": "no-cache" },
      });

      if (!res.ok) {
        throw new Error(`SSE connect failed: ${res.status}`);
      }

      this._sseConnected = true;
      this._reconnectAttempts = 0;
      this._emit("CONNECTION_STATE", { connected: true });

      // Check if ReadableStream is supported
      let reader = null;
      try {
        reader = res.body?.getReader();
      } catch (streamError) {
        // ReadableStream not supported — fall back to polling
        console.warn(
          "ReadableStream not supported, falling back to polling:",
          streamError?.message,
        );
        this._fallbackToPolling();
        return;
      }

      if (!reader) {
        console.warn("No readable stream available, falling back to polling");
        this._fallbackToPolling();
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE frames from buffer
        const frames = buffer.split("\n\n");
        buffer = frames.pop() || ""; // last partial frame stays in buffer

        for (const frame of frames) {
          this._parseSSEFrame(frame);
        }
      }

      // Stream closed — schedule reconnect
      this._scheduleReconnect();
    } catch (err) {
      if (err?.name === "AbortError") return; // intentional disconnect
      if (err?.name === "NotSupportedError") {
        console.warn("NotSupportedError detected, falling back to polling");
        this._fallbackToPolling();
        return;
      }
      console.warn("RoomSync SSE error:", err?.message);
      this._sseConnected = false;
      this._emit("CONNECTION_STATE", { connected: false, error: err?.message });
      this._scheduleReconnect();
    }
  }

  /**
   * Fallback polling mechanism for browsers that don't support ReadableStream.
   * Polls the sync endpoint every 3 seconds instead of using SSE.
   */
  _fallbackToPolling() {
    if (!this._roomId) return;

    this._sseConnected = true;
    this._reconnectAttempts = 0;
    this._emit("CONNECTION_STATE", { connected: true, polling: true });

    const poll = async () => {
      if (!this._roomId || !this._deviceId) return;
      try {
        const syncData = await this.requestSync();
        if (syncData) {
          // Sync successful — keep polling
        }
      } catch (e) {
        console.warn("Polling sync error:", e?.message);
      }

      // Schedule next poll if still connected
      if (this._roomId && this._sseConnected) {
        this._pollTimer = setTimeout(poll, 3000);
      }
    };

    // Start polling
    poll();
  }

  _parseSSEFrame(frame) {
    if (!frame || frame.startsWith(":")) return; // ping / comment

    let eventType = "message";
    let data = "";

    for (const line of frame.split("\n")) {
      if (line.startsWith("event:")) {
        eventType = line.slice("event:".length).trim();
      } else if (line.startsWith("data:")) {
        data = line.slice("data:".length).trim();
      }
    }

    if (!data) return;

    try {
      const parsed = JSON.parse(data);
      this._handleServerEvent(eventType, parsed);
    } catch (e) {
      console.warn("SSE parse error:", e, data);
    }
  }

  _handleServerEvent(eventType, msg) {
    switch (eventType) {
      case "ROOM_UPDATED": {
        const room = msg.payload?.room;
        if (room) {
          this._applyPlaybackState(room.playback_state);
          this._emit(SyncEvents.ROOM_UPDATED, msg.payload);
        }
        break;
      }

      case "PLAY": {
        const ps =
          msg.payload?.room?.playback_state || msg.payload?.playback_state;
        if (ps) this._applyPlaybackState(ps, msg.payload?.server_time);
        this._emit(SyncEvents.PLAY, msg.payload);
        break;
      }

      case "PAUSE": {
        const ps =
          msg.payload?.room?.playback_state || msg.payload?.playback_state;
        if (ps) this._applyPlaybackState(ps);
        this._emit(SyncEvents.PAUSE, msg.payload);
        break;
      }

      case "SEEK": {
        const ps =
          msg.payload?.room?.playback_state || msg.payload?.playback_state;
        if (ps) this._applyPlaybackState(ps, msg.payload?.server_time);
        this._emit(SyncEvents.SEEK, msg.payload);
        break;
      }

      case "SYNC": {
        const ps = msg.payload?.playback_state;
        if (ps) this._applyPlaybackState(ps, msg.payload?.server_time);
        this._emit(SyncEvents.SYNC, msg.payload);
        break;
      }

      case "HOST_CHANGED":
        this._emit(SyncEvents.HOST_CHANGED, msg.payload);
        break;

      case "PRESENCE_UPDATE":
        this._emit(SyncEvents.PRESENCE_UPDATE, msg.payload);
        break;

      case "CONTENT_CHANGED":
        this._emit(SyncEvents.CONTENT_CHANGED, msg.payload);
        break;

      case "MEMBER_JOINED":
        this._emit(SyncEvents.MEMBER_JOINED, msg.payload);
        break;

      case "MEMBER_LEFT":
        this._emit(SyncEvents.MEMBER_LEFT, msg.payload);
        break;

      case "error":
        console.error("Server SSE error:", msg);
        break;

      default:
        // Unknown event — emit anyway for extensibility
        this._emit(eventType, msg.payload);
    }
  }

  _closeSSE() {
    this._sseConnected = false;
    if (this._sseAbortController) {
      this._sseAbortController.abort();
      this._sseAbortController = null;
    }
  }

  _scheduleReconnect() {
    if (!this._roomId) return; // disconnected intentionally
    if (this._reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this._emit("CONNECTION_STATE", { connected: false, permanent: true });
      return;
    }

    const delay =
      RECONNECT_DELAYS[
        Math.min(this._reconnectAttempts, RECONNECT_DELAYS.length - 1)
      ];
    this._reconnectAttempts++;

    console.log(
      `RoomSync: reconnecting in ${delay}ms (attempt ${this._reconnectAttempts})`,
    );
    this._emit("CONNECTION_STATE", {
      connected: false,
      reconnecting: true,
      attempt: this._reconnectAttempts,
      delay,
    });

    this._reconnectTimer = setTimeout(() => {
      if (!this._roomId) return;
      this._openSSE();
    }, delay);
  }

  // ── Heartbeat ──────────────────────────────────────────────────────────

  _startHeartbeat() {
    this._stopHeartbeat();
    this._sendHeartbeat(); // immediate first beat
    this._heartbeatTimer = setInterval(
      () => this._sendHeartbeat(),
      HEARTBEAT_INTERVAL,
    );
  }

  _stopHeartbeat() {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
  }

  async _sendHeartbeat() {
    if (!this._roomId || !this._deviceId) return;
    try {
      const res = await fetch(
        `${BASE_URL}/api/rooms/${this._roomId}/heartbeat`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ device_id: this._deviceId }),
        },
      );
      if (res.ok) {
        const data = await res.json();
        this._emit("HEARTBEAT_ACK", data);
        if (data.host_migrated) {
          this._emit(SyncEvents.HOST_CHANGED, {
            new_host_id: data.host_migrated,
          });
        }
      }
    } catch (e) {
      // Heartbeat failure is non-fatal
      console.warn("RoomSync heartbeat failed:", e?.message);
    }
  }

  // ── Local playback clock ────────────────────────────────────────────────

  _applyPlaybackState(ps, serverTime = null) {
    if (!ps) return;

    const wasPlaying = this._isPlaying;
    this._isPlaying = ps.status === "playing";

    if (ps.position !== undefined) {
      // Compensate for server→client latency when server_time is provided
      if (serverTime && this._isPlaying) {
        const latencyS = (Date.now() - serverTime) / 1000;
        this._localPosition = (ps.position || 0) + latencyS;
      } else {
        this._localPosition = ps.position || 0;
      }
      this._positionSyncedAt = Date.now();
    }

    if (this._isPlaying && !wasPlaying) {
      this._startPositionClock();
    } else if (!this._isPlaying && wasPlaying) {
      this._stopPositionClock();
    }
  }

  _startPositionClock() {
    this._stopPositionClock();
    // No-op: position is computed on-demand via getCurrentPosition()
    // This timer exists for periodic drift checks if needed in future
  }

  _stopPositionClock() {
    if (this._positionTimer) {
      clearInterval(this._positionTimer);
      this._positionTimer = null;
    }
  }

  // ── Event emitter ──────────────────────────────────────────────────────

  _emit(eventType, data) {
    const callbacks = this._listeners.get(eventType);
    if (callbacks) {
      callbacks.forEach((cb) => {
        try {
          cb(data);
        } catch (e) {
          console.error("RoomSync listener error:", e);
        }
      });
    }
    // Also emit wildcard '*' listeners
    const wildcards = this._listeners.get("*");
    if (wildcards) {
      wildcards.forEach((cb) => {
        try {
          cb(eventType, data);
        } catch (e) {
          console.error("RoomSync wildcard error:", e);
        }
      });
    }
  }
}

// Singleton — one sync service per app session
export const roomSync = new RoomSyncService();
export default roomSync;
