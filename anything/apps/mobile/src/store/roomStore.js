/**
 * Zustand Room Store
 *
 * Single source of client-side truth for all room sync state.
 * All mutations come through roomSync service events — never mutated
 * directly by UI components (except optimistic updates which are
 * reconciled on the next server event).
 */

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import roomSync from "@/utils/roomSync";
import { SyncEvents } from "@/utils/types";

const INITIAL_PLAYBACK = {
  status: "idle", // 'idle' | 'playing' | 'paused' | 'buffering' | 'ended'
  position: 0, // seconds
  speed: 1.0,
  content_url: "",
  updated_at: null,
  updated_by: null,
};

export const useRoomStore = create(
  subscribeWithSelector((set, get) => ({
    // ── State ──────────────────────────────────────────────────────

    /** Full room object from server (latest snapshot) */
    room: null,

    /** Authoritative playback state */
    playbackState: { ...INITIAL_PLAYBACK },

    /** Member list with presence */
    members: [],

    /** Map of userId → { is_online, last_heartbeat } */
    presenceMap: {},

    /** Connection state */
    isConnected: false,
    isReconnecting: false,
    reconnectAttempt: 0,

    /** Whether current user is the host */
    isHost: false,

    /** Whether current user can control playback (host or co-host) */
    hasPlaybackControl: false,

    /** Current user ID (set when connecting) */
    currentUserId: null,

    /** Sync session (room ID currently connected to) */
    connectedRoomId: null,

    /** Pending optimistic UI state (cleared on server confirmation) */
    optimisticPlayback: null,

    /** Last sync time (server time) */
    lastSyncedAt: null,

    /** Event log for UI notifications (HOST_CHANGED, MEMBER_JOINED, etc.) */
    recentEvents: [], // max 10, newest first

    // ── Computed helpers ───────────────────────────────────────────

    getOnlineCount: () => {
      return get().members.filter((m) => m.is_online).length;
    },

    getEffectivePlayback: () => {
      // Optimistic takes priority until server confirms
      return get().optimisticPlayback || get().playbackState;
    },

    // ── Actions ────────────────────────────────────────────────────

    /** Connect to a room's sync stream and subscribe to events. */
    connectToRoom: (room, currentUserId, deviceId) => {
      const state = get();

      // Already connected to this room
      if (state.connectedRoomId === String(room.id)) return;

      // Disconnect from previous room
      if (state.connectedRoomId) {
        roomSync.disconnect();
      }

      const isHost = room.host_id === currentUserId;
      const myMember = (room.members || []).find(
        (m) => m.user_id === currentUserId,
      );
      const hasPlaybackControl = isHost || !!myMember?.has_playback_control;

      set({
        room,
        members: room.members || [],
        playbackState: room.playback_state || { ...INITIAL_PLAYBACK },
        presenceMap: buildPresenceMap(room.members || []),
        isHost,
        hasPlaybackControl,
        currentUserId,
        connectedRoomId: String(room.id),
        isConnected: false,
        isReconnecting: false,
        recentEvents: [],
        optimisticPlayback: null,
      });

      // Wire up roomSync listeners
      const unsubs = [
        roomSync.on(SyncEvents.ROOM_UPDATED, (payload) => {
          if (!payload?.room) return;
          const r = payload.room;
          const myMemberUpdated = (r.members || []).find(
            (m) => m.user_id === get().currentUserId,
          );
          const newIsHost = r.host_id === get().currentUserId;
          const newHasControl =
            newIsHost || !!myMemberUpdated?.has_playback_control;
          set((s) => ({
            room: r,
            members: r.members || s.members,
            playbackState: r.playback_state || s.playbackState,
            presenceMap: buildPresenceMap(r.members || s.members),
            isHost: newIsHost,
            hasPlaybackControl: newHasControl,
            optimisticPlayback: null,
            lastSyncedAt: Date.now(),
          }));
        }),

        roomSync.on(SyncEvents.PLAY, (payload) => {
          const ps = payload?.room?.playback_state || payload?.playback_state;
          if (!ps) return;
          set({
            playbackState: ps,
            optimisticPlayback: null,
            lastSyncedAt: Date.now(),
          });
          get()._pushEvent({ type: SyncEvents.PLAY, payload: ps });
        }),

        roomSync.on(SyncEvents.PAUSE, (payload) => {
          const ps = payload?.room?.playback_state || payload?.playback_state;
          if (!ps) return;
          set({ playbackState: ps, optimisticPlayback: null });
          get()._pushEvent({ type: SyncEvents.PAUSE, payload: ps });
        }),

        roomSync.on(SyncEvents.SEEK, (payload) => {
          const ps = payload?.room?.playback_state || payload?.playback_state;
          if (!ps) return;
          set({
            playbackState: ps,
            optimisticPlayback: null,
            lastSyncedAt: Date.now(),
          });
        }),

        roomSync.on(SyncEvents.SYNC, (payload) => {
          const ps = payload?.playback_state;
          if (!ps) return;
          set({
            playbackState: ps,
            optimisticPlayback: null,
            lastSyncedAt: Date.now(),
          });
        }),

        roomSync.on(SyncEvents.HOST_CHANGED, (payload) => {
          set((s) => ({
            room: s.room
              ? { ...s.room, host_id: payload?.new_host_id }
              : s.room,
            isHost: payload?.new_host_id === s.currentUserId,
            hasPlaybackControl:
              payload?.new_host_id === s.currentUserId || s.hasPlaybackControl,
          }));
          get()._pushEvent({ type: SyncEvents.HOST_CHANGED, payload });
        }),

        roomSync.on(SyncEvents.PRESENCE_UPDATE, (payload) => {
          const room = payload?.room;
          if (!room) return;
          set({
            members: room.members || get().members,
            presenceMap: buildPresenceMap(room.members || get().members),
          });
        }),

        roomSync.on(SyncEvents.MEMBER_JOINED, (payload) => {
          get()._pushEvent({ type: SyncEvents.MEMBER_JOINED, payload });
        }),

        roomSync.on(SyncEvents.MEMBER_LEFT, (payload) => {
          get()._pushEvent({ type: SyncEvents.MEMBER_LEFT, payload });
        }),

        roomSync.on(
          "CONNECTION_STATE",
          ({ connected, reconnecting, attempt }) => {
            set({
              isConnected: connected,
              isReconnecting: !!reconnecting,
              reconnectAttempt: attempt || 0,
            });
          },
        ),

        roomSync.on("HEARTBEAT_ACK", (data) => {
          // Update online member count from heartbeat response
          if (data?.online_count !== undefined) {
            set((s) => ({
              presenceMap: {
                ...s.presenceMap,
                _onlineCount: data.online_count,
              },
            }));
          }
        }),
      ];

      // Connect SSE stream
      roomSync.connect(String(room.id), deviceId, currentUserId);

      // Store unsub fns for cleanup
      set({ _unsubs: unsubs });
    },

    /** Disconnect and clean up all listeners. */
    disconnectFromRoom: () => {
      const { _unsubs } = get();
      if (_unsubs) _unsubs.forEach((fn) => fn());
      roomSync.disconnect();
      set({
        room: null,
        members: [],
        playbackState: { ...INITIAL_PLAYBACK },
        presenceMap: {},
        isConnected: false,
        isReconnecting: false,
        connectedRoomId: null,
        isHost: false,
        hasPlaybackControl: false,
        optimisticPlayback: null,
        recentEvents: [],
        _unsubs: null,
      });
    },

    // ── Optimistic playback actions (host only) ────────────────────

    optimisticPlay: (position) => {
      set({
        optimisticPlayback: {
          ...get().playbackState,
          status: "playing",
          position: position ?? get().playbackState.position,
        },
      });
    },

    optimisticPause: (position) => {
      set({
        optimisticPlayback: {
          ...get().playbackState,
          status: "paused",
          position: position ?? roomSync.getCurrentPosition(),
        },
      });
    },

    optimisticSeek: (position) => {
      set({
        optimisticPlayback: {
          ...get().playbackState,
          position,
        },
      });
    },

    clearOptimistic: () => set({ optimisticPlayback: null }),

    // ── Internal ───────────────────────────────────────────────────

    _pushEvent: (event) => {
      set((s) => ({
        recentEvents: [{ ...event, ts: Date.now() }, ...s.recentEvents].slice(
          0,
          10,
        ),
      }));
    },

    _unsubs: null,
  })),
);

// ── Helpers ────────────────────────────────────────────────────────────────

function buildPresenceMap(members) {
  const map = {};
  for (const m of members) {
    map[m.user_id] = {
      is_online: m.is_online,
      last_heartbeat: m.last_heartbeat,
    };
  }
  return map;
}
