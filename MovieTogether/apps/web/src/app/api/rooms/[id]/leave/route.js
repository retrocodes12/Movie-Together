import sql from "../../../utils/sql.js";

async function migrateHost(roomId, oldHostId) {
  const candidates = await sql`
    SELECT user_id
    FROM mt_room_members
    WHERE room_id = ${roomId}
      AND is_active = true
      AND user_id != ${oldHostId}
    ORDER BY can_control DESC, last_heartbeat DESC, joined_at ASC
    LIMIT 1
  `;
  if (!candidates.length) return null;
  const newHostId = candidates[0].user_id;
  await sql`
    UPDATE mt_rooms
    SET host_id = ${newHostId}, previous_host_id = ${oldHostId}, updated_at = NOW()
    WHERE id = ${roomId}
  `;
  await sql`
    UPDATE mt_room_members SET can_control = true
    WHERE room_id = ${roomId} AND user_id = ${newHostId}
  `;
  await sql`
    INSERT INTO mt_room_events (room_id, user_id, event_type, payload)
    VALUES (${roomId}, ${newHostId}, 'HOST_CHANGED', ${JSON.stringify({ old_host_id: oldHostId, new_host_id: newHostId, reason: "host_left" })}::jsonb)
  `;
  return newHostId;
}

export async function POST(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    const { device_id } = body;

    if (!device_id) {
      return Response.json({ error: "device_id required" }, { status: 400 });
    }

    const userRows = await sql`
      SELECT id FROM mt_users WHERE device_id = ${device_id} LIMIT 1
    `;
    if (userRows.length === 0) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }
    const userId = userRows[0].id;

    await sql`
      UPDATE mt_room_members SET is_active = false
      WHERE room_id = ${id} AND user_id = ${userId}
    `;

    const roomRows = await sql`
      SELECT host_id FROM mt_rooms WHERE id = ${id} LIMIT 1
    `;
    let newHostId = null;
    if (roomRows.length > 0 && roomRows[0].host_id === userId) {
      newHostId = await migrateHost(id, userId);
    }

    await sql`
      INSERT INTO mt_room_events (room_id, user_id, event_type, payload)
      VALUES (${id}, ${userId}, 'MEMBER_LEFT', ${JSON.stringify({ user_id: userId, new_host_id: newHostId })}::jsonb)
    `;

    return Response.json({ success: true, host_migrated_to: newHostId });
  } catch (error) {
    console.error("POST /api/rooms/[id]/leave error:", error);
    return Response.json({ error: "Failed to leave room" }, { status: 500 });
  }
}
