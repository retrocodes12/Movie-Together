/**
 * GET /api/rooms/:id/stream
 *
 * Server-Sent Events endpoint — streams room state to connected clients.
 * Acts as the real-time channel replacing Socket.IO on this serverless platform.
 *
 * The server is the authoritative source of truth.
 * Each connected client gets a dedicated SSE stream that polls PostgreSQL
 * every POLL_INTERVAL ms and pushes state diffs downstream.
 */

import sql from "@/app/api/utils/sql";

const POLL_INTERVAL = 2000; // ms between DB polls
const PRESENCE_TIMEOUT = 20000; // ms before a member is considered offline
const STREAM_MAX_AGE = 300000; // 5 min max stream lifetime (serverless constraint)

/** Build the full authoritative room snapshot from the DB */
async function getRoomSnapshot(roomId) {
  const [roomRows, memberRows, eventRows] = await sql.transaction([
    sql`
      SELECT
        r.*,
        u.username AS host_username,
        u.display_name AS host_display_name,
        u.avatar_url AS host_avatar_url
      FROM mt_rooms r
      LEFT JOIN mt_users u ON r.host_id = u.id
      WHERE r.id = ${roomId}
      LIMIT 1
    `,
    sql`
      SELECT
        rm.*,
        u.username, u.display_name, u.avatar_url,
        CASE WHEN rm.last_heartbeat > NOW() - INTERVAL '20 seconds'
             THEN true ELSE false END AS is_online
      FROM mt_room_members rm
      JOIN mt_users u ON rm.user_id = u.id
      WHERE rm.room_id = ${roomId} AND rm.is_active = true
      ORDER BY rm.joined_at ASC
    `,
    sql`
      SELECT * FROM mt_room_events
      WHERE room_id = ${roomId}
      ORDER BY created_at DESC
      LIMIT 1
    `,
  ]);

  if (roomRows.length === 0) return null;

  const room = roomRows[0];
  return {
    room: {
      ...room,
      members: memberRows,
      playback_state: room.playback_state || {
        status: "idle",
        position: 0,
        speed: 1.0,
        content_url: room.stream_url || "",
        updated_at: null,
        updated_by: null,
      },
    },
    last_event: eventRows[0] || null,
  };
}

/** Format a SSE data frame */
function sseFrame(eventType, data) {
  return `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(request, { params }) {
  const { id } = params;
  const { searchParams } = new URL(request.url);
  const deviceId = searchParams.get("device_id");
  const lastEventId = searchParams.get("last_event_id");

  if (!id) {
    return new Response("room id required", { status: 400 });
  }

  // Resolve user from device_id
  let userId = null;
  if (deviceId) {
    const userRows =
      await sql`SELECT id FROM mt_users WHERE device_id = ${deviceId} LIMIT 1`;
    if (userRows.length > 0) userId = userRows[0].id;
  }

  const encoder = new TextEncoder();
  let closed = false;
  let pollTimer = null;
  let lastSnapshotHash = null;
  let startedAt = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (eventType, data) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(sseFrame(eventType, data)));
        } catch (e) {
          closed = true;
        }
      };

      // ── Initial snapshot ──────────────────────────────────────────
      try {
        const snapshot = await getRoomSnapshot(id);
        if (!snapshot) {
          send("error", { message: "Room not found" });
          controller.close();
          return;
        }

        send("ROOM_UPDATED", {
          type: "ROOM_UPDATED",
          payload: snapshot,
          timestamp: new Date().toISOString(),
        });

        lastSnapshotHash = JSON.stringify({
          status: snapshot.room.status,
          host_id: snapshot.room.host_id,
          playback_state: snapshot.room.playback_state,
          member_count: snapshot.room.members.length,
          online_count: snapshot.room.members.filter((m) => m.is_online).length,
        });
      } catch (e) {
        console.error("SSE initial snapshot error:", e);
        send("error", { message: "Failed to load room state" });
        controller.close();
        return;
      }

      // ── Heartbeat ping every 15s ──────────────────────────────────
      const pingTimer = setInterval(() => {
        if (closed) {
          clearInterval(pingTimer);
          return;
        }
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          closed = true;
        }
      }, 15000);

      // ── Poll loop ─────────────────────────────────────────────────
      const poll = async () => {
        if (closed || Date.now() - startedAt > STREAM_MAX_AGE) {
          clearInterval(pingTimer);
          if (!closed) {
            try {
              controller.close();
            } catch {}
          }
          closed = true;
          return;
        }

        try {
          const snapshot = await getRoomSnapshot(id);
          if (!snapshot) {
            send("error", { message: "Room no longer exists" });
            clearInterval(pingTimer);
            try {
              controller.close();
            } catch {}
            closed = true;
            return;
          }

          const currentHash = JSON.stringify({
            status: snapshot.room.status,
            host_id: snapshot.room.host_id,
            playback_state: snapshot.room.playback_state,
            member_count: snapshot.room.members.length,
            online_count: snapshot.room.members.filter((m) => m.is_online)
              .length,
          });

          if (currentHash !== lastSnapshotHash) {
            // Determine specific event type for richer client handling
            let eventType = "ROOM_UPDATED";
            try {
              const prev = JSON.parse(lastSnapshotHash || "{}");
              const curr = JSON.parse(currentHash);
              const prevPS = prev.playback_state || {};
              const currPS = curr.playback_state || {};

              if (prev.host_id !== curr.host_id) eventType = "HOST_CHANGED";
              else if (
                currPS.status === "playing" &&
                prevPS.status !== "playing"
              )
                eventType = "PLAY";
              else if (currPS.status === "paused" && prevPS.status !== "paused")
                eventType = "PAUSE";
              else if (
                Math.abs((currPS.position || 0) - (prevPS.position || 0)) > 2
              )
                eventType = "SEEK";
              else if (currPS.content_url !== prevPS.content_url)
                eventType = "CONTENT_CHANGED";
              else if (prev.member_count !== curr.member_count)
                eventType = "PRESENCE_UPDATE";
            } catch {}

            send(eventType, {
              type: eventType,
              payload: snapshot,
              timestamp: new Date().toISOString(),
            });

            // Also always send SYNC so clients can reconcile position
            if (["PLAY", "PAUSE", "SEEK"].includes(eventType)) {
              send("SYNC", {
                type: "SYNC",
                payload: {
                  playback_state: snapshot.room.playback_state,
                  server_time: Date.now(),
                },
                timestamp: new Date().toISOString(),
              });
            }

            lastSnapshotHash = currentHash;
          }
        } catch (e) {
          console.error("SSE poll error:", e);
        }

        if (!closed) {
          pollTimer = setTimeout(poll, POLL_INTERVAL);
        }
      };

      pollTimer = setTimeout(poll, POLL_INTERVAL);
    },

    cancel() {
      closed = true;
      if (pollTimer) clearTimeout(pollTimer);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
