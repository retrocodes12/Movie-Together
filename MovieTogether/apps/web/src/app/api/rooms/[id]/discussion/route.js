/**
 * POST /api/rooms/:id/discussion { device_id, action: start|end|speaking|silence }
 * GET  /api/rooms/:id/discussion?device_id=
 *
 * Discussion Mode — MovieTogether's signature feature.
 * Starting discussion pauses playback for the entire room.
 * Playback auto-resumes after silence_timeout seconds of no speaking activity.
 */
import sql from "../../../utils/sql.js";

const DISCUSSION_DEBOUNCE_MS = 3000; // Minimum time between start/end actions

async function resolveUser(deviceId) {
  if (!deviceId) return null;
  const rows =
    await sql`SELECT id, display_name FROM mt_users WHERE device_id = ${deviceId} LIMIT 1`;
  return rows[0] || null;
}

async function isMember(roomId, userId) {
  const rows = await sql`
    SELECT id FROM mt_room_members WHERE room_id = ${roomId} AND user_id = ${userId} AND is_active = true LIMIT 1
  `;
  return rows.length > 0;
}

export async function GET(request, { params }) {
  try {
    const { id } = params;
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get("device_id");

    const discussion = await sql`
      SELECT d.*, u.display_name as started_by_name
      FROM mt_discussions d
      LEFT JOIN mt_users u ON u.id = d.started_by
      WHERE d.room_id = ${id} AND d.status = 'active'
      ORDER BY d.started_at DESC
      LIMIT 1
    `;

    // Get active speakers
    const speakers = await sql`
      SELECT vs.*, u.display_name, u.avatar_url
      FROM mt_voice_state vs
      JOIN mt_users u ON u.id = vs.user_id
      WHERE vs.room_id = ${id} AND vs.is_speaking = true AND vs.is_connected = true
        AND vs.last_updated > NOW() - INTERVAL '5 seconds'
    `;

    return Response.json({
      discussion: discussion[0] || null,
      active_speakers: speakers,
      server_time: Date.now(),
    });
  } catch (e) {
    console.error("GET /api/rooms/[id]/discussion:", e);
    return Response.json(
      { error: "Failed to fetch discussion state" },
      { status: 500 },
    );
  }
}

export async function POST(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    const {
      device_id,
      action,
      silence_timeout = 10,
      auto_resume = true,
    } = body;

    if (!device_id || !action)
      return Response.json(
        { error: "device_id and action required" },
        { status: 400 },
      );

    const me = await resolveUser(device_id);
    if (!me) return Response.json({ error: "User not found" }, { status: 404 });

    const room = await sql`SELECT * FROM mt_rooms WHERE id = ${id} LIMIT 1`;
    if (!room.length)
      return Response.json({ error: "Room not found" }, { status: 404 });
    if (room[0].status === "ended")
      return Response.json({ error: "Room has ended" }, { status: 410 });

    const memberCheck = await isMember(id, me.id);
    if (!memberCheck)
      return Response.json({ error: "Not a room member" }, { status: 403 });

    if (action === "start") {
      // Check debounce — prevent accidental double-triggers
      const recent = await sql`
        SELECT id FROM mt_discussions
        WHERE room_id = ${id} AND started_at > NOW() - INTERVAL '3 seconds'
        LIMIT 1
      `;
      if (recent.length)
        return Response.json(
          { error: "Discussion already starting" },
          { status: 409 },
        );

      // End any existing active discussion first
      await sql`UPDATE mt_discussions SET status = 'ended', ended_at = NOW() WHERE room_id = ${id} AND status = 'active'`;

      // Pause playback for entire room
      const currentPS = room[0].playback_state || {};
      await sql`
        UPDATE mt_rooms
        SET
          status = 'paused',
          playback_state = playback_state || ${JSON.stringify({
            status: "paused",
            updated_at: new Date().toISOString(),
            updated_by: me.id,
          })}::jsonb,
          updated_at = NOW()
        WHERE id = ${id}
      `;

      // Create discussion session
      const disc = await sql`
        INSERT INTO mt_discussions (room_id, started_by, auto_resume, silence_timeout, status)
        VALUES (${id}, ${me.id}, ${auto_resume}, ${silence_timeout}, 'active')
        RETURNING *
      `;

      // Log event
      await sql`
        INSERT INTO mt_room_events (room_id, user_id, event_type, payload)
        VALUES (${id}, ${me.id}, 'DISCUSSION_STARTED', ${JSON.stringify({
          discussion_id: disc[0].id,
          started_by: me.display_name,
          silence_timeout,
        })}::jsonb)
      `;

      return Response.json({
        success: true,
        discussion: disc[0],
        action: "started",
      });
    }

    if (action === "end") {
      const disc = await sql`
        SELECT * FROM mt_discussions WHERE room_id = ${id} AND status = 'active' ORDER BY started_at DESC LIMIT 1
      `;
      if (!disc.length)
        return Response.json(
          { error: "No active discussion" },
          { status: 404 },
        );

      await sql`UPDATE mt_discussions SET status = 'ended', ended_at = NOW() WHERE id = ${disc[0].id}`;

      // Resume playback if auto_resume
      if (disc[0].auto_resume) {
        await sql`
          UPDATE mt_rooms
          SET
            status = 'playing',
            playback_state = playback_state || ${JSON.stringify({
              status: "playing",
              updated_at: new Date().toISOString(),
              updated_by: me.id,
            })}::jsonb,
            updated_at = NOW()
          WHERE id = ${id}
        `;
      }

      await sql`
        INSERT INTO mt_room_events (room_id, user_id, event_type, payload)
        VALUES (${id}, ${me.id}, 'DISCUSSION_ENDED', ${JSON.stringify({ discussion_id: disc[0].id })}::jsonb)
      `;

      return Response.json({
        success: true,
        action: "ended",
        auto_resumed: disc[0].auto_resume,
      });
    }

    if (action === "speaking" || action === "silence") {
      const isSpeaking = action === "speaking";
      await sql`
        INSERT INTO mt_voice_state (room_id, user_id, is_speaking, is_connected, last_updated)
        VALUES (${id}, ${me.id}, ${isSpeaking}, true, NOW())
        ON CONFLICT (room_id, user_id) DO UPDATE
          SET is_speaking = ${isSpeaking}, last_updated = NOW()
      `;

      if (action === "silence") {
        // Check if ALL members are silent — trigger auto-resume
        const disc = await sql`
          SELECT * FROM mt_discussions
          WHERE room_id = ${id} AND status = 'active' AND auto_resume = true
          ORDER BY started_at DESC LIMIT 1
        `;

        if (disc.length) {
          const silenceTimeout = disc[0].silence_timeout || 10;
          const cutoff = new Date(
            Date.now() - silenceTimeout * 1000,
          ).toISOString();
          const speakers = await sql`
            SELECT id FROM mt_voice_state
            WHERE room_id = ${id} AND is_speaking = true
              AND last_updated > ${cutoff}::timestamptz
          `;

          if (!speakers.length) {
            // All silent — end discussion and resume
            await sql`UPDATE mt_discussions SET status = 'ended', ended_at = NOW() WHERE id = ${disc[0].id}`;
            await sql`
              UPDATE mt_rooms
              SET
                status = 'playing',
                playback_state = playback_state || '{"status":"playing"}'::jsonb,
                updated_at = NOW()
              WHERE id = ${id}
            `;
            await sql`
              INSERT INTO mt_room_events (room_id, user_id, event_type, payload)
              VALUES (${id}, ${me.id}, 'DISCUSSION_AUTO_ENDED', '{"reason":"silence_timeout"}'::jsonb)
            `;
          }
        }
      }

      return Response.json({ success: true, action });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    console.error("POST /api/rooms/[id]/discussion:", e);
    return Response.json(
      { error: "Failed to process discussion action" },
      { status: 500 },
    );
  }
}
