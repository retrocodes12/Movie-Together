/**
 * POST /api/rooms/:id/heartbeat
 *
 * Member presence tracking.
 * Clients call this every HEARTBEAT_INTERVAL ms while in a room.
 * Members not seen for PRESENCE_TIMEOUT ms are marked offline.
 * If the host goes offline, host migration is triggered.
 */

import sql from "@/app/api/utils/sql";

const PRESENCE_TIMEOUT_S = 20; // seconds

async function migrateHost(roomId, oldHostId) {
  // Find the next online member to promote (earliest join date, not the old host)
  const candidates = await sql`
    SELECT rm.user_id
    FROM mt_room_members rm
    WHERE rm.room_id = ${roomId}
      AND rm.is_active = true
      AND rm.user_id != ${oldHostId}
      AND rm.last_heartbeat > NOW() - INTERVAL '20 seconds'
    ORDER BY rm.joined_at ASC
    LIMIT 1
  `;

  if (candidates.length === 0) {
    // No online members — end the room
    await sql`
      UPDATE mt_rooms
      SET status = 'ended', updated_at = NOW()
      WHERE id = ${roomId}
    `;
    return null;
  }

  const newHostId = candidates[0].user_id;
  await sql`
    UPDATE mt_rooms
    SET host_id = ${newHostId}, previous_host_id = ${oldHostId}, updated_at = NOW()
    WHERE id = ${roomId}
  `;

  // Log event
  await sql`
    INSERT INTO mt_room_events (room_id, user_id, event_type, payload)
    VALUES (
      ${roomId},
      ${newHostId},
      'HOST_CHANGED',
      ${JSON.stringify({ old_host_id: oldHostId, new_host_id: newHostId })}::jsonb
    )
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

    // Resolve user
    const userRows = await sql`
      SELECT id FROM mt_users WHERE device_id = ${device_id} LIMIT 1
    `;
    if (userRows.length === 0) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }
    const userId = userRows[0].id;

    // Update heartbeat + mark online
    const updated = await sql`
      UPDATE mt_room_members
      SET last_heartbeat = NOW(), is_online = true
      WHERE room_id = ${id} AND user_id = ${userId} AND is_active = true
      RETURNING id
    `;

    if (updated.length === 0) {
      return Response.json(
        { error: "Not a member of this room" },
        { status: 403 },
      );
    }

    // Mark stale members offline
    await sql`
      UPDATE mt_room_members
      SET is_online = false
      WHERE room_id = ${id}
        AND is_active = true
        AND user_id != ${userId}
        AND last_heartbeat < NOW() - INTERVAL '20 seconds'
    `;

    // Check if host is still online; trigger migration if not
    const roomRows = await sql`
      SELECT r.id, r.host_id, r.status,
             rm.last_heartbeat AS host_heartbeat,
             rm.is_online AS host_online
      FROM mt_rooms r
      LEFT JOIN mt_room_members rm ON rm.room_id = r.id AND rm.user_id = r.host_id
      WHERE r.id = ${id}
      LIMIT 1
    `;

    let hostMigrated = null;
    if (roomRows.length > 0) {
      const room = roomRows[0];
      const hostOnline =
        room.host_online &&
        room.host_heartbeat &&
        new Date(room.host_heartbeat) > new Date(Date.now() - 20000);

      if (!hostOnline && room.status !== "ended" && room.host_id !== userId) {
        const newHostId = await migrateHost(id, room.host_id);
        if (newHostId) hostMigrated = newHostId;
      }
    }

    // Return current online member count for client info
    const onlineCount = await sql`
      SELECT COUNT(*) as cnt FROM mt_room_members
      WHERE room_id = ${id} AND is_active = true
        AND last_heartbeat > NOW() - INTERVAL '20 seconds'
    `;

    return Response.json({
      ok: true,
      online_count: parseInt(onlineCount[0].cnt),
      host_migrated: hostMigrated,
      server_time: Date.now(),
    });
  } catch (error) {
    console.error("POST /api/rooms/[id]/heartbeat error:", error);
    return Response.json({ error: "Heartbeat failed" }, { status: 500 });
  }
}
