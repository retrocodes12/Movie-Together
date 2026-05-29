/**
 * useVideoSync
 *
 * Bridge between expo-video PlayerRef and the room sync system.
 *
 * Responsibilities:
 *  - Apply server-authoritative playback state to the local player
 *  - Enforce "command lock" — ignore remote state briefly after a local
 *    host action to prevent optimistic-update flicker
 *  - Drift correction — if local position drifts > DRIFT_THRESHOLD from
 *    server position, seek to correct position
 *  - Report local player events back to the sync system (host only)
 */

import { useEffect, useRef, useCallback } from "react";
import { SEEK_SYNC_THRESHOLD } from "./types";

const COMMAND_LOCK_MS = 2500; // ignore remote state for this long after local action
const DRIFT_CHECK_MS = 6000; // how often to check drift (non-hosts)
const SEEK_DEBOUNCE_MS = 300; // debounce seek bar drags

export function useVideoSync({
  player, // expo-video player instance (may be null initially)
  playbackState, // authoritative state from roomSync / useRoomStore
  isHost, // whether current user is the host
  onPlay, // (position) => void  — called when local play tapped
  onPause, // (position) => void
  onSeek, // (position) => void
  onSkipForward, // ()         => void
  onSkipBackward, // ()         => void
  onChangeContent, // (url)      => void
}) {
  const commandLockRef = useRef(false);
  const commandLockTimer = useRef(null);
  const lastAppliedPositionRef = useRef(null);
  const lastAppliedStatusRef = useRef(null);
  const driftCheckTimer = useRef(null);
  const seekDebounceRef = useRef(null);

  // ── Lock management ───────────────────────────────────────────────────────

  /** Acquire lock for COMMAND_LOCK_MS — suppresses remote state application */
  const acquireLock = useCallback(() => {
    commandLockRef.current = true;
    if (commandLockTimer.current) clearTimeout(commandLockTimer.current);
    commandLockTimer.current = setTimeout(() => {
      commandLockRef.current = false;
    }, COMMAND_LOCK_MS);
  }, []);

  // ── Apply server playback state to player (non-host receives from SSE) ────

  useEffect(() => {
    if (!player || !playbackState) return;
    if (commandLockRef.current) return; // local action in flight

    const { status, position, speed = 1.0, content_url, content_headers } = playbackState;

    // Content change — replace source
    if (
      content_url &&
      content_url !== player.currentItem?.uri &&
      content_url !== lastAppliedPositionRef.current?.url
    ) {
      try {
        player.replace({
          uri: content_url,
          ...(content_headers ? { headers: content_headers } : {}),
        });
        lastAppliedPositionRef.current = { url: content_url };
      } catch (e) {
        console.warn("useVideoSync: replace failed", e);
      }
    }

    // Playback speed
    try {
      if (Math.abs((player.playbackRate || 1) - speed) > 0.01) {
        player.playbackRate = speed;
      }
    } catch {}

    // Position sync — only apply if diff is meaningful
    const currentPos = player.currentTime ?? 0;
    const serverPos = position ?? 0;
    const drift = Math.abs(currentPos - serverPos);

    if (drift > SEEK_SYNC_THRESHOLD) {
      try {
        player.currentTime = serverPos;
        lastAppliedPositionRef.current = {
          ...lastAppliedPositionRef.current,
          pos: serverPos,
        };
      } catch (e) {
        console.warn("useVideoSync: seek failed", e);
      }
    }

    // Status
    if (status !== lastAppliedStatusRef.current) {
      lastAppliedStatusRef.current = status;
      try {
        if (status === "playing" && !player.playing) {
          player.play();
        } else if (
          (status === "paused" || status === "idle") &&
          player.playing
        ) {
          player.pause();
        }
      } catch (e) {
        console.warn("useVideoSync: play/pause failed", e);
      }
    }
  }, [player, playbackState]);

  // ── Drift correction (non-hosts only) ─────────────────────────────────────

  useEffect(() => {
    if (isHost || !player || !playbackState) return;

    const check = () => {
      if (commandLockRef.current) return;
      if (playbackState.status !== "playing") return;
      const localPos = player.currentTime ?? 0;
      const serverPos = playbackState.position ?? 0;
      // Account for time elapsed since last sync
      const elapsed = playbackState.updated_at
        ? (Date.now() - new Date(playbackState.updated_at).getTime()) / 1000
        : 0;
      const expectedPos = serverPos + elapsed;
      const drift = Math.abs(localPos - expectedPos);

      if (drift > SEEK_SYNC_THRESHOLD) {
        try {
          player.currentTime = expectedPos;
        } catch {}
      }
    };

    driftCheckTimer.current = setInterval(check, DRIFT_CHECK_MS);
    return () => clearInterval(driftCheckTimer.current);
  }, [isHost, player, playbackState]);

  // ── Host command handlers (with lock) ─────────────────────────────────────

  const handlePlay = useCallback(() => {
    if (!player) return;
    acquireLock();
    try {
      player.play();
    } catch {}
    onPlay?.(player.currentTime ?? 0);
  }, [player, acquireLock, onPlay]);

  const handlePause = useCallback(() => {
    if (!player) return;
    acquireLock();
    try {
      player.pause();
    } catch {}
    onPause?.(player.currentTime ?? 0);
  }, [player, acquireLock, onPause]);

  const handleSeek = useCallback(
    (position) => {
      if (!player) return;
      acquireLock();
      try {
        player.currentTime = position;
      } catch {}
      // Debounce network call
      if (seekDebounceRef.current) clearTimeout(seekDebounceRef.current);
      seekDebounceRef.current = setTimeout(() => {
        onSeek?.(position);
      }, SEEK_DEBOUNCE_MS);
    },
    [player, acquireLock, onSeek],
  );

  const handleSkipForward = useCallback(
    (seconds = 10) => {
      if (!player) return;
      acquireLock();
      const newPos = Math.min(
        (player.currentTime ?? 0) + seconds,
        player.duration ?? 999999,
      );
      try {
        player.currentTime = newPos;
      } catch {}
      onSkipForward?.(seconds);
    },
    [player, acquireLock, onSkipForward],
  );

  const handleSkipBackward = useCallback(
    (seconds = 10) => {
      if (!player) return;
      acquireLock();
      const newPos = Math.max((player.currentTime ?? 0) - seconds, 0);
      try {
        player.currentTime = newPos;
      } catch {}
      onSkipBackward?.(seconds);
    },
    [player, acquireLock, onSkipBackward],
  );

  const handleChangeContent = useCallback(
    (url) => {
      if (!player) return;
      acquireLock();
      try {
        player.replace({ uri: url });
      } catch {}
      onChangeContent?.(url);
    },
    [player, acquireLock, onChangeContent],
  );

  // Cleanup
  useEffect(
    () => () => {
      if (commandLockTimer.current) clearTimeout(commandLockTimer.current);
      if (driftCheckTimer.current) clearInterval(driftCheckTimer.current);
      if (seekDebounceRef.current) clearTimeout(seekDebounceRef.current);
    },
    [],
  );

  return {
    handlePlay,
    handlePause,
    handleSeek,
    handleSkipForward,
    handleSkipBackward,
    handleChangeContent,
    isLocked: () => commandLockRef.current,
  };
}
