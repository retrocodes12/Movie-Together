/**
 * useRoomSync
 *
 * React hook that wraps RoomSyncService + useRoomStore into a clean,
 * component-friendly API with:
 *  - Auto-connect / auto-disconnect lifecycle management
 *  - Playback command helpers with optimistic updates + error rollback
 *  - Drift detection (auto-request SYNC if client drifts > threshold)
 *  - Human-readable connection status
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { useRoomStore } from "@/store/roomStore";
import roomSync from "@/utils/roomSync";
import {
  PlaybackEvents,
  SKIP_SECONDS,
  SEEK_SYNC_THRESHOLD,
} from "@/utils/types";

/**
 * @param {object} params
 * @param {string|number|null} params.roomId
 * @param {string|null}        params.deviceId
 * @param {number|null}        params.userId
 * @param {object|null}        params.initialRoom  - room snapshot from join/fetch
 */
export function useRoomSync({ roomId, deviceId, userId, initialRoom }) {
  const store = useRoomStore();
  const [commandError, setCommandError] = useState(null);
  const driftCheckRef = useRef(null);

  // ── Lifecycle: connect / disconnect ───────────────────────────────────
  useEffect(() => {
    if (!roomId || !deviceId || !userId || !initialRoom) return;

    store.connectToRoom(initialRoom, userId, deviceId);

    return () => {
      store.disconnectFromRoom();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, deviceId, userId, initialRoom?.id]);

  // ── Drift correction — non-hosts auto-sync if too far off ─────────────
  useEffect(() => {
    if (store.isHost) return; // hosts are the source of truth

    driftCheckRef.current = setInterval(() => {
      const ps = store.playbackState;
      if (ps.status !== "playing") return;

      const localPos = roomSync.getCurrentPosition();
      const serverPos = ps.position;
      const drift = Math.abs(localPos - serverPos);

      if (drift > SEEK_SYNC_THRESHOLD) {
        roomSync.requestSync();
      }
    }, 8000);

    return () => clearInterval(driftCheckRef.current);
  }, [store.isHost, store.playbackState]);

  // ── Command helpers ────────────────────────────────────────────────────

  const sendCommand = useCallback(async (event, payload = {}) => {
    setCommandError(null);
    try {
      return await roomSync.sendPlaybackEvent(event, payload);
    } catch (err) {
      setCommandError(err.message || "Command failed");
      store.clearOptimistic();
      throw err;
    }
  }, []);

  const play = useCallback(
    async (position) => {
      const pos = position ?? roomSync.getCurrentPosition();
      store.optimisticPlay(pos);
      return sendCommand(PlaybackEvents.PLAY, { position: pos });
    },
    [sendCommand],
  );

  const pause = useCallback(async () => {
    const pos = roomSync.getCurrentPosition();
    store.optimisticPause(pos);
    return sendCommand(PlaybackEvents.PAUSE, { position: pos });
  }, [sendCommand]);

  const seek = useCallback(
    async (position) => {
      store.optimisticSeek(position);
      return sendCommand(PlaybackEvents.SEEK, { position });
    },
    [sendCommand],
  );

  const skipForward = useCallback(
    async (seconds = SKIP_SECONDS) => {
      const pos = roomSync.getCurrentPosition() + seconds;
      store.optimisticSeek(pos);
      return sendCommand(PlaybackEvents.SKIP_FORWARD, { seconds });
    },
    [sendCommand],
  );

  const skipBackward = useCallback(
    async (seconds = SKIP_SECONDS) => {
      const pos = Math.max(0, roomSync.getCurrentPosition() - seconds);
      store.optimisticSeek(pos);
      return sendCommand(PlaybackEvents.SKIP_BACKWARD, { seconds });
    },
    [sendCommand],
  );

  const changeContent = useCallback(
    async (contentUrl) => {
      return sendCommand(PlaybackEvents.CHANGE_CONTENT, {
        content_url: contentUrl,
      });
    },
    [sendCommand],
  );

  const setSubtitle = useCallback(
    async (subtitleUrl) => {
      return sendCommand("SET_SUBTITLE", { subtitle_url: subtitleUrl || null });
    },
    [sendCommand],
  );

  const setAudioTrack = useCallback(
    async (audioTrack) => {
      return sendCommand("SET_AUDIO_TRACK", { audio_track: audioTrack });
    },
    [sendCommand],
  );

  const setSpeed = useCallback(
    async (speed) => {
      return sendCommand("SET_SPEED", { speed });
    },
    [sendCommand],
  );

  const requestSync = useCallback(() => roomSync.requestSync(), []);

  // ── Derived state ──────────────────────────────────────────────────────

  const effectivePlayback = store.getEffectivePlayback();
  const onlineCount = store.getOnlineCount();
  const connectionStatus = store.isConnected
    ? "connected"
    : store.isReconnecting
      ? `reconnecting (${store.reconnectAttempt})`
      : "disconnected";

  return {
    // Room state
    room: store.room,
    members: store.members,
    presenceMap: store.presenceMap,
    recentEvents: store.recentEvents,

    // Playback state (effective = optimistic if pending, else server-confirmed)
    playbackState: effectivePlayback,
    isPlaying: effectivePlayback.status === "playing",
    isPaused: effectivePlayback.status === "paused",
    currentPosition: roomSync.getCurrentPosition(),

    // Host / membership
    isHost: store.isHost,
    onlineCount,

    // Connection
    isConnected: store.isConnected,
    isReconnecting: store.isReconnecting,
    connectionStatus,
    lastSyncedAt: store.lastSyncedAt,

    // Errors
    commandError,
    clearCommandError: () => setCommandError(null),

    // Commands (host only — server enforces)
    play,
    pause,
    seek,
    skipForward,
    skipBackward,
    changeContent,
    setSubtitle,
    setAudioTrack,
    setSpeed,
    requestSync,

    // Allow screens to manually disconnect (e.g. on leave)
    disconnectFromRoom: store.disconnectFromRoom,
  };
}

export default useRoomSync;
