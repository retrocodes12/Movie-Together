/**
 * MovieTogether — Shared Type Definitions (JSDoc)
 *
 * @typedef {Object} PlaybackState
 * @property {'idle'|'playing'|'paused'|'buffering'|'ended'} status
 * @property {number} position        - seconds from start
 * @property {number} speed           - playback rate (1.0 = normal)
 * @property {string} content_url     - direct stream URL
 * @property {string|null} updated_at - ISO timestamp of last update
 * @property {number|null} updated_by - user_id who triggered the update
 */

/**
 * @typedef {Object} RoomMember
 * @property {number} user_id
 * @property {string} username
 * @property {string} display_name
 * @property {string|null} avatar_url
 * @property {boolean} is_online
 * @property {string} last_heartbeat
 */

/**
 * @typedef {Object} Room
 * @property {number} id
 * @property {string} name
 * @property {number|null} host_id
 * @property {string} movie_title
 * @property {string} movie_description
 * @property {string} movie_genre
 * @property {number|null} movie_year
 * @property {string|null} movie_poster_url
 * @property {string} stream_url
 * @property {'waiting'|'playing'|'paused'|'ended'} status
 * @property {string} invite_code
 * @property {number} max_members
 * @property {boolean} is_public
 * @property {PlaybackState} playback_state
 * @property {RoomMember[]} members
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} RoomEvent
 * @property {number} id
 * @property {number} room_id
 * @property {number|null} user_id
 * @property {string} event_type   - PLAY | PAUSE | SEEK | SYNC | HOST_CHANGED | MEMBER_JOINED | MEMBER_LEFT | ROOM_UPDATED | CONTENT_CHANGED
 * @property {Object} payload
 * @property {string} created_at
 */

/**
 * @typedef {'PLAY'|'PAUSE'|'SEEK'|'SKIP_FORWARD'|'SKIP_BACKWARD'|'SYNC'|'CHANGE_CONTENT'} PlaybackEventType
 */

/**
 * @typedef {'CREATE_ROOM'|'JOIN_ROOM'|'LEAVE_ROOM'|'ROOM_UPDATED'|'PLAY'|'PAUSE'|'SEEK'|'SYNC'|'HOST_CHANGED'|'MEMBER_JOINED'|'MEMBER_LEFT'|'PRESENCE_UPDATE'} SyncEventType
 */

/**
 * @typedef {Object} SyncMessage
 * @property {SyncEventType} type
 * @property {Object} payload
 * @property {string} timestamp
 */

export const PlaybackEvents = Object.freeze({
  PLAY: "PLAY",
  PAUSE: "PAUSE",
  SEEK: "SEEK",
  SKIP_FORWARD: "SKIP_FORWARD",
  SKIP_BACKWARD: "SKIP_BACKWARD",
  SYNC: "SYNC",
  CHANGE_CONTENT: "CHANGE_CONTENT",
});

export const SyncEvents = Object.freeze({
  CREATE_ROOM: "CREATE_ROOM",
  JOIN_ROOM: "JOIN_ROOM",
  LEAVE_ROOM: "LEAVE_ROOM",
  ROOM_UPDATED: "ROOM_UPDATED",
  PLAY: "PLAY",
  PAUSE: "PAUSE",
  SEEK: "SEEK",
  SYNC: "SYNC",
  HOST_CHANGED: "HOST_CHANGED",
  MEMBER_JOINED: "MEMBER_JOINED",
  MEMBER_LEFT: "MEMBER_LEFT",
  PRESENCE_UPDATE: "PRESENCE_UPDATE",
  CONTENT_CHANGED: "CONTENT_CHANGED",
});

export const SKIP_SECONDS = 10;
export const HEARTBEAT_INTERVAL = 8000; // 8s client heartbeat
export const PRESENCE_TIMEOUT = 20000; // 20s before marked offline
export const SYNC_POLL_INTERVAL = 2000; // 2s SSE poll
export const SEEK_SYNC_THRESHOLD = 3; // seconds drift before auto-sync
