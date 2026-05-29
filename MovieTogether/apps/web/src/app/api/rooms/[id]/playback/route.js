/**
 * POST /api/rooms/:id/playback
 *
 * Authoritative playback command handler.
 * Only the room host can issue PLAY, PAUSE, SEEK, SKIP_*, CHANGE_CONTENT.
 * Any member can request SYNC (gets current state back).
 *
 * All mutations are persisted to mt_rooms.playback_state and logged
 * to mt_room_events so reconnecting clients can recover state.
 */

import sql from "@/app/api/utils/sql";

const SKIP_SECONDS = 10;

async function resolveUser(deviceId) {
  if (!deviceId) return null;
  const rows =
    await sql`SELECT id, username FROM mt_users WHERE device_id = ${deviceId} LIMIT 1`;
  return rows[0] || null;
}

async function getRoom(roomId) {
  const rows = await sql`SELECT * FROM mt_rooms WHERE id = ${roomId} LIMIT 1`;
  return rows[0] || null;
}

async function isMember(roomId, userId) {
  const rows = await sql`
    SELECT id FROM mt_room_members
    WHERE room_id = ${roomId} AND user_id = ${userId} AND is_active = true
    LIMIT 1
  `;
  return rows.length > 0;
}

async function logEvent(roomId, userId, eventType, payload) {
  await sql`
    INSERT INTO mt_room_events (room_id, user_id, event_type, payload)
    VALUES (${roomId}, ${userId}, ${eventType}, ${JSON.stringify(payload)}::jsonb)
  `;
}

async function updatePlaybackState(roomId, patch) {
  // Merge patch into existing playback_state
  const rows = await sql`
    UPDATE mt_rooms
    SET
      playback_state = playback_state || ${JSON.stringify(patch)}::jsonb,
      updated_at = NOW()
    WHERE id = ${roomId}
    RETURNING playback_state
  `;
  return rows[0]?.playback_state;
}

export async function POST(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    const { device_id, event, payload = {} } = body;

    if (!event) {
      return Response.json({ error: "event is required" }, { status: 400 });
    }

    const user = await resolveUser(device_id);
    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const room = await getRoom(id);
    if (!room) {
      return Response.json({ error: "Room not found" }, { status: 404 });
    }

    if (room.status === "ended") {
      return Response.json({ error: "Room has ended" }, { status: 410 });
    }

    const memberCheck = await isMember(id, user.id);
    if (!memberCheck) {
      return Response.json(
        { error: "Not a member of this room" },
        { status: 403 },
      );
    }

    const isHost = room.host_id === user.id;
    const now = new Date().toISOString();
    const currentPS = room.playback_state || {
      status: "idle",
      position: 0,
      speed: 1.0,
      content_url: "",
    };

    // ── SYNC — any member can request current state ───────────────
    if (event === "SYNC") {
      return Response.json({
        event: "SYNC",
        playback_state: currentPS,
        server_time: Date.now(),
        room_id: room.id,
      });
    }

    // ── Host-only commands ────────────────────────────────────────
    if (!isHost) {
      return Response.json(
        { error: "Only the host can control playback" },
        { status: 403 },
      );
    }

    let updatedPS;
    let loggedEvent = event;

    switch (event) {
      case "PLAY": {
        const position =
          payload.position !== undefined
            ? payload.position
            : currentPS.position;
        updatedPS = await updatePlaybackState(id, {
          status: "playing",
          position,
          updated_at: now,
          updated_by: user.id,
        });
        // Also update room status
        await sql`UPDATE mt_rooms SET status = 'playing', updated_at = NOW() WHERE id = ${id}`;
        break;
      }

      case "PAUSE": {
        const position =
          payload.position !== undefined
            ? payload.position
            : currentPS.position;
        updatedPS = await updatePlaybackState(id, {
          status: "paused",
          position,
          updated_at: now,
          updated_by: user.id,
        });
        await sql`UPDATE mt_rooms SET status = 'paused', updated_at = NOW() WHERE id = ${id}`;
        break;
      }

      case "SEEK": {
        if (
          payload.position === undefined ||
          typeof payload.position !== "number"
        ) {
          return Response.json(
            { error: "position (number) is required for SEEK" },
            { status: 400 },
          );
        }
        updatedPS = await updatePlaybackState(id, {
          position: Math.max(0, payload.position),
          updated_at: now,
          updated_by: user.id,
        });
        break;
      }

      case "SKIP_FORWARD": {
        const skip = payload.seconds || SKIP_SECONDS;
        const newPos = (currentPS.position || 0) + skip;
        updatedPS = await updatePlaybackState(id, {
          position: newPos,
          updated_at: now,
          updated_by: user.id,
        });
        loggedEvent = "SEEK";
        break;
      }

      case "SKIP_BACKWARD": {
        const skip = payload.seconds || SKIP_SECONDS;
        const newPos = Math.max(0, (currentPS.position || 0) - skip);
        updatedPS = await updatePlaybackState(id, {
          position: newPos,
          updated_at: now,
          updated_by: user.id,
        });
        loggedEvent = "SEEK";
        break;
      }

      case "CHANGE_CONTENT": {
        if (!payload.content_url) {
          return Response.json(
            { error: "content_url is required" },
            { status: 400 },
          );
        }
        const contentMeta = payload.content_meta || null;
        updatedPS = await updatePlaybackState(id, {
          status: "idle",
          position: 0,
          content_url: payload.content_url,
          content_meta: contentMeta,
          updated_at: now,
          updated_by: user.id,
        });
        // Persist stream_url too
        await sql`
          UPDATE mt_rooms
          SET
            stream_url = ${payload.content_url},
            movie_title = COALESCE(${contentMeta?.name || null}, movie_title),
            movie_description = COALESCE(${contentMeta?.description || null}, movie_description),
            movie_genre = COALESCE(${Array.isArray(contentMeta?.genres) ? contentMeta.genres.join(", ") : null}, movie_genre),
            movie_year = COALESCE(${Number.parseInt(contentMeta?.year || contentMeta?.releaseInfo, 10) || null}, movie_year),
            movie_poster_url = COALESCE(${contentMeta?.poster || null}, movie_poster_url),
            status = 'waiting',
            updated_at = NOW()
          WHERE id = ${id}
        `;
        break;
      }

      case "SET_SPEED": {
        const speed = payload.speed || 1.0;
        if (speed < 0.25 || speed > 3.0) {
          return Response.json(
            { error: "speed must be between 0.25 and 3.0" },
            { status: 400 },
          );
        }
        updatedPS = await updatePlaybackState(id, {
          speed,
          updated_at: now,
          updated_by: user.id,
        });
        break;
      }

      case "SET_SUBTITLE": {
        updatedPS = await updatePlaybackState(id, {
          subtitle_url: payload.subtitle_url || null,
          updated_at: now,
          updated_by: user.id,
        });
        break;
      }

      case "SET_AUDIO_TRACK": {
        updatedPS = await updatePlaybackState(id, {
          audio_track: payload.audio_track || null,
          updated_at: now,
          updated_by: user.id,
        });
        break;
      }

      default:
        return Response.json(
          { error: `Unknown event: ${event}` },
          { status: 400 },
        );
    }

    // Log event for state recovery
    await logEvent(id, user.id, loggedEvent, {
      playback_state: updatedPS,
      triggered_by: user.username,
      original_payload: payload,
    });

    return Response.json({
      event: loggedEvent,
      playback_state: updatedPS,
      server_time: Date.now(),
      room_id: parseInt(id),
    });
  } catch (error) {
    console.error("POST /api/rooms/[id]/playback error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
