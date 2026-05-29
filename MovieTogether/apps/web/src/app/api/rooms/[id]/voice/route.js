import sql from "@/app/api/utils/sql";

async function resolveMember(roomId, deviceId) {
  const rows = await sql`
    SELECT u.id, u.username, u.display_name, u.avatar_url
    FROM mt_users u
    JOIN mt_room_members rm ON rm.user_id = u.id
    WHERE u.device_id = ${deviceId}
      AND rm.room_id = ${roomId}
      AND rm.is_active = true
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function GET(request, { params }) {
  try {
    const { id } = params;
    const { searchParams } = new URL(request.url);
    const since = searchParams.get("since");
    const signalCutoff = since ? new Date(since).toISOString() : new Date(Date.now() - 30000).toISOString();

    const [states, signals] = await sql.transaction([
      sql`
        SELECT vs.*, u.username, u.display_name, u.avatar_url
        FROM mt_voice_state vs
        JOIN mt_users u ON u.id = vs.user_id
        WHERE vs.room_id = ${id}
          AND vs.is_connected = true
          AND vs.last_updated > NOW() - INTERVAL '30 seconds'
        ORDER BY u.display_name ASC
      `,
      sql`
        SELECT * FROM mt_voice_signals
        WHERE room_id = ${id}
          AND created_at > ${signalCutoff}::timestamptz
        ORDER BY created_at ASC
        LIMIT 200
      `,
    ]);

    return Response.json({
      voice_states: states,
      signals,
      server_time: new Date().toISOString(),
    });
  } catch (error) {
    console.error("GET /api/rooms/[id]/voice error:", error);
    return Response.json({ error: "Failed to fetch voice state" }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    const {
      device_id,
      action = "state",
      muted = false,
      deafened = false,
      push_to_talk = false,
      speaking = false,
      vad_level = 0,
      signal_type,
      target_user_id,
      signal,
    } = body;

    if (!device_id) {
      return Response.json({ error: "device_id required" }, { status: 400 });
    }

    const me = await resolveMember(id, device_id);
    if (!me) {
      return Response.json({ error: "Not a room member" }, { status: 403 });
    }

    if (action === "leave") {
      await sql`
        UPDATE mt_voice_state
        SET is_connected = false, is_speaking = false, last_updated = NOW()
        WHERE room_id = ${id} AND user_id = ${me.id}
      `;
      return Response.json({ success: true, action: "left" });
    }

    if (action === "signal") {
      if (!signal_type || !target_user_id || !signal) {
        return Response.json({ error: "signal_type, target_user_id, and signal required" }, { status: 400 });
      }
      const rows = await sql`
        INSERT INTO mt_voice_signals (room_id, from_user_id, target_user_id, signal_type, signal)
        VALUES (${id}, ${me.id}, ${target_user_id}, ${signal_type}, ${JSON.stringify(signal)}::jsonb)
        RETURNING *
      `;
      return Response.json({ success: true, signal: rows[0] }, { status: 201 });
    }

    await sql`
      INSERT INTO mt_voice_state (
        room_id, user_id, is_connected, is_muted, is_deafened,
        push_to_talk, is_speaking, vad_level, last_updated
      )
      VALUES (
        ${id}, ${me.id}, true, ${muted}, ${deafened},
        ${push_to_talk}, ${speaking && !muted}, ${vad_level}, NOW()
      )
      ON CONFLICT (room_id, user_id) DO UPDATE SET
        is_connected = true,
        is_muted = EXCLUDED.is_muted,
        is_deafened = EXCLUDED.is_deafened,
        push_to_talk = EXCLUDED.push_to_talk,
        is_speaking = EXCLUDED.is_speaking,
        vad_level = EXCLUDED.vad_level,
        last_updated = NOW()
    `;

    return Response.json({ success: true, action: "state" });
  } catch (error) {
    console.error("POST /api/rooms/[id]/voice error:", error);
    return Response.json({ error: "Failed to update voice state" }, { status: 500 });
  }
}
