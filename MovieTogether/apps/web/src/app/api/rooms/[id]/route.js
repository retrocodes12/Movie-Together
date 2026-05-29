import sql from "@/app/api/utils/sql";

const PRESENCE_TIMEOUT_S = 20;

export async function GET(request, { params }) {
  try {
    const { id } = params;

    const roomRows = await sql`
      SELECT 
        r.*,
        u.username as host_username,
        u.display_name as host_display_name,
        u.avatar_url as host_avatar_url
      FROM mt_rooms r
      LEFT JOIN mt_users u ON r.host_id = u.id
      WHERE r.id = ${id} LIMIT 1
    `;

    if (roomRows.length === 0) {
      return Response.json({ error: "Room not found" }, { status: 404 });
    }

    const members = await sql`
      SELECT 
        rm.joined_at, rm.is_active, rm.last_heartbeat,
        CASE WHEN rm.last_heartbeat > NOW() - INTERVAL '20 seconds'
             THEN true ELSE false END AS is_online,
        u.id as user_id, u.username, u.display_name, u.avatar_url
      FROM mt_room_members rm
      JOIN mt_users u ON rm.user_id = u.id
      WHERE rm.room_id = ${id} AND rm.is_active = true
      ORDER BY rm.joined_at ASC
    `;

    const room = roomRows[0];
    // Ensure playback_state has defaults
    const playback_state = room.playback_state || {
      status: "idle",
      position: 0,
      speed: 1.0,
      content_url: room.stream_url || "",
      updated_at: null,
      updated_by: null,
    };

    return Response.json({ room: { ...room, members, playback_state } });
  } catch (error) {
    console.error("GET /api/rooms/[id] error:", error);
    return Response.json({ error: "Failed to fetch room" }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    const {
      device_id,
      status,
      playback_position,
      name,
      stream_url,
      playback_state,
    } = body;

    if (!device_id) {
      return Response.json({ error: "device_id required" }, { status: 400 });
    }

    const userRows = await sql`
      SELECT id FROM mt_users WHERE device_id = ${device_id} LIMIT 1
    `;
    if (userRows.length === 0) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const roomRows = await sql`
      SELECT host_id FROM mt_rooms WHERE id = ${id} LIMIT 1
    `;
    if (roomRows.length === 0) {
      return Response.json({ error: "Room not found" }, { status: 404 });
    }

    if (roomRows[0].host_id !== userRows[0].id) {
      return Response.json(
        { error: "Only the host can update the room" },
        { status: 403 },
      );
    }

    const setClauses = ["updated_at = NOW()"];
    const values = [];
    let paramCount = 1;

    if (status !== undefined) {
      setClauses.push(`status = $${paramCount++}`);
      values.push(status);
    }
    if (playback_position !== undefined) {
      setClauses.push(`playback_position = $${paramCount++}`);
      values.push(playback_position);
    }
    if (name !== undefined) {
      setClauses.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (stream_url !== undefined) {
      setClauses.push(`stream_url = $${paramCount++}`);
      values.push(stream_url);
    }
    if (playback_state !== undefined) {
      setClauses.push(
        `playback_state = playback_state || $${paramCount++}::jsonb`,
      );
      values.push(JSON.stringify(playback_state));
    }

    values.push(id);
    const query = `UPDATE mt_rooms SET ${setClauses.join(", ")} WHERE id = $${paramCount} RETURNING *`;
    const updatedRows = await sql(query, values);

    return Response.json({ room: updatedRows[0] });
  } catch (error) {
    console.error("PUT /api/rooms/[id] error:", error);
    return Response.json({ error: "Failed to update room" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = params;
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get("device_id");

    if (!deviceId) {
      return Response.json({ error: "device_id required" }, { status: 400 });
    }

    const userRows = await sql`
      SELECT id FROM mt_users WHERE device_id = ${deviceId} LIMIT 1
    `;
    if (userRows.length === 0) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const roomRows = await sql`
      SELECT host_id FROM mt_rooms WHERE id = ${id} LIMIT 1
    `;
    if (roomRows.length === 0) {
      return Response.json({ error: "Room not found" }, { status: 404 });
    }

    if (roomRows[0].host_id !== userRows[0].id) {
      return Response.json(
        { error: "Only the host can delete the room" },
        { status: 403 },
      );
    }

    await sql`UPDATE mt_rooms SET status = 'ended' WHERE id = ${id}`;
    return Response.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/rooms/[id] error:", error);
    return Response.json({ error: "Failed to delete room" }, { status: 500 });
  }
}
